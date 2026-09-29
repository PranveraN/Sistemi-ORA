import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { role?: string };
  if (sessionUser?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Vetëm Super Admin mund të shtojë përdorues" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, role } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Emri, emaili dhe fjalëkalimi janë të detyrueshme" }, { status: 400 });
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere, me shkronja dhe numra" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email-i është tashmë i regjistruar" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: role || "SECRETARY", active: true },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  await logAction(session, "CREATE", "User", user.id, `Krijoi përdoruesin ${user.name} (${user.email}) — rol ${user.role}`);

  return NextResponse.json(user, { status: 201 });
}
