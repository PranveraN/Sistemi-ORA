import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const s = (v: unknown) =>
  v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

// Nxënës nga "Nuk kanë blerë ende" që s'i merr librat: ruhet një shënim pa libra
// (shuma 0, status NOT_TAKEN) — del nga lista e të papaguarve dhe s'pritet pagesë.
// Hiqet me PATCH /api/librat/sales/[id] { notTaken: false } (shënimi fshihet).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { studentId, studentName, studentClass } = await req.json();
  const sid = parseInt(String(studentId));
  if (!sid || !String(studentName ?? "").trim()) return NextResponse.json({ error: "Nxënësi mungon" }, { status: 400 });

  const [row] = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`
    INSERT INTO BookSale (studentId, studentName, studentClass, totalAmount, totalCost, profit, paidAmount, balance, status, receiptNumber, saleDate, notes, createdAt, updatedAt)
    VALUES (${sid}, ${s(String(studentName).trim())}, ${s(studentClass)}, 0, 0, 0, 0, 0, 'NOT_TAKEN', NULL, datetime('now'), 'Nuk i merr librat', datetime('now'), datetime('now'))
    RETURNING id
  `);
  await logAction(session, "CREATE", "BookSale", Number(row.id), `Shënoi 'Nuk i merr librat' për ${String(studentName).trim()}`);
  return NextResponse.json({ id: Number(row.id) }, { status: 201 });
}
