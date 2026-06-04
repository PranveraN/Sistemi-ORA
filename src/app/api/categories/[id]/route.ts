import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const cat = await prisma.paymentCategory.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.name        !== undefined && { name:          body.name }),
      ...(body.description !== undefined && { description:   body.description || null }),
      ...(body.type        !== undefined && { type:          body.type }),
      ...(body.defaultAmount !== undefined && { defaultAmount: parseFloat(body.defaultAmount) }),
    },
  });

  return NextResponse.json(cat);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.paymentCategory.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
