import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ShpenzimSnapshot {
  dataDokumentit?: string | null;
  id: number;
  kategoriId: number;
  shuma: number;
  pershkrim: string | null;
  marres: string | null;
  data: string;
  metoda: string | null;
  referenca: string | null;
  docType: string;
  lloji: string;
  paguar: boolean;
  nrFature: string | null;
  emriBiznesit: string | null;
  nrFiskal: string | null;
  createdAt: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bulkAction = await prisma.shpenzimBulkAction.findUnique({ where: { id: parseInt(id) } });
  if (!bulkAction) return NextResponse.json({ error: "Veprimi nuk u gjet" }, { status: 404 });
  if (bulkAction.undone) return NextResponse.json({ error: "Ky veprim është zhbërë tashmë" }, { status: 400 });

  const rows: ShpenzimSnapshot[] = JSON.parse(bulkAction.snapshot);

  try {
    await prisma.$transaction(async tx => {
      if (bulkAction.action === "DELETE") {
        for (const row of rows) {
          // Fshirje logjike → thjesht rikthehet; rreshtat e fshirë fizikisht më parë rikrijohen si dikur
          const exists = await tx.shpenzim.findUnique({ where: { id: row.id }, select: { id: true } });
          if (exists) {
            await tx.shpenzim.update({ where: { id: row.id }, data: { deletedAt: null, deletedById: null, deletedByName: null } });
            continue;
          }
          await tx.shpenzim.create({
            data: {
              id: row.id,
              kategoriId: row.kategoriId,
              shuma: row.shuma,
              pershkrim: row.pershkrim,
              marres: row.marres,
              data: new Date(row.data),
              metoda: row.metoda,
              referenca: row.referenca,
              docType: row.docType,
              lloji: row.lloji,
              paguar: row.paguar,
              nrFature: row.nrFature,
              emriBiznesit: row.emriBiznesit,
              nrFiskal: row.nrFiskal,
              dataDokumentit: row.dataDokumentit ? new Date(row.dataDokumentit) : null,
              createdAt: new Date(row.createdAt),
            },
          });
        }
      } else {
        for (const row of rows) {
          // Faturat me pagesa pjesë-pjesë: statusi "paguar" rrjedh nga pagesat — s'rikthehet nga fotografia
          const cur = await tx.shpenzim.findUnique({ where: { id: row.id }, select: { mePagesa: true, paguar: true } });
          await tx.shpenzimPagese.updateMany({ where: { shpenzimId: row.id }, data: { kategoriId: row.kategoriId } });
          await tx.shpenzim.update({
            where: { id: row.id },
            data: {
              kategoriId: row.kategoriId,
              shuma: row.shuma,
              pershkrim: row.pershkrim,
              marres: row.marres,
              data: new Date(row.data),
              metoda: row.metoda,
              referenca: row.referenca,
              docType: row.docType,
              lloji: row.lloji,
              paguar: cur?.mePagesa ? cur.paguar : row.paguar,
              nrFature: row.nrFature,
              emriBiznesit: row.emriBiznesit,
              nrFiskal: row.nrFiskal,
            },
          });
        }
      }

      await tx.shpenzimBulkAction.update({ where: { id: bulkAction.id }, data: { undone: true } });
    });

    return NextResponse.json({ success: true, restored: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
