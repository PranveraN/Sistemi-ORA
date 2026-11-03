import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emriNxenesit, lexoVendimToken, logLirim, njoftoPrindin } from "@/lib/lirimi";

// Kujdestari nga Stafi (pa llogari) e hap linkun nga SMS-ja: sheh kërkesën dhe vendos.
// Linku vlen vetëm nëse është ende kujdestar i klasës së kërkesës.
async function load(token: string) {
  const t = lexoVendimToken(token);
  if (!t) return null;
  const k = await prisma.lirimKerkese.findUnique({ where: { id: t.kerkeseId } });
  if (!k || !k.classId) return null;
  const lidhja = await prisma.lirimKujdestar.findFirst({ where: { classId: k.classId, staffId: t.staffId } });
  if (!lidhja) return null;
  const staff = await prisma.staff.findUnique({ where: { id: t.staffId }, select: { id: true, emri: true } });
  return staff ? { k, staff } : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const r = await load((await params).token);
  if (!r) return NextResponse.json({ error: "Linku nuk është i vlefshëm." }, { status: 404 });
  const { emri, klasa } = await emriNxenesit(r.k.studentId);
  const { k } = r;
  return NextResponse.json({
    id: k.id, emri, klasa, data: k.data, ora: k.ora, arsyeja: k.arsyeja, shpjegim: k.shpjegim,
    marresEmri: k.marresEmri, marresLidhja: k.marresLidhja, telefoni: k.telefoni,
    statusi: k.statusi, arsyeRefuzimi: k.arsyeRefuzimi, vendosiEmri: k.vendosiEmri, vendosurAt: k.vendosurAt,
    createdAt: k.createdAt, kujdestari: r.staff.emri,
  });
}

// Aprovo / Refuzo — vetëm një herë (pasi vendoset, vetëm administrata mund ta ndryshojë).
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const r = await load((await params).token);
  if (!r) return NextResponse.json({ error: "Linku nuk është i vlefshëm." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const veprimi = String(b.veprimi ?? "");
  const arsye = String(b.arsye ?? "").trim().slice(0, 300);
  if (veprimi !== "APROVO" && veprimi !== "REFUZO") return NextResponse.json({ error: "Veprim i pavlefshëm." }, { status: 400 });
  if (veprimi === "REFUZO" && arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen e refuzimit." }, { status: 400 });

  const statusi = veprimi === "APROVO" ? "APROVUAR" : "REFUZUAR";
  const upd = await prisma.lirimKerkese.updateMany({
    where: { id: r.k.id, statusi: "NE_PRITJE" },
    data: { statusi, arsyeRefuzimi: statusi === "REFUZUAR" ? arsye : null, vendosiId: null, vendosiEmri: r.staff.emri, vendosurAt: new Date() },
  });
  if (!upd.count) return NextResponse.json({ error: "Kjo kërkesë është vendosur ose anuluar tashmë." }, { status: 409 });

  await logLirim(r.k.id, statusi === "APROVUAR" ? "APROVIM" : "REFUZIM", statusi === "REFUZUAR" ? `Arsyeja: ${arsye}` : null, `${r.staff.emri} (kujdestar, nga linku i SMS-së)`);
  const k = await prisma.lirimKerkese.findUnique({ where: { id: r.k.id } });
  if (k) await njoftoPrindin(k);
  return NextResponse.json({ ok: true, statusi });
}
