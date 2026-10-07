import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // "Rikthe" një shpenzim të fshirë (fshirje logjike)
  if (body.restore === true) {
    await prisma.shpenzim.update({ where: { id: parseInt(id) }, data: { deletedAt: null, deletedById: null, deletedByName: null } });
    await logAction(session, "UPDATE", "Shpenzim", parseInt(id), "Riktheu shpenzimin e fshirë");
    return NextResponse.json({ success: true });
  }

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

  // Fshirje logjike: rreshti mbetet në databazë (me kush/kur), vetëm s'shfaqet e s'llogaritet më
  const { id } = await params;
  const user = session.user as { id?: string; name?: string | null };
  const row = await prisma.shpenzim.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), deletedById: parseInt(user.id ?? "") || null, deletedByName: user.name ?? null },
  });
  await logAction(session, "DELETE", "Shpenzim", row.id, `Fshiu (logjikisht) shpenzimin ${row.shuma.toFixed(2)} € — ${row.pershkrim ?? ""}`);
  return NextResponse.json({ success: true });
}
