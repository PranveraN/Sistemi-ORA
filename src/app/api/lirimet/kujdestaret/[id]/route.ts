import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { adminLirimi, ROLE_KUJDESTARE } from "@/lib/lirimiAuth";
import { normPhone } from "@/lib/lirimi";

// Ndrysho klasën / telefonin / fjalëkalimin, ose çaktivizo llogarinë e kujdestares.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const id = parseInt((await params).id);
  const kk = await prisma.kujdestareKlasa.findFirst({ where: { id, organizationId: a.orgId } });
  if (!kk) return NextResponse.json({ error: "Nuk u gjet." }, { status: 404 });
  const user = await prisma.user.findUnique({ where: { id: kk.userId } });
  if (!user || user.role !== ROLE_KUJDESTARE) return NextResponse.json({ error: "Llogaria nuk është kujdestare." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const kkData: { classId?: number; telefoni?: string | null } = {};
  if (b.classId !== undefined) {
    const classId = parseInt(String(b.classId));
    if (!(await prisma.class.findFirst({ where: { id: classId, organizationId: a.orgId } }))) return NextResponse.json({ error: "Klasa nuk u gjet." }, { status: 400 });
    kkData.classId = classId;
  }
  if (b.telefoni !== undefined) kkData.telefoni = normPhone(String(b.telefoni)) || null;
  const userData: { name?: string; active?: boolean; password?: string } = {};
  if (typeof b.emri === "string" && b.emri.trim()) userData.name = b.emri.trim();
  if (typeof b.aktive === "boolean") userData.active = b.aktive;
  if (typeof b.password === "string" && b.password) {
    if (b.password.length < 6) return NextResponse.json({ error: "Fjalëkalimi duhet të ketë të paktën 6 shenja." }, { status: 400 });
    userData.password = await bcrypt.hash(b.password, 10);
  }
  if (Object.keys(kkData).length) await prisma.kujdestareKlasa.update({ where: { id }, data: kkData });
  if (Object.keys(userData).length) await prisma.user.update({ where: { id: user.id }, data: userData });
  return NextResponse.json({ ok: true });
}
