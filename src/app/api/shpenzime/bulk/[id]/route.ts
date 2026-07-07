import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ShpenzimSnapshot {
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
              createdAt: new Date(row.createdAt),
            },
          });
        }
      } else {
        for (const row of rows) {
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
              paguar: row.paguar,
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
