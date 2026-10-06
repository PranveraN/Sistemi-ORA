import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestStatusKey, type StatusKey } from "@/lib/materialStatusUi";

// Analitika e Materialeve për periudhën e zgjedhur:
//   ?period=month (ky muaj) | year (ky vit shkollor) | custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Kohët kthehen në milisekonda (formatohen te klienti); shpenzimi = null kur
// asnjë rresht porosie s'ka çmim (që të mos shfaqet "0,00 €" i rremë).

const SCHOOL_MONTHS = [
  { m: 8, label: "Sht" }, { m: 9, label: "Tet" }, { m: 10, label: "Nën" }, { m: 11, label: "Dhj" },
  { m: 0, label: "Jan" }, { m: 1, label: "Shk" }, { m: 2, label: "Mar" }, { m: 3, label: "Pri" },
  { m: 4, label: "Maj" }, { m: 5, label: "Qer" },
];

function schoolYearStart(d: Date) { return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; }

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SUPERADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const period = sp.get("period") === "year" ? "year" : sp.get("period") === "custom" ? "custom" : "month";
  const now = new Date();
  let from: Date, to: Date;
  if (period === "year") {
    const y = schoolYearStart(now);
    from = new Date(y, 8, 1); to = new Date(y + 1, 8, 1);
  } else if (period === "custom") {
    const f = sp.get("from") ? new Date(`${sp.get("from")}T00:00:00`) : null;
    const t = sp.get("to") ? new Date(`${sp.get("to")}T00:00:00`) : null;
    if (!f || !t || isNaN(f.getTime()) || isNaN(t.getTime()) || f > t) {
      return NextResponse.json({ error: "Zgjidhni periudhën (nga – deri)." }, { status: 400 });
    }
    from = f; to = new Date(t.getTime() + 86_400_000);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const sy = schoolYearStart(period === "custom" ? new Date(to.getTime() - 1) : now);
  const syFrom = new Date(sy, 8, 1), syTo = new Date(sy + 1, 8, 1);
  const sent = (r: { submittedAt: Date | null; createdAt: Date }) => r.submittedAt ?? r.createdAt;

  const [requests, orders] = await Promise.all([
    prisma.materialRequest.findMany({
      where: { organizationId: orgId, OR: [{ submittedAt: { gte: new Date(Math.min(from.getTime(), syFrom.getTime())), lt: new Date(Math.max(to.getTime(), syTo.getTime())) } }, { submittedAt: null }] },
      select: {
        id: true, status: true, createdAt: true, submittedAt: true, reviewedAt: true, deliveredAt: true,
        teacherId: true, teacher: { select: { name: true } },
        items: { select: { isCustom: true, customItemName: true, quantity: true, unit: true, materialId: true, material: { select: { name: true } } } },
      },
    }),
    prisma.materialOrder.findMany({
      where: { organizationId: orgId, status: { not: "CANCELLED" }, orderDate: { gte: from, lt: to } },
      select: { items: { select: { unitPrice: true, quantity: true, receivedQuantity: true } } },
    }),
  ]);

  const inPeriod = requests.filter(r => { const d = sent(r); return d >= from && d < to; });
  const allItems = inPeriod.flatMap(r => r.items);

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const decisionMs = avg(inPeriod.filter(r => r.reviewedAt && !["SUBMITTED", "UNDER_REVIEW"].includes(r.status))
    .map(r => r.reviewedAt!.getTime() - sent(r).getTime()).filter(x => x >= 0));
  const deliveryMs = avg(inPeriod.filter(r => r.deliveredAt).map(r => r.deliveredAt!.getTime() - sent(r).getTime()).filter(x => x >= 0));

  // Shpenzimi: vetëm rreshtat me çmim (sasia e pranuar, ose e porositur kur s'ka ardhur ende)
  const priced = orders.flatMap(o => o.items).filter(it => it.unitPrice !== null && it.unitPrice > 0);
  const spend = priced.length
    ? Math.round(priced.reduce((s, it) => s + it.unitPrice! * (it.receivedQuantity || it.quantity), 0) * 100) / 100
    : null;

  const statusCounts: Record<StatusKey, number> = { SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 0, ORDERED: 0, DELIVERED: 0, REJECTED: 0, CANCELLED: 0 };
  for (const r of inPeriod) statusCounts[requestStatusKey(r.status)]++;

  const monthly = SCHOOL_MONTHS.map(({ m, label }) => {
    const year = m >= 8 ? sy : sy + 1;
    const count = requests.filter(r => { const d = sent(r); return d.getFullYear() === year && d.getMonth() === m; }).length;
    return { label, count };
  });

  const mat = new Map<string, { name: string; unit: string; quantity: number; requests: number }>();
  for (const it of allItems) {
    const name = (it.isCustom ? it.customItemName : it.material?.name) ?? "Artikull";
    const key = `${it.materialId ?? `c:${name.toLowerCase()}`}|${it.unit}`;
    const cur = mat.get(key) ?? { name, unit: it.unit, quantity: 0, requests: 0 };
    cur.quantity += it.quantity; cur.requests++;
    mat.set(key, cur);
  }
  const topMaterials = [...mat.values()].sort((a, b) => b.requests - a.requests || b.quantity - a.quantity).slice(0, 10);

  const tea = new Map<number, { id: number; name: string; count: number }>();
  for (const r of inPeriod) {
    const cur = tea.get(r.teacherId) ?? { id: r.teacherId, name: r.teacher.name, count: 0 };
    cur.count++; tea.set(r.teacherId, cur);
  }
  const topTeachers = [...tea.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10);

  return NextResponse.json({
    period, from: from.toISOString(), to: new Date(to.getTime() - 1).toISOString(),
    schoolYear: `${sy}–${sy + 1}`,
    requests: inPeriod.length,
    items: allItems.length,
    quantity: allItems.reduce((s, it) => s + it.quantity, 0),
    decisionMs, deliveryMs, spend,
    statusCounts, monthly, topMaterials, topTeachers,
  });
}
