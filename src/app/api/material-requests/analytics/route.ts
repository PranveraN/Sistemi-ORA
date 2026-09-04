import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MONTH_NAMES = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const [requests, items, orders] = await Promise.all([
    prisma.materialRequest.findMany({
      where: { organizationId: orgId },
      select: { id: true, status: true, createdAt: true, submittedAt: true, reviewedAt: true, teacherId: true, teacher: { select: { name: true } } },
    }),
    prisma.materialRequestItem.findMany({
      where: { request: { organizationId: orgId } },
      select: { isCustom: true, customItemName: true, quantity: true, materialId: true, material: { select: { name: true } } },
    }),
    prisma.materialOrder.findMany({
      where: { organizationId: orgId, status: { not: "CANCELLED" } },
      select: {
        estimatedCost: true, actualCost: true, status: true,
        items: { select: { unitPrice: true, receivedQuantity: true, materialId: true, material: { select: { category: { select: { name: true } } } } } },
      },
    }),
  ]);

  // ── Statistika bazë ──
  const totalRequests = requests.length;
  const totalItems = items.length;
  const totalSpend = Math.round(orders.reduce((s, o) => s + o.actualCost, 0) * 100) / 100;
  const pipelineSpend = Math.round(orders.filter(o => o.status !== "RECEIVED").reduce((s, o) => s + o.estimatedCost, 0) * 100) / 100;

  const decided = requests.filter(r => r.reviewedAt && r.submittedAt);
  const avgApprovalHours = decided.length
    ? Math.round(
        (decided.reduce((s, r) => s + (new Date(r.reviewedAt!).getTime() - new Date(r.submittedAt!).getTime()), 0) / decided.length) / 3_600_000 * 10
      ) / 10
    : null;

  // ── Shpërndarja sipas statusit ──
  const statusCounts = new Map<string, number>();
  for (const r of requests) statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  const statusBreakdown = [...statusCounts.entries()].map(([status, count]) => ({ status, count }));

  // ── Kërkesat sipas muajit (12 muajt e fundit, përfshirë muajt me 0) ──
  const now = new Date();
  const monthBuckets: { key: string; label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTH_NAMES[d.getMonth()], count: 0 });
  }
  const bucketByKey = new Map(monthBuckets.map(b => [b.key, b]));
  for (const r of requests) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketByKey.get(key);
    if (bucket) bucket.count++;
  }

  // ── Top 10 materialet më të kërkuara ──
  const materialCounts = new Map<string, { name: string; requestCount: number; totalQuantity: number }>();
  for (const it of items) {
    const key = it.isCustom ? `custom:${it.customItemName}` : `mat:${it.materialId}`;
    const name = it.isCustom ? `${it.customItemName} (i veçantë)` : (it.material?.name ?? "—");
    const cur = materialCounts.get(key) ?? { name, requestCount: 0, totalQuantity: 0 };
    cur.requestCount++;
    cur.totalQuantity += it.quantity;
    materialCounts.set(key, cur);
  }
  const topMaterials = [...materialCounts.values()].sort((a, b) => b.requestCount - a.requestCount).slice(0, 10);

  // ── Shpenzimi sipas kategorisë (bazuar te sasia e pranuar × çmimi/njësi) ──
  const categorySpend = new Map<string, number>();
  for (const o of orders) {
    for (const it of o.items) {
      if (!it.materialId || !it.unitPrice || !it.receivedQuantity) continue;
      const cat = it.material?.category.name ?? "Pa kategori";
      categorySpend.set(cat, (categorySpend.get(cat) ?? 0) + it.unitPrice * it.receivedQuantity);
    }
  }
  const categorySpendList = [...categorySpend.entries()]
    .map(([category, spend]) => ({ category, spend: Math.round(spend * 100) / 100 }))
    .sort((a, b) => b.spend - a.spend);

  // ── Top mësimdhënëset sipas numrit të kërkesave ──
  const teacherCounts = new Map<number, { name: string; count: number }>();
  for (const r of requests) {
    const cur = teacherCounts.get(r.teacherId) ?? { name: r.teacher.name, count: 0 };
    cur.count++;
    teacherCounts.set(r.teacherId, cur);
  }
  const topTeachers = [...teacherCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return NextResponse.json({
    totalRequests, totalItems, totalSpend, pipelineSpend, avgApprovalHours,
    statusBreakdown, monthlyRequests: monthBuckets,
    topMaterials, categorySpend: categorySpendList, topTeachers,
  });
}
