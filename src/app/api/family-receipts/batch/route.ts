import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Bashkon shitje (UniSale/BookSale) TASHMË TË KRIJUARA — një për secilin fëmijë,
// secila me shportën/produktet e veta — nën një Dëshmi Pagese Familjeje të vetme.
// Ndryshe nga POST /api/family-receipts (Shkollimi/Ushqimi/Eshkollori, ku pagesat
// krijohen aty për aty), këtu shitjet ekzistojnë tashmë (regjistruar normalisht,
// një nga një, me zgjedhësin e plotë të produkteve) — kjo thjesht i grupon për
// printim të përbashkët, pa i prekur shumat/artikujt e tyre.
async function generateFamilyReceiptNumber(orgId: number): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.familyReceipt.findFirst({
    where: { organizationId: orgId, receiptNumber: { startsWith: `FAM-${year}-` } },
    orderBy: { receiptNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.receiptNumber.split("-").pop() || "0") : 0;
  return `FAM-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const { parentName, parentPhone, method, uniSaleIds, bookSaleIds } = body as {
    parentName?: string; parentPhone?: string; method?: string;
    uniSaleIds?: number[]; bookSaleIds?: number[];
  };

  const uIds = uniSaleIds ?? [];
  const bIds = bookSaleIds ?? [];
  if (uIds.length + bIds.length < 2) {
    return NextResponse.json({ error: "Duhen të paktën 2 shitje për një dëshmi të përbashkët" }, { status: 400 });
  }

  const [uniSales, bookSales] = await Promise.all([
    uIds.length ? prisma.uniSale.findMany({ where: { id: { in: uIds } } }) : Promise.resolve([]),
    bIds.length ? prisma.bookSale.findMany({ where: { id: { in: bIds } } }) : Promise.resolve([]),
  ]);
  if (uniSales.length !== uIds.length || bookSales.length !== bIds.length) {
    return NextResponse.json({ error: "Një ose më shumë shitje nuk u gjetën" }, { status: 404 });
  }
  const already = [...uniSales, ...bookSales].find(s => s.familyReceiptId != null);
  if (already) {
    return NextResponse.json({ error: `Shitja #${already.id} është tashmë pjesë e një dëshmie tjetër familjeje` }, { status: 409 });
  }

  const receiptNumber = await generateFamilyReceiptNumber(orgId);
  const totalAmount =
    uniSales.reduce((s, x) => s + x.paidAmount, 0) +
    bookSales.reduce((s, x) => s + x.paidAmount, 0);

  const familyReceipt = await prisma.familyReceipt.create({
    data: {
      receiptNumber,
      parentName: parentName || null,
      parentPhone: parentPhone || null,
      method: method || null,
      totalAmount,
      organizationId: orgId,
    },
  });

  await Promise.all([
    uIds.length ? prisma.uniSale.updateMany({ where: { id: { in: uIds } }, data: { familyReceiptId: familyReceipt.id } }) : Promise.resolve(),
    bIds.length ? prisma.bookSale.updateMany({ where: { id: { in: bIds } }, data: { familyReceiptId: familyReceipt.id } }) : Promise.resolve(),
  ]);

  await logAction(session, "CREATE", "FamilyReceipt", familyReceipt.id,
    `Bashkoi ${uIds.length + bIds.length} shitje në një dëshmi pagese familjeje (${receiptNumber}), gjithsej ${totalAmount.toFixed(2)}€`);

  return NextResponse.json({ id: familyReceipt.id, receiptNumber, totalAmount }, { status: 201 });
}
