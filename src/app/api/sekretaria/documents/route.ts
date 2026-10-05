import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { DOC_TYPES } from "@/lib/sekretariaConstants";
import { invalidateSekretariaSummary } from "@/lib/sekretariaSummary";

// Regjistron në arkiv (DocArchive) një dokument të printuar nga Sekretaria —
// vërtetimet dhe kontratat. Best-effort nga klienti: printimi s'varet nga kjo.
// Me lejen "sekretaria" (jo "arkiva"), që një sekretare pa qasje në Arkivë
// t'i ketë dokumentet e veta të regjistruara.
const LOGGABLE = new Set(["VERTETIM_NXENES", "VERTETIM_MESIMDHENES", "VERTETIM_ASISTENTE", "KONTRATE_NXENES", "KONTRATE_MESIMDHENES"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "");
  const personName = String(body.personName ?? "").trim();
  if (!LOGGABLE.has(type) || !personName) return NextResponse.json({ error: "Të dhëna të pavlefshme." }, { status: 400 });

  const doc = await prisma.docArchive.create({
    data: {
      type,
      studentId: parseInt(String(body.studentId ?? "")) || null,
      staffId: parseInt(String(body.staffId ?? "")) || null,
      studentName: personName.slice(0, 200),
      className: body.className ? String(body.className).slice(0, 50) : null,
      data: JSON.stringify(body.data ?? {}),
      generatedBy: (session.user as { name?: string | null }).name ?? null,
    },
    select: { id: true },
  });
  invalidateSekretariaSummary(orgId);
  return NextResponse.json({ id: doc.id, label: DOC_TYPES[type].label }, { status: 201 });
}
