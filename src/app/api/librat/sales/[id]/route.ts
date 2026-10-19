import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordPaymentEvent } from "@/lib/studentHistory";
import { logAction } from "@/lib/audit";

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
  const { addPayment, method, notTaken } = await req.json();

  // "Nuk i merr librat": s'pritet pagesë — borxhi 0, s'llogaritet te të hyrat,
  // librat kthehen në stok. Lejohet vetëm kur s'është paguar asgjë. Kthehet mbrapsht me notTaken:false.
  if (typeof notTaken === "boolean") {
    const [sale] = await prisma.$queryRawUnsafe<{ totalAmount: number; paidAmount: number; status: string; studentId: number | null }[]>(
      `SELECT totalAmount, paidAmount, status, studentId FROM BookSale WHERE id=${sid}`
    );
    if (!sale) return NextResponse.json({ error: "Shitja nuk u gjet" }, { status: 404 });
    const items = await prisma.$queryRawUnsafe<{ productId: number; quantity: number }[]>(
      `SELECT productId, quantity FROM BookSaleItem WHERE saleId=${sid}`
    );
    if (notTaken && sale.status !== "NOT_TAKEN") {
      const [{ cnt }] = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(*) as cnt FROM BookPayment WHERE saleId=${sid}`);
      if (Number(sale.paidAmount) > 0 || Number(cnt) > 0) {
        return NextResponse.json({ error: "Kjo shitje ka pagesë — s'mund të shënohet 'Nuk i merr'." }, { status: 400 });
      }
      for (const it of items) {
        await prisma.$executeRawUnsafe(`UPDATE BookProduct SET stock = stock + ${Number(it.quantity)}, updatedAt=datetime('now') WHERE id=${Number(it.productId)}`);
      }
      await prisma.$executeRawUnsafe(`UPDATE BookSale SET status='NOT_TAKEN', balance=0, updatedAt=datetime('now') WHERE id=${sid}`);
      await logAction(session, "UPDATE", "BookSale", sid, `Shënoi 'Nuk i merr librat' (shitja #${sid}) — librat u kthyen në stok, s'pritet pagesë`);
    } else if (!notTaken && sale.status === "NOT_TAKEN") {
      if (items.length === 0) {
        // Shënim pa libra (nxënës që s'bleu kurrë) → fshihet, nxënësi kthehet te "Nuk kanë blerë ende"
        await prisma.$executeRawUnsafe(`DELETE FROM BookSale WHERE id=${sid}`);
      } else {
        for (const it of items) {
          await prisma.$executeRawUnsafe(`UPDATE BookProduct SET stock = stock - ${Number(it.quantity)}, updatedAt=datetime('now') WHERE id=${Number(it.productId)}`);
        }
        await prisma.$executeRawUnsafe(`UPDATE BookSale SET status='PENDING', balance=${Number(sale.totalAmount)}, updatedAt=datetime('now') WHERE id=${sid}`);
      }
      await logAction(session, "UPDATE", "BookSale", sid, `Hoqi 'Nuk i merr librat' (shitja #${sid})`);
    }
    return NextResponse.json({ ok: true });
  }

  if (addPayment > 0) {
    const [cur] = await prisma.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM BookSale WHERE id=${sid}`);
    if (cur?.status === "NOT_TAKEN") {
      return NextResponse.json({ error: "Kjo shitje është shënuar 'Nuk i merr librat' — hiqe shënimin para se të regjistrosh pagesë." }, { status: 400 });
    }
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
    const owner = await prisma.bookSale.findUnique({ where: { id: sid }, select: { studentId: true } });
    await recordPaymentEvent(session, { studentId: owner?.studentId, categoryName: "Librat e anglishtes", paidBefore: 0, paidAfter: parseFloat(addPayment), method: method || "CASH" });
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
