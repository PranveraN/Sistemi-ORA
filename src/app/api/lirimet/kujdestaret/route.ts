import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { adminLirimi, ROLE_KUJDESTARE } from "@/lib/lirimiAuth";
import { normPhone } from "@/lib/lirimi";

// Llogaritë e kujdestareve (rol KUJDESTARE + klasa + telefoni për SMS).
export async function GET() {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const kk = await prisma.kujdestareKlasa.findMany({ where: { organizationId: a.orgId }, orderBy: { createdAt: "asc" } });
  const [users, classes] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: kk.map(k => k.userId) } }, select: { id: true, name: true, email: true, active: true } }),
    prisma.class.findMany({ where: { id: { in: kk.map(k => k.classId) } }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json(kk.map(k => {
    const u = users.find(x => x.id === k.userId);
    return { id: k.id, userId: k.userId, emri: u?.name ?? "", email: u?.email ?? "", aktive: u?.active ?? false, classId: k.classId, klasa: classes.find(c => c.id === k.classId)?.name ?? "", telefoni: k.telefoni };
  }));
}

export async function POST(req: NextRequest) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const emri = String(b.emri ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const classId = parseInt(String(b.classId ?? ""));
  const telefoni = normPhone(String(b.telefoni ?? "")) || null;
  if (!emri || !email.includes("@")) return NextResponse.json({ error: "Shkruani emrin dhe email-in." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Fjalëkalimi duhet të ketë të paktën 6 shenja." }, { status: 400 });
  if (!(await prisma.class.findFirst({ where: { id: classId, organizationId: a.orgId } }))) return NextResponse.json({ error: "Zgjidhni klasën." }, { status: 400 });
  if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: "Ky email përdoret tashmë nga një llogari tjetër." }, { status: 409 });

  const user = await prisma.user.create({
    data: { email, name: emri, password: await bcrypt.hash(password, 10), role: ROLE_KUJDESTARE, organizationId: a.orgId },
  });
  const kk = await prisma.kujdestareKlasa.create({ data: { userId: user.id, classId, telefoni, organizationId: a.orgId } });
  return NextResponse.json({ id: kk.id }, { status: 201 });
}
