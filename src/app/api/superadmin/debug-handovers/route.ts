import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Diagnostikim i përkohshëm, VETËM-LEXIM (asnjë shkrim/ndryshim/fshirje) —
// ndihmon të gjendet pse një "dorëzim" ose "shpenzim" i regjistruar për një
// kategori (p.sh. Shkollimi) nuk shfaqet te "Pasqyra e Arkës"/"Shpenzime"/
// "Dorëzim Parash" e asaj kategorie: tregon direkt çfarë ka REALISHT të
// ruajtur (categoryId/muaj/vit real), pavarësisht filtrave të faqes, që të
// mos hamendësohet më nëpërmjet UI-t.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Vetëm Super Admin mund ta shohë këtë diagnostikim" }, { status: 403 });
  }

  const [categories, expenses, paymentHandovers] = await Promise.all([
    prisma.paymentCategory.findMany({
      select: { id: true, name: true, organizationId: true },
      orderBy: { id: "asc" },
    }),
    // Çdo rresht Expense (EXPENSE + HANDOVER që të dyja), çfarëdo kategorie/muaji/viti.
    prisma.expense.findMany({
      select: {
        id: true, categoryId: true, type: true, amount: true, month: true, year: true,
        date: true, description: true, recipient: true, method: true, createdAt: true,
      },
      orderBy: { id: "desc" },
    }),
    prisma.paymentHandover.findMany({
      select: {
        id: true, categoryId: true, amount: true, handoverAt: true,
        description: true, recipient: true, method: true, createdAt: true,
      },
      orderBy: { id: "desc" },
    }),
  ]);

  const catById = new Map(categories.map(c => [c.id, c.name]));
  const withCatName = <T extends { categoryId: number | null }>(rows: T[]) =>
    rows.map(r => ({ ...r, categoryName: r.categoryId != null ? (catById.get(r.categoryId) ?? `(#${r.categoryId} — nuk ekziston më)`) : "(pa kategori)" }));

  return NextResponse.json({
    // Kontrollon nëse ka kategori "Shkollimi" (ose të tjera) dublikate me ID të ndryshme.
    paymentCategories: categories,
    // Çdo Expense (EXPENSE ose HANDOVER), çfarëdo kategorie/muaji/viti — numri i tyre
    // total (`expenses.length`) tregon menjëherë nëse ekziston qoftë edhe një rresht,
    // pavarësisht filtrit të faqes.
    expensesTotal: expenses.length,
    expenses: withCatName(expenses),
    // Çdo rresht PaymentHandover (faqja e veçantë "Dorëzimet"), çfarëdo kategorie.
    paymentHandoversTotal: paymentHandovers.length,
    paymentHandovers: withCatName(paymentHandovers),
  });
}
