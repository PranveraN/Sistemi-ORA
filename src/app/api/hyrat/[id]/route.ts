import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const hyra = await prisma.hyra.update({
    where: { id: parseInt(id) },
    data: {
      paguesit:  body.paguesit,
      shuma:     parseFloat(body.shuma),
      muaj:      parseInt(body.muaj),
      vit:       parseInt(body.vit),
      metoda:    body.metoda    || null,
      referenca: body.referenca || null,
      shenime:   body.shenime   || null,
    },
  });

  return NextResponse.json(hyra);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.hyra.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
