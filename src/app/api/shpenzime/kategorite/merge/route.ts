import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Bashkon dy kategori shpenzimesh: zhvendos gjithë shpenzimet e "source" te "target",
// pastaj fshin "source" (tashmë bosh). Ndryshe nga DELETE e zakonshme, KURRË nuk fshin
// asnjë shpenzim — vetëm i rikategorizon.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sourceId = parseInt(body.sourceId);
  const targetId = parseInt(body.targetId);
  if (!sourceId || !targetId || sourceId === targetId) {
    return NextResponse.json({ error: "Zgjedh dy kategori të ndryshme" }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.shpenzimKategori.findUnique({ where: { id: sourceId } }),
    prisma.shpenzimKategori.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) return NextResponse.json({ error: "Kategoria nuk u gjet" }, { status: 404 });

  const { count } = await prisma.shpenzim.updateMany({
    where: { kategoriId: sourceId },
    data: { kategoriId: targetId },
  });
  await prisma.shpenzimKategori.delete({ where: { id: sourceId } });

  await logAction(session, "UPDATE", "ShpenzimKategori", targetId,
    `Bashkoi kategorinë "${source.emri}" (${count} shpenzime) me "${target.emri}"`);

  return NextResponse.json({ success: true, movedCount: count });
}
