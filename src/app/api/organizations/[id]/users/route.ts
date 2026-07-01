import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orgId = parseInt(id);
  const { name, email, password, role } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email dhe fjalëkalimi janë të detyrueshme" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ky email ekziston tashmë" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      name: name || email.split("@")[0],
      email,
      password: await bcrypt.hash(password, 10),
      role: role || "SECRETARY",
      organizationId: orgId,
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return NextResponse.json(user, { status: 201 });
}
