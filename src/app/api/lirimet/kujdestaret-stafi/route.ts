import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminLirimi } from "@/lib/lirimiAuth";

// Kujdestarët nga Stafi (pa llogari): një anëtar i stafit për klasë. Telefoni lexohet
// gjithmonë nga Stafi — ndryshohet vetëm aty. Stafi s'preket nga ky modul.
export async function GET() {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const [lidhjet, stafi] = await Promise.all([
    prisma.lirimKujdestar.findMany({ where: { organizationId: a.orgId } }),
    prisma.staff.findMany({ where: { status: "ACTIVE" }, select: { id: true, emri: true, telefoni: true, pozita: true, lenda: true }, orderBy: { emri: "asc" } }),
  ]);
  const ids = lidhjet.map(l => l.staffId).filter(id => !stafi.some(s => s.id === id));
  const teTjere = ids.length ? await prisma.staff.findMany({ where: { id: { in: ids } }, select: { id: true, emri: true, telefoni: true, pozita: true, lenda: true, status: true } }) : [];
  const klasat = await prisma.class.findMany({ where: { id: { in: lidhjet.map(l => l.classId) } }, select: { id: true, name: true } });
  return NextResponse.json({
    lidhjet: lidhjet.map(l => {
      const s = stafi.find(x => x.id === l.staffId) ?? teTjere.find(x => x.id === l.staffId);
      return { id: l.id, classId: l.classId, klasa: klasat.find(c => c.id === l.classId)?.name ?? "", staffId: l.staffId, emri: s?.emri ?? "(i fshirë)", telefoni: s?.telefoni ?? null, aktiv: !!stafi.find(x => x.id === l.staffId) };
    }).sort((x, y) => x.klasa.localeCompare(y.klasa, "sq", { numeric: true })),
    stafi,
  });
}

// Cakto (ose ndrysho) kujdestarin e një klase.
export async function POST(req: NextRequest) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const classId = parseInt(String(b.classId ?? ""));
  const staffId = parseInt(String(b.staffId ?? ""));
  if (!(await prisma.class.findFirst({ where: { id: classId, organizationId: a.orgId } }))) return NextResponse.json({ error: "Zgjidhni klasën." }, { status: 400 });
  if (!(await prisma.staff.findFirst({ where: { id: staffId, status: "ACTIVE" } }))) return NextResponse.json({ error: "Zgjidhni mësuesin nga stafi." }, { status: 400 });
  await prisma.lirimKujdestar.upsert({
    where: { classId },
    create: { classId, staffId, organizationId: a.orgId },
    update: { staffId },
  });
  return NextResponse.json({ ok: true });
}

// Hiq kujdestarin e një klase (vetëm lidhja; stafi mbetet i paprekur).
export async function DELETE(req: NextRequest) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const classId = parseInt(new URL(req.url).searchParams.get("classId") ?? "");
  await prisma.lirimKujdestar.deleteMany({ where: { classId, organizationId: a.orgId } });
  return NextResponse.json({ ok: true });
}
