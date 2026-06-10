import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const basePrice = parseFloat(searchParams.get("basePrice") || "2000");

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    include: {
      class: { select: { name: true } },
      payments: { select: { paidAmount: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // ── Union-Find ──────────────────────────────────────────────
  // Grupojmë fëmijët e së njëjtës familje duke lidhur çdo nxënës
  // me çdo nxënës tjetër që ndan të paktën NJË numër telefoni.

  const par = new Map<number, number>();
  students.forEach(s => par.set(s.id, s.id));

  function find(x: number): number {
    if (par.get(x) !== x) par.set(x, find(par.get(x)!));
    return par.get(x)!;
  }
  function union(x: number, y: number) {
    par.set(find(x), find(y));
  }

  // Mbledh të gjitha numrat e telefonit → [studentId]
  const phoneMap = new Map<string, number[]>();
  for (const s of students) {
    const phones = [s.fatherPhone, s.motherPhone, s.parentPhone]
      .filter((p): p is string => Boolean(p))
      .map(p => p.trim().replace(/\s+/g, ""));
    for (const ph of phones) {
      if (!phoneMap.has(ph)) phoneMap.set(ph, []);
      phoneMap.get(ph)!.push(s.id);
    }
  }

  // Lido nxënësit që ndajnë të njëjtin numër
  for (const ids of phoneMap.values()) {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  }

  // Grupe sipas rrënjës (familje)
  const familyMap = new Map<number, typeof students>();
  for (const s of students) {
    const root = find(s.id);
    if (!familyMap.has(root)) familyMap.set(root, []);
    familyMap.get(root)!.push(s);
  }

  const families = Array.from(familyMap.values())
    .map(members => {
      const first = members[0];
      const fatherName = members.find(m => m.fatherName)?.fatherName ?? null;
      const motherName = members.find(m => m.motherName)?.motherName
        ?? members.find(m => m.parentName)?.parentName ?? null;
      const phone = first.fatherPhone || first.motherPhone || first.parentPhone || "";
      const lastName = first.lastName;

      const children = members.map(s => {
        const finalPrice = Math.round(basePrice * (1 - (s.discountPct ?? 0) / 100));
        const paid = s.payments.reduce((sum, p) => sum + p.paidAmount, 0);
        const debt = Math.max(0, finalPrice - paid);
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          class: s.class?.name ?? "",
          discountPct: s.discountPct,
          finalPrice,
          paid,
          debt,
        };
      });

      const totalFinalPrice = children.reduce((s, c) => s + c.finalPrice, 0);
      const totalPaid       = children.reduce((s, c) => s + c.paid, 0);
      const totalDebt       = children.reduce((s, c) => s + c.debt, 0);

      return { lastName, fatherName, motherName, phone, childCount: members.length, children, totalFinalPrice, totalPaid, totalDebt };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "sq"));

  return NextResponse.json({ families, basePrice });
}
