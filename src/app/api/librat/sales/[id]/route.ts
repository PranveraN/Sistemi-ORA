import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const s = (v: unknown) =>
  v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sid = parseInt(id);

  const [sale] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM BookSale WHERE id=${sid}`
  );
  if (!sale) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  const items = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT bsi.*, bp.name as productName FROM BookSaleItem bsi
    JOIN BookProduct bp ON bp.id = bsi.productId
    WHERE bsi.saleId=${sid}
  `);
  const payments = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM BookPayment WHERE saleId=${sid} ORDER BY paidAt ASC`
  );

  return NextResponse.json({
    ...sale,
    id: Number(sale.id),
    studentId: sale.studentId != null ? Number(sale.studentId) : null,
    totalAmount: Number(sale.totalAmount), totalCost: Number(sale.totalCost),
    profit: Number(sale.profit), paidAmount: Number(sale.paidAmount), balance: Number(sale.balance),
    items: items.map(i => ({ ...i, id: Number(i.id), saleId: Number(i.saleId), productId: Number(i.productId), quantity: Number(i.quantity), buyPrice: Number(i.buyPrice), sellPrice: Number(i.sellPrice), total: Number(i.total), profit: Number(i.profit) })),
    payments: payments.map(p => ({ ...p, id: Number(p.id), saleId: Number(p.saleId), amount: Number(p.amount) })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sid = parseInt(id);
  const { addPayment, method } = await req.json();

  if (addPayment > 0) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO BookPayment (saleId, amount, method, paidAt, createdAt)
      VALUES (${sid}, ${parseFloat(addPayment)}, ${s(method||"CASH")}, datetime('now'), datetime('now'))
    `);
    const [{ total }] = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT SUM(amount) as total FROM BookPayment WHERE saleId=${sid}`
    );
    const [sale] = await prisma.$queryRawUnsafe<{ totalAmount: number }[]>(
      `SELECT totalAmount FROM BookSale WHERE id=${sid}`
    );
    const paid    = Number(total) || 0;
    const balance = Math.max(0, Number(sale.totalAmount) - paid);
    const status  = paid >= Number(sale.totalAmount) ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
    await prisma.$executeRawUnsafe(
      `UPDATE BookSale SET paidAmount=${paid}, balance=${balance}, status=${s(status)}, updatedAt=datetime('now') WHERE id=${sid}`
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sid = parseInt(id);

  // Kthe stokun
  const items = await prisma.$queryRawUnsafe<{ productId: number; quantity: number }[]>(
    `SELECT productId, quantity FROM BookSaleItem WHERE saleId=${sid}`
  );
  for (const item of items) {
    await prisma.$executeRawUnsafe(
      `UPDATE BookProduct SET stock = stock + ${item.quantity}, updatedAt=datetime('now') WHERE id=${item.productId}`
    );
  }
  await prisma.$executeRawUnsafe(`DELETE FROM BookSaleItem WHERE saleId=${sid}`);
  await prisma.$executeRawUnsafe(`DELETE FROM BookPayment WHERE saleId=${sid}`);
  await prisma.$executeRawUnsafe(`DELETE FROM BookSale WHERE id=${sid}`);
  return NextResponse.json({ ok: true });
}
