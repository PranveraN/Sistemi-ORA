import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone") || "";
  const name  = searchParams.get("name")  || "";

  if (!phone && !name) {
    return NextResponse.json({ error: "Kërko me numër telefoni ose emër prindi" }, { status: 400 });
  }

  // Gjej të gjithë nxënësit e familjes.
  // Kërkimi me emër ndahet në fjalë (p.sh. "Pranvera Shaqiri") që të gjejë edhe
  // prindër me emër të mesëm (p.sh. "Pranvera Nevzadi Shaqiri") — çdo fjalë duhet
  // të gjendet diku në parentName/fatherName/motherName, jo domosdo si frazë e vazhdueshme.
  const nameWords = name.trim().split(/\s+/).filter(Boolean);
  const where = phone
    ? {
        OR: [
          { parentPhone: { contains: phone } },
          { fatherPhone: { contains: phone } },
          { motherPhone: { contains: phone } },
        ],
      }
    : {
        AND: nameWords.map(word => ({
          OR: [
            { parentName: { contains: word } },
            { fatherName: { contains: word } },
            { motherName: { contains: word } },
          ],
        })),
      };

  const students = await prisma.student.findMany({
    where,
    include: {
      class: { select: { id: true, name: true, level: true } },
      payments: {
        include: { category: { select: { name: true, defaultAmount: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ firstName: "asc" }],
  });

  if (students.length === 0) {
    return NextResponse.json({ students: [], parent: null, families: [] });
  }

  // Merr kategorinë e shkollimit për çmimin bazë
  const shkollimi = await prisma.paymentCategory.findFirst({
    where: { name: { contains: "Shkollim" } },
  });
  const basePrice = shkollimi?.defaultAmount ?? 2000;

  // Kërkimi me emër (p.sh. mbiemri "Shaqiri") mund të përputhet me disa FAMILJE
  // krejt të ndryshme, jo domosdo vëllezër/motra. I grupojmë studentët sipas
  // familjes reale (telefon i përbashkët i prindërve) me union-find, në vend që
  // t'i trajtojmë të gjithë si "një familje" (rrezik: SMS/faturë tek prindi i gabuar).
  const normPhone = (p: string | null) => (p ? p.replace(/\D/g, "") : null);
  const parentIdx = students.map((_, i) => i);
  const find = (i: number): number => (parentIdx[i] === i ? i : (parentIdx[i] = find(parentIdx[i])));
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parentIdx[ra] = rb;
  };
  const phoneToIndices = new Map<string, number[]>();
  students.forEach((s, i) => {
    const phones = [s.parentPhone, s.fatherPhone, s.motherPhone].map(normPhone).filter(Boolean) as string[];
    for (const p of phones) {
      if (!phoneToIndices.has(p)) phoneToIndices.set(p, []);
      phoneToIndices.get(p)!.push(i);
    }
  });
  for (const idxs of phoneToIndices.values()) {
    for (let k = 1; k < idxs.length; k++) union(idxs[0], idxs[k]);
  }

  const groups = new Map<number, number[]>();
  students.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  });

  const buildFamily = (indices: number[]) => {
    const members = indices.map(i => students[i]);
    const children = members.map(s => {
      const finalPrice = Math.round(basePrice * (1 - (s.discountPct ?? 0) / 100));
      const totalPaid  = s.payments.reduce((sum, p) => sum + p.paidAmount, 0);
      const debt       = Math.max(0, finalPrice - totalPaid);

      const byCategory: Record<string, { paid: number; final: number; status: string }> = {};
      for (const p of s.payments) {
        const cat = p.category.name;
        if (!byCategory[cat]) byCategory[cat] = { paid: 0, final: 0, status: p.status };
        byCategory[cat].paid  += p.paidAmount;
        byCategory[cat].final += p.finalAmount;
      }

      return {
        id:             s.id,
        firstName:      s.firstName,
        lastName:       s.lastName,
        personalNumber: s.personalNumber,
        diaryNumber:    s.diaryNumber,
        class:          s.class,
        status:         s.status,
        enrollDate:     s.enrollDate,
        discountPct:    s.discountPct,
        finalPrice,
        totalPaid,
        debt,
        kontrata:       s.kontrata,
        byCategory,
      };
    });

    const first = members[0];
    const parent = {
      name:        first.fatherName || first.motherName || first.parentName || "—",
      fatherName:  first.fatherName,
      fatherPhone: first.fatherPhone,
      motherName:  first.motherName,
      motherPhone: first.motherPhone,
      parentPhone: first.parentPhone,
      address:     first.address,
    };

    return {
      parent,
      children,
      summary: {
        totalFinal: children.reduce((s, c) => s + c.finalPrice, 0),
        totalPaid:  children.reduce((s, c) => s + c.totalPaid, 0),
        totalDebt:  children.reduce((s, c) => s + c.debt, 0),
      },
    };
  };

  // Familjet me më shumë fëmijë të gjetur renditen të para (përputhja më e mundshme e synuar).
  const families = Array.from(groups.values())
    .map(buildFamily)
    .sort((a, b) => b.children.length - a.children.length);

  return NextResponse.json({
    // Për prapambetje: konsumatorët e vjetër që s'e kontrollojnë `families`
    // marrin automatikisht familjen me më shumë fëmijë të përputhur.
    parent:  families[0].parent,
    children: families[0].children,
    summary: families[0].summary,
    families,
    ambiguous: families.length > 1,
  });
}
