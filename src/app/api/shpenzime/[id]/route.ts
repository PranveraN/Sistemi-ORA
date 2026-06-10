import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  await prisma.shpenzim.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.kategoriId != null ? { kategoriId: parseInt(body.kategoriId) } : {}),
      ...(body.shuma      != null ? { shuma: parseFloat(body.shuma) }         : {}),
      ...(body.data       != null ? { data: new Date(body.data) }             : {}),
      ...(body.docType    != null ? { docType: body.docType }                 : {}),
      ...(body.lloji      != null ? { lloji: body.lloji }                     : {}),
      pershkrim:    body.pershkrim    ?? null,
      marres:       body.marres       ?? null,
      metoda:       body.metoda       ?? null,
      referenca:    body.referenca    ?? null,
      nrFature:     body.nrFature     ?? null,
      emriBiznesit: body.emriBiznesit ?? null,
      nrFiskal:     body.nrFiskal     ?? null,
      ...(body.paguar !== undefined ? { paguar: body.paguar !== false } : {}),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.shpenzim.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
