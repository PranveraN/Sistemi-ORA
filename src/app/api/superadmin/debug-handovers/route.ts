import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Diagnostikim i përkohshëm, VETËM-LEXIM (asnjë shkrim/ndryshim) — ndihmon të
// gjendet pse një "dorëzim" i regjistruar për një kategori (p.sh. Shkollimi)
// nuk shfaqet te "Pasqyra e Arkës"/"Dorëzim Parash" e asaj kategorie: tregon
// direkt çfarë ka realisht të ruajtur (categoryId/muaj/vit real), pavarësisht
// filtrave të faqes, që të mos hamendësohet më nëpërmjet UI-t.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Vetëm Super Admin mund ta shohë këtë diagnostikim" }, { status: 403 });
  }

  const [categories, expenseHandovers, paymentHandovers] = await Promise.all([
    prisma.paymentCategory.findMany({
      select: { id: true, name: true, organizationId: true },
      orderBy: { id: "asc" },
    }),
    prisma.expense.findMany({
      where: { type: "HANDOVER" },
      select: {
        id: true, categoryId: true, amount: true, month: true, year: true,
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

  return NextResponse.json({
    // Kontrollon nëse ka kategori "Shkollimi" (ose të tjera) dublikate me ID të ndryshme.
    paymentCategories: categories,
    // Çdo rresht Expense i tipit HANDOVER, çfarëdo kategorie/muaji/viti.
    expenseHandovers: expenseHandovers.map(h => ({ ...h, categoryName: catById.get(h.categoryId) ?? `(#${h.categoryId} — nuk ekziston më)` })),
    // Çdo rresht PaymentHandover (faqja e veçantë "Dorëzimet"), çfarëdo kategorie.
    paymentHandovers: paymentHandovers.map(h => ({ ...h, categoryName: h.categoryId ? (catById.get(h.categoryId) ?? `(#${h.categoryId} — nuk ekziston më)`) : "(pa kategori)" })),
  });
}
