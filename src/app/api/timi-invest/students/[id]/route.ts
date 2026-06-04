import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const student = await prisma.timiInvestStudent.update({
    where: { id: parseInt(id) },
    data: {
      firstName:    body.firstName    !== undefined ? body.firstName                        : undefined,
      lastName:     body.lastName     !== undefined ? body.lastName                         : undefined,
      parentName:   body.parentName   !== undefined ? body.parentName                       : undefined,
      parentPhone:  body.parentPhone  !== undefined ? body.parentPhone                      : undefined,
      regularPrice: body.regularPrice !== undefined ? parseFloat(body.regularPrice)         : undefined,
      discountPct:   body.discountPct   !== undefined ? parseFloat(body.discountPct)          : undefined,
      manualDiscAmt: body.manualDiscAmt !== undefined ? parseFloat(body.manualDiscAmt)        : undefined,
      notes:        body.notes        !== undefined ? body.notes                            : undefined,
      active:       body.active       !== undefined ? body.active                           : undefined,
    },
  });
  return NextResponse.json(student);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.timiInvestStudent.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
