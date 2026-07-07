import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const s = (v: unknown) =>
  v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

function safeRow(r: Record<string, unknown>) {
  return {
    ...r,
    id: Number(r.id), studentId: r.studentId != null ? Number(r.studentId) : null,
    totalAmount: Number(r.totalAmount), totalCost: Number(r.totalCost),
    profit: Number(r.profit), paidAmount: Number(r.paidAmount), balance: Number(r.balance),
    itemCount: Number(r.itemCount ?? 0),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page   = parseInt(searchParams.get("page") || "1");
  const limit  = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  if (status) where += ` AND bs.status='${status}'`;
  if (search) where += ` AND bs.studentName LIKE '%${search.replace(/'/g, "''")}%'`;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT bs.*, COUNT(bsi.id) as itemCount
    FROM BookSale bs
    LEFT JOIN BookSaleItem bsi ON bsi.saleId = bs.id
    ${where}
    GROUP BY bs.id
    ORDER BY bs.saleDate DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  const [{ total }] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COUNT(*) as total FROM BookSale bs ${where}`
  );

  return NextResponse.json({ sales: rows.map(safeRow), total: Number(total) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { studentId, studentName, studentClass, items, paidAmount, method, notes, saleDate } = body;

  if (!items?.length) return NextResponse.json({ error: "Asnjë libër" }, { status: 400 });

  // Merr produktet nga DB
  const ids = items.map((i: { productId: number }) => i.productId).join(",");
  const products = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM BookProduct WHERE id IN (${ids})`
  );

  // Shitjet e regjistruara për data të kaluara (p.sh. rakordim historik) nuk e kufizojnë
  // stokun aktual — vetëm shitjet e ditës së sotme validohen kundrejt stokut në kohë reale.
  const isBackdated = saleDate && new Date(saleDate).toDateString() !== new Date().toDateString();

  let totalAmount = 0, totalCost = 0;
  const saleItems: { productId: number; quantity: number; buyPrice: number; sellPrice: number; total: number; profit: number }[] = [];

  for (const item of items) {
    const prod = products.find((p: Record<string, unknown>) => Number(p.id) === item.productId);
    if (!prod) continue;
    const qty  = parseInt(item.quantity);
    const buy  = Number(prod.buyPrice);
    const sell = item.sellPrice ? parseFloat(item.sellPrice) : Number(prod.sellPrice);
    if (!isBackdated && Number(prod.stock) < qty)
      return NextResponse.json({ error: `Stoku i pamjaftueshëm për "${prod.name}". Disponibël: ${prod.stock}` }, { status: 400 });
    totalAmount += sell * qty;
    totalCost   += buy  * qty;
    saleItems.push({ productId: Number(prod.id), quantity: qty, buyPrice: buy, sellPrice: sell, total: sell * qty, profit: (sell - buy) * qty });
  }

  const profit  = totalAmount - totalCost;
  const paid    = parseFloat(paidAmount || "0");
  const balance = Math.max(0, totalAmount - paid);
  const status  = paid >= totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";

  // Numri i faturës
  const [{ cnt }] = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(*) as cnt FROM BookSale`);
  const receiptNumber = `LIB-${new Date().getFullYear()}-${String(Number(cnt) + 1).padStart(4, "0")}`;

  const [newSale] = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`
    INSERT INTO BookSale (studentId, studentName, studentClass, totalAmount, totalCost, profit, paidAmount, balance, status, receiptNumber, saleDate, notes, createdAt, updatedAt)
    VALUES (${studentId ? Number(studentId) : "NULL"}, ${s(studentName)}, ${s(studentClass)}, ${totalAmount}, ${totalCost}, ${profit}, ${paid}, ${balance}, ${s(status)}, ${s(receiptNumber)}, ${saleDate ? s(saleDate) : "datetime('now')"}, ${s(notes)}, datetime('now'), datetime('now'))
    RETURNING id
  `);
  const saleId = Number(newSale.id);

  for (const item of saleItems) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO BookSaleItem (saleId, productId, quantity, buyPrice, sellPrice, total, profit)
      VALUES (${saleId}, ${item.productId}, ${item.quantity}, ${item.buyPrice}, ${item.sellPrice}, ${item.total}, ${item.profit})
    `);
    await prisma.$executeRawUnsafe(
      `UPDATE BookProduct SET stock = stock - ${item.quantity}, updatedAt=datetime('now') WHERE id = ${item.productId}`
    );
  }

  if (paid > 0) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO BookPayment (saleId, amount, method, paidAt, createdAt)
      VALUES (${saleId}, ${paid}, ${s(method||"CASH")}, datetime('now'), datetime('now'))
    `);
  }

  return NextResponse.json({ id: saleId, receiptNumber }, { status: 201 });
}
