import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const CLASS_STRUCTURE = [
  "1A","1B","2A","2B","3A","3B","4A","4B",
  "5A","5B","6A","6B","7A","7B","8A","8B","9A","9B",
];

// "Konfigurim automatik (1A–9B)" — VERSION I SIGURT: krijon VETËM klasat që
// mungojnë nga struktura standarde. S'fshin dhe s'ndryshon asnjë klasë
// ekzistuese (ruhen mësuesit, kapacitetet, statusi aktiv/joaktiv dhe lidhjet
// me nxënësit, aplikimet dhe kërkesat e materialeve). Versioni i mëparshëm i
// fshinte TË GJITHA klasat dhe i rikrijonte, duke humbur këto të dhëna.
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role === "PEDAGOGIA") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const existing = await prisma.class.findMany({ where: { organizationId: orgId }, select: { name: true } });
  const have = new Set(existing.map(c => c.name.trim().toUpperCase()));
  const missing = CLASS_STRUCTURE.filter(n => !have.has(n));

  for (const name of missing) {
    await prisma.class.create({ data: { name, level: `Klasa ${name[0]}`, organizationId: orgId } });
  }

  if (missing.length) {
    await logAction(session, "CREATE", "Class", null,
      `Konfigurim automatik: u krijuan ${missing.length} klasa që mungonin (${missing.join(", ")})`);
  }

  return NextResponse.json({
    classesCreated: missing.length,
    created: missing,
    alreadyExisting: CLASS_STRUCTURE.length - missing.length,
  });
}
