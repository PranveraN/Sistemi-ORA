import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kujdestarja } from "@/lib/lirimiAuth";
import { logLirim, njoftoPrindin } from "@/lib/lirimi";

async function load(id: number, classId: number) {
  const r = await prisma.lirimKerkese.findUnique({ where: { id } });
  return r && r.classId === classId ? r : null;
}

// Detajet e një kërkese — vetëm nëse është e klasës së kujdestares.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const k = await kujdestarja();
  if (!k) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const r = await load(parseInt((await params).id), k.classId);
  if (!r) return NextResponse.json({ error: "Kërkesa nuk u gjet." }, { status: 404 });
  const s = await prisma.student.findUnique({ where: { id: r.studentId }, select: { firstName: true, lastName: true } });
  return NextResponse.json({ ...r, emri: s ? `${s.firstName} ${s.lastName}` : "", klasa: k.klasa });
}

// Aprovo / Refuzo — vetëm një herë (pasi vendoset, vetëm administrata mund ta ndryshojë).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const k = await kujdestarja();
  if (!k) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const id = parseInt((await params).id);
  if (!(await load(id, k.classId))) return NextResponse.json({ error: "Kërkesa nuk u gjet." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const veprimi = String(b.veprimi ?? "");
  const arsye = String(b.arsye ?? "").trim().slice(0, 300);
  if (veprimi !== "APROVO" && veprimi !== "REFUZO") return NextResponse.json({ error: "Veprim i pavlefshëm." }, { status: 400 });
  if (veprimi === "REFUZO" && arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen e refuzimit." }, { status: 400 });

  const statusi = veprimi === "APROVO" ? "APROVUAR" : "REFUZUAR";
  const upd = await prisma.lirimKerkese.updateMany({
    where: { id, classId: k.classId, statusi: "NE_PRITJE" },
    data: { statusi, arsyeRefuzimi: statusi === "REFUZUAR" ? arsye : null, vendosiId: k.userId, vendosiEmri: k.emri, vendosurAt: new Date() },
  });
  if (!upd.count) return NextResponse.json({ error: "Kjo kërkesë është vendosur ose anuluar tashmë." }, { status: 409 });

  await logLirim(id, statusi === "APROVUAR" ? "APROVIM" : "REFUZIM", statusi === "REFUZUAR" ? `Arsyeja: ${arsye}` : null, `${k.emri} (kujdestare)`, k.userId);
  const r = await prisma.lirimKerkese.findUnique({ where: { id } });
  if (r) await njoftoPrindin(r);
  return NextResponse.json({ ok: true, statusi });
}
