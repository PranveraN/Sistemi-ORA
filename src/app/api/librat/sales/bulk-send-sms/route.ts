import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { buildBookDebtMessage } from "@/lib/bookDebtSms";

const s = (v: unknown) =>
  v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

interface Entry { id: number; phone: string }

// Dërgim me shumicë i kujtesave SMS për borxhe librash — sekuencial (jo
// Promise.all), që gateway-i i SMS-ve (një telefon Android real) të mos
// përmbytet me kërkesa njëherësh; secili rresht raportohet veç e veç, që një
// dështim i vetëm (p.sh. numër i pavlefshëm) të mos ndalë të tjerët.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "FINANCE") {
      return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
    }

    const body = await req.json();
    const entries: Entry[] = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
      return NextResponse.json({ error: "Asnjë marrës i zgjedhur." }, { status: 400 });
    }

    let sent = 0;
    const failed: { id: number; name: string; error: string }[] = [];

    for (const entry of entries) {
      const phone = String(entry.phone ?? "").trim();
      if (!phone) { failed.push({ id: entry.id, name: `Shitje #${entry.id}`, error: "Numër telefoni mungon" }); continue; }

      const [sale] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM BookSale WHERE id=${entry.id}`
      );
      if (!sale) { failed.push({ id: entry.id, name: `Shitje #${entry.id}`, error: "S'u gjet" }); continue; }

      const balance = Number(sale.balance);
      if (balance <= 0) { failed.push({ id: entry.id, name: String(sale.studentName), error: "S'ka borxh" }); continue; }

      const items = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT bsi.quantity, bp.name as productName FROM BookSaleItem bsi
        JOIN BookProduct bp ON bp.id = bsi.productId
        WHERE bsi.saleId=${entry.id}
      `);
      const message = buildBookDebtMessage(String(sale.studentName), balance, items);

      const result = await sendSms(phone, message);
      if (!result.ok) {
        failed.push({ id: entry.id, name: String(sale.studentName), error: result.error || "Dështoi" });
        continue;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE BookSale SET sentSmsAt=datetime('now'), sentToPhone=${s(phone)}, updatedAt=datetime('now') WHERE id=${entry.id}`
      );
      sent++;
    }

    return NextResponse.json({ sent, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gabim i papritur në server";
    console.error("[librat/sales/bulk-send-sms] gabim i papritur:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
