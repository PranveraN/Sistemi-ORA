import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

const s = (v: unknown) =>
  v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

// Kujtesë SMS borxhi për shitje librash — moduli i Librave (BookSale) s'ka
// lidhje Prisma (gjithçka raw SQL, shih routet e tjera të /librat), ndaj
// ndiqet i njëjti model këtu.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "FINANCE") {
      return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
    }

    const { id } = await params;
    const sid = parseInt(id);

    const body = await req.json();
    const phone = String(body.phone ?? "").trim();
    if (!phone) {
      return NextResponse.json({ error: "Numri i telefonit i marrësit mungon" }, { status: 400 });
    }

    const [sale] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM BookSale WHERE id=${sid}`
    );
    if (!sale) return NextResponse.json({ error: "Shitja nuk u gjet" }, { status: 404 });

    const balance = Number(sale.balance);
    if (balance <= 0) {
      return NextResponse.json({ error: "Kjo shitje s'ka borxh të papaguar" }, { status: 400 });
    }

    const items = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT bsi.quantity, bp.name as productName FROM BookSaleItem bsi
      JOIN BookProduct bp ON bp.id = bsi.productId
      WHERE bsi.saleId=${sid}
    `);
    const itemLine = items.length
      ? items.map(it => `${it.productName} x${Number(it.quantity)}`).join(", ")
      : "libra";

    const message = `Kujtesë Akademia Ora: ${sale.studentName} ka borxh ${balance.toFixed(2)}€ për ${itemLine}. Ju lutem rregulloni pagesën. Faleminderit.`;

    const result = await sendSms(phone, message);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Dërgimi dështoi" }, { status: 502 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE BookSale SET sentSmsAt=datetime('now'), sentToPhone=${s(phone)}, updatedAt=datetime('now') WHERE id=${sid}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gabim i papritur në server";
    console.error("[librat/sales/send-sms] gabim i papritur:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
