import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    include: { users: { select: { id: true, name: true, email: true, role: true, active: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, slug, adminEmail, adminName, adminPassword, plan } = await req.json();

  if (!name || !slug || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: "Mungojnë të dhënat" }, { status: 400 });
  }

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Ky slug ekziston tashmë" }, { status: 400 });
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      plan: plan || "trial",
      users: {
        create: {
          email: adminEmail,
          name: adminName || `Admin ${name}`,
          password: await bcrypt.hash(adminPassword, 10),
          role: "ADMIN",
        },
      },
    },
    include: { users: true },
  });

  return NextResponse.json(org, { status: 201 });
}
