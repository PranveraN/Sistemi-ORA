import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logTimi, type TimiAuditEntry } from "@/lib/timiAudit";

// Ndryshimi i fazës për një ose disa fëmijë TIMI (Pasqyra: rresht, të zgjedhurit, ose
// "Rregullo fazat sipas pagesave"). POST { ndryshime: [{ tiId, stage }], arsye? }
// Prek VETËM TimiInvestStudent.stage — asnjë pagesë. Çdo ndryshim → TimiAuditLog, në një transaksion.
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];
const STAGES = ["PROFATURE", "NE_PROCES", "KRYER", "PEZULLUAR", "ANULUAR"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id?: string; name?: string | null; role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const list: { tiId: number; stage: string }[] = Array.isArray(b.ndryshime) ? b.ndryshime : [];
  if (!list.length || list.length > 500) return NextResponse.json({ error: "S'ka ndryshime." }, { status: 400 });
  if (list.some(x => !Number.isInteger(x.tiId) || !STAGES.includes(x.stage))) return NextResponse.json({ error: "Fazë e pavlefshme." }, { status: 400 });
  const arsye = typeof b.arsye === "string" && b.arsye.trim() ? b.arsye.trim().slice(0, 500) : null;
  const orgId = u.organizationId ?? 1, actor = { id: parseInt(u.id ?? "") || null, name: u.name ?? null };

  const ndryshuar = await prisma.$transaction(async tx => {
    const links = await tx.timiInvestStudent.findMany({ where: { id: { in: list.map(x => x.tiId) } }, select: { id: true, stage: true, studentId: true } });
    const entries: TimiAuditEntry[] = [];
    for (const x of list) {
      const l = links.find(k => k.id === x.tiId);
      if (!l || l.stage === x.stage) continue;
      await tx.timiInvestStudent.update({ where: { id: l.id }, data: { stage: x.stage } });
      entries.push({ action: "UPDATE", entity: "TimiInvestStudent", entityId: l.id, tiId: l.id, studentId: l.studentId, field: "stage", oldValue: l.stage, newValue: x.stage, reason: arsye });
    }
    await logTimi(tx, orgId, actor, entries);
    return entries.length;
  });
  return NextResponse.json({ ok: true, ndryshuar });
}
