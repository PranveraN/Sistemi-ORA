import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Kërkon shumë emra njëherësh mes nxënësve EKZISTUES (aktivë) — përdoret nga
// "Ngjit Listë" te karta "Nxënës të Rinj". Asnjë nxënës s'krijohet këtu,
// vetëm gjenden ata ekzistues për t'i "shfaqur" më pas (shih bulk-add-new).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entries: { firstName: string; lastName: string }[] = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) return NextResponse.json({ message: "Lista është bosh." }, { status: 400 });

  const orConditions = entries
    .filter(e => e.firstName?.trim() && e.lastName?.trim())
    .map(e => ({ firstName: { contains: e.firstName.trim() }, lastName: { contains: e.lastName.trim() } }));

  const candidates = orConditions.length > 0
    ? await prisma.student.findMany({
        where: { status: "ACTIVE", OR: orConditions },
        select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
      })
    : [];

  const results = entries.map((e, index) => {
    const fn = (e.firstName || "").trim().toLowerCase();
    const ln = (e.lastName || "").trim().toLowerCase();
    const matches = candidates.filter(c =>
      c.firstName.toLowerCase().includes(fn) && c.lastName.toLowerCase().includes(ln)
    );
    return {
      index,
      firstName: e.firstName,
      lastName: e.lastName,
      matches: matches.map(m => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, className: m.class?.name ?? null })),
    };
  });

  return NextResponse.json({ results });
}
