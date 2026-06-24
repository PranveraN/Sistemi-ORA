import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDateRange, getAcademicMonths, type YearType } from "@/lib/academicYear";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vit      = parseInt(searchParams.get("vit") || String(new Date().getFullYear()));
  const yearType = (searchParams.get("yearType") || "calendar") as YearType;

  const { start, end, label } = getDateRange(vit, yearType);

  const months = yearType === "academic"
    ? getAcademicMonths(vit)
    : Array.from({ length: 12 }, (_, i) => ({
        calMonth: i + 1,
        calYear:  vit,
        label:    ["Janar","Shkurt","Mars","Prill","Maj","Qershor","Korrik","Gusht","Shtator","Tetor","Nëntor","Dhjetor"][i],
      }));

  const pagesimiKat = await prisma.paymentCategory.findFirst({
    where: { name: { contains: "Shkollim" } },
  });

  const [hyratRaw, shkollimPayments, shpenzimetRaw, investimeRaw] = await Promise.all([
    prisma.hyra.findMany({
      where: { OR: months.map(m => ({ muaj: m.calMonth, vit: m.calYear })) },
      select: { muaj: true, vit: true, shuma: true },
    }),

    pagesimiKat
      ? prisma.payment.findMany({
          where: {
            categoryId: pagesimiKat.id,
            paidDate:   { gte: start, lte: end },
            paidAmount: { gt: 0 },
            status:     { in: ["PAID", "PARTIAL"] },
          },
          select: { paidAmount: true, paidDate: true },
        })
      : Promise.resolve([]),

    prisma.shpenzim.findMany({
      where: { data: { gte: start, lte: end } },
      select: { shuma: true, data: true },
    }),

    prisma.$queryRawUnsafe<{ vlera: number; tipi: string; data: string }[]>(
      `SELECT vlera, tipi, data FROM Investim WHERE data >= '${start.toISOString()}' AND data <= '${end.toISOString()}'`
    ),
  ]);

  const key = (m: number, y: number) => `${m}-${y}`;

  const hyraManMap:       Record<string, number> = {};
  const hyraShkMap:       Record<string, number> = {};
  const shpenzimMap:      Record<string, number> = {};
  const invKapitalMap:    Record<string, number> = {};
  const invPerkohshemMap: Record<string, number> = {};

  for (const h of hyratRaw) {
    const k = key(h.muaj, h.vit);
    hyraManMap[k] = (hyraManMap[k] ?? 0) + h.shuma;
  }
  for (const p of shkollimPayments) {
    if (!p.paidDate) continue;
    const d = new Date(p.paidDate);
    const k = key(d.getMonth() + 1, d.getFullYear());
    hyraShkMap[k] = (hyraShkMap[k] ?? 0) + p.paidAmount;
  }
  for (const s of shpenzimetRaw) {
    const d = new Date(s.data);
    const k = key(d.getMonth() + 1, d.getFullYear());
    shpenzimMap[k] = (shpenzimMap[k] ?? 0) + s.shuma;
  }
  for (const inv of investimeRaw) {
    const d = new Date(inv.data);
    const k = key(d.getMonth() + 1, d.getFullYear());
    if (inv.tipi === "KAPITAL") {
      invKapitalMap[k] = (invKapitalMap[k] ?? 0) + inv.vlera;
    } else {
      invPerkohshemMap[k] = (invPerkohshemMap[k] ?? 0) + inv.vlera;
    }
  }

  const muajt = months.map(m => {
    const k            = key(m.calMonth, m.calYear);
    const hyraMan      = Math.round((hyraManMap[k]       ?? 0) * 100) / 100;
    const hyraShk      = Math.round((hyraShkMap[k]       ?? 0) * 100) / 100;
    const hyra         = Math.round((hyraMan + hyraShk)   * 100) / 100;
    const shpenzim     = Math.round((shpenzimMap[k]       ?? 0) * 100) / 100;
    const invKapital   = Math.round((invKapitalMap[k]     ?? 0) * 100) / 100;
    const invPerkohshem= Math.round((invPerkohshemMap[k]  ?? 0) * 100) / 100;
    const balanca      = Math.round((hyra - shpenzim - invKapital - invPerkohshem) * 100) / 100;
    return { muaj: m.calMonth, viti: m.calYear, label: m.label, hyra, hyraMan, hyraShk, shpenzim, invKapital, invPerkohshem, balanca };
  });

  const totalHyra          = Math.round(muajt.reduce((s, m) => s + m.hyra,          0) * 100) / 100;
  const totalHyraMan       = Math.round(muajt.reduce((s, m) => s + m.hyraMan,       0) * 100) / 100;
  const totalHyraShk       = Math.round(muajt.reduce((s, m) => s + m.hyraShk,       0) * 100) / 100;
  const totalShpenzim      = Math.round(muajt.reduce((s, m) => s + m.shpenzim,      0) * 100) / 100;
  const totalInvKapital    = Math.round(muajt.reduce((s, m) => s + m.invKapital,    0) * 100) / 100;
  const totalInvPerkohshem = Math.round(muajt.reduce((s, m) => s + m.invPerkohshem, 0) * 100) / 100;
  const totalBalanca       = Math.round((totalHyra - totalShpenzim - totalInvKapital - totalInvPerkohshem) * 100) / 100;

  return NextResponse.json({
    vit, yearType, label, muajt,
    totalHyra, totalHyraMan, totalHyraShk,
    totalShpenzim,
    totalInvKapital, totalInvPerkohshem,
    totalBalanca,
  });
}
