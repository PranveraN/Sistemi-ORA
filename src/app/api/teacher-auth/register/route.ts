import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Fjalëkalimi duhet të ketë të paktën 6 shkronja/numra" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ky email është përdorur tashmë. Provo të kyçesh." }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  // Llogaria krijohet JOAKTIVE — dikush që gjen këtë faqe publike mund të
  // regjistrohet me çfarëdo emri/emaili (madje edhe duke zgjedhur emrin e
  // një stafi tjetër ekzistues, pasi emri vjen nga një dropdown, jo verifikim
  // identiteti). Admini duhet ta aktivizojë manualisht nga Cilësimet →
  // Përdoruesit para se llogaria të mund të kyçet fare.
  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "TEACHER",
      active: false,
      organizationId: 1,
    },
  });

  return NextResponse.json({ success: true, pending: true });
}
