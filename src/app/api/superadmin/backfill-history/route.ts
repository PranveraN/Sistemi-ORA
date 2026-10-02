import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pendingBackfill } from "@/lib/studentHistoryBackfill";

// Rindërtimi i historikut të nxënësve nga të dhënat EKZISTUESE (vetëm Super Admin).
//   GET  → VETËM LEXIM: sa ngjarje do të krijoheshin, sipas llojit (pa shkruar asgjë)
//   POST → i krijon ato ngjarje (source = "backfill")
// Idempotent: çdo ngjarje ka `sourceKey` unik (p.sh. "payment:123"); ato që
// ekzistojnë tashmë anashkalohen, ndaj mund të ekzekutohet disa herë pa dyfishim.
// Merren vetëm të dhënat PARA ngjarjes së parë automatike — çka ndodhi pas
// saj është regjistruar tashmë nga recordStudentEvent() (s'ka dyfishim).
// S'ndryshon asnjë të dhënë tjetër — vetëm shton rreshta te StudentHistory.

async function requireSuperAdmin() {
  const session = await auth();
  if (!session) return null;
  return (session.user as { role?: string }).role === "SUPERADMIN" ? session : null;
}

export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  const { todo, byType, alreadyDone, cutoff } = await pendingBackfill();
  return NextResponse.json({ dryRun: true, toCreate: todo.length, byType, alreadyDone, cutoff: cutoff.toISOString() });
}

export async function POST() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  const { todo, byType } = await pendingBackfill();
  for (let i = 0; i < todo.length; i += 500) {
    await prisma.studentHistory.createMany({
      data: todo.slice(i, i + 500).map(r => ({ ...r, source: "backfill" })),
    });
  }
  return NextResponse.json({ created: todo.length, byType });
}
