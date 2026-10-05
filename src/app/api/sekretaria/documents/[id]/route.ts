import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { DOC_TYPES } from "@/lib/sekretariaConstants";

// Një dokument i arkivit për ta riprintuar nga moduli i vet (?archiveId=) —
// vetëm llojet e Sekretarisë, me lejen "sekretaria".
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.docArchive.findUnique({ where: { id: parseInt(id) || 0 } });
  if (!doc || !DOC_TYPES[doc.type]) return NextResponse.json({ error: "Dokumenti nuk u gjet" }, { status: 404 });
  let data: unknown = {};
  try { data = JSON.parse(doc.data); } catch { /* të dhëna të vjetra jo-JSON */ }
  return NextResponse.json({ ...doc, data });
}
