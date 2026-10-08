import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuditAccess } from "@/lib/audit/access";
import { entityHistory } from "@/lib/audit/history";
import { AUDITED_TABLES } from "@/lib/audit/tables";

// Historiku i ndryshimeve të një rekordi nga gjurma e auditimit.
// ?tabela=Payment&id=123  ose  ?numri=DEP-2026-0001 / FAT-2026-0003 / FAM-2026-0002
export async function GET(req: NextRequest) {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  const sp = req.nextUrl.searchParams;
  let table = sp.get("tabela") ?? "";
  let id = parseInt(sp.get("id") ?? "") || 0;
  const numri = sp.get("numri")?.trim().toUpperCase();
  let label = "";
  if (numri) {
    const [pay, inv, fam] = await Promise.all([
      prisma.payment.findFirst({ where: { receiptNumber: numri }, select: { id: true } }),
      prisma.invoice.findFirst({ where: { number: numri }, select: { id: true } }),
      prisma.familyReceipt.findFirst({ where: { receiptNumber: numri }, select: { id: true } }),
    ]);
    // Dokumenti mund të jetë fshirë — kërkohet edhe në gjurmë
    const fromLog = !pay && !inv && !fam ? await prisma.$queryRawUnsafe<{ tableName: string; recordId: number }[]>(
      `SELECT "tableName", "recordId" FROM "FinAuditLog" WHERE json_extract(COALESCE("newValues","oldValues"), '$.receiptNumber') = ? OR json_extract(COALESCE("newValues","oldValues"), '$.number') = ? ORDER BY id DESC LIMIT 1`, numri, numri) : [];
    if (pay) { table = "Payment"; id = pay.id; }
    else if (inv) { table = "Invoice"; id = inv.id; }
    else if (fam) { table = "FamilyReceipt"; id = fam.id; }
    else if (fromLog[0]) { table = fromLog[0].tableName; id = Number(fromLog[0].recordId); label = " (i fshirë)"; }
    else return NextResponse.json({ error: `S'u gjet asnjë dokument me numrin ${numri}.` }, { status: 404 });
  }
  if (!table || !id) return NextResponse.json({ error: "Zgjidhni llojin dhe ID-në, ose shkruani numrin e dokumentit." }, { status: 400 });
  const history = await entityHistory(prisma, table, id);
  return NextResponse.json({ table, id, label, history, tables: AUDITED_TABLES.map(t => t.table) });
}
