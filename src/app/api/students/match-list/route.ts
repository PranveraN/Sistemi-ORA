import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Heq theksat shqip (ë->e, ç->c) + rastin madh/vogël + hapësira ekstra —
// LIKE i SQLite (përdorur më parë këtu për para-filtrim) s'i njeh saktë
// shkronjat shqipe për madh/vogël, ndaj emra të vlefshëm humbisnin ("S'u
// gjet" edhe kur nxënësi ekzistonte). Përputhja tani bëhet tërësisht në JS,
// mbi normalizimin, jo në SQL.
function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Kërkon shumë emra njëherësh mes nxënësve EKZISTUES (aktivë) — përdoret nga
// "Ngjit Listë" te karta "Nxënës të Rinj". Asnjë nxënës s'krijohet këtu,
// vetëm gjenden ata ekzistues për t'i "shfaqur" më pas (shih bulk-add-new).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entries: { firstName: string; lastName: string }[] = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) return NextResponse.json({ message: "Lista është bosh." }, { status: 400 });

  const allActive = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
  });
  const normalizedActive = allActive.map(c => ({ ...c, nFirst: normalizeName(c.firstName), nLast: normalizeName(c.lastName) }));

  const results = entries.map((e, index) => {
    const fn = normalizeName(e.firstName || "");
    const ln = normalizeName(e.lastName || "");
    const matches = fn && ln
      ? normalizedActive.filter(c => c.nFirst.includes(fn) && c.nLast.includes(ln))
      : [];
    return {
      index,
      firstName: e.firstName,
      lastName: e.lastName,
      matches: matches.map(m => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, className: m.class?.name ?? null })),
    };
  });

  return NextResponse.json({ results });
}
