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

// Kërkon shumë emra njëherësh mes nxënësve EKZISTUES — përdoret nga "Ngjit
// Listë" te "Nxënës të Rinj" (VETËM aktivë, parazgjedhje) DHE te "Largime/
// Transfere" (edhe joaktivë — `includeInactive: true`, që të gjenden edhe
// nxënës tashmë të shënuar joaktivë më herët, jashtë periudhës aktuale të
// shfaqur, dhe të "ripozicionohen" saktë në periudhën e tanishme përmes
// bulk-mark-departed). Asnjë nxënës s'krijohet këtu, vetëm gjenden ata
// ekzistues për t'i "shfaqur"/përditësuar më pas.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entries: { firstName: string; lastName: string }[] = Array.isArray(body.entries) ? body.entries : [];
  const includeInactive = body.includeInactive === true;
  if (entries.length === 0) return NextResponse.json({ message: "Lista është bosh." }, { status: 400 });

  const allActive = await prisma.student.findMany({
    where: includeInactive ? {} : { status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, status: true, class: { select: { name: true } } },
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
      matches: matches.map(m => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, className: m.class?.name ?? null, status: m.status })),
    };
  });

  return NextResponse.json({ results });
}
