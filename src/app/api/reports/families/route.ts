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

  // Gjenero një çelës familje për secilin nxënës
  function familyKey(s: typeof students[0]): string {
    // Prioritet: baba, pastaj nënë, pastaj parentPhone
    if (s.fatherName && s.fatherPhone)
      return `F:${s.fatherName.trim().toLowerCase()}|${s.fatherPhone.trim()}`;
    if (s.motherName && s.motherPhone)
      return `M:${s.motherName.trim().toLowerCase()}|${s.motherPhone.trim()}`;
    if (s.fatherPhone)
      return `FP:${s.fatherPhone.trim()}`;
    if (s.motherPhone)
      return `MP:${s.motherPhone.trim()}`;
    if (s.parentPhone)
      return `PP:${s.parentPhone.trim()}`;
    // Nuk ka info prindi — familje e vetme
    return `SOLO:${s.id}`;
  }

  const map = new Map<string, typeof students>();
  for (const s of students) {
    const k = familyKey(s);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }

  const families = Array.from(map.values())
    .map(members => {
      const first = members[0];
      const fatherName = first.fatherName || null;
      const motherName = first.motherName || first.parentName || null;
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
      const totalPaid = children.reduce((s, c) => s + c.paid, 0);
      const totalDebt = children.reduce((s, c) => s + c.debt, 0);

      return {
        lastName,
        fatherName,
        motherName,
        phone,
        childCount: members.length,
        children,
        totalFinalPrice,
        totalPaid,
        totalDebt,
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "sq"));

  return NextResponse.json({ families, basePrice });
}
