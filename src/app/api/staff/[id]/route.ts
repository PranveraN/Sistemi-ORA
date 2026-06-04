import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const member = await prisma.staff.findUnique({ where: { id: Number(id) } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const member = await prisma.staff.update({
    where: { id: Number(id) },
    data: {
      emri:        body.emri        || "",
      telefoni:    body.telefoni    || null,
      lenda:       body.lenda       || null,
      nrPersonal:  body.nrPersonal  || null,
      nrLlogarise: body.nrLlogarise || null,
      banka:       body.banka       || null,
      totalBruto:  body.totalBruto  != null ? parseFloat(body.totalBruto) : null,
      kontrata:    body.kontrata    || null,
      kodi:        body.kodi        || null,
      tipi:        body.tipi        || null,
      status:      body.status      || "ACTIVE",
    },
  });
  return NextResponse.json(member);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.staff.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
