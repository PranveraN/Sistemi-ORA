import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const paymentId = parseInt(id);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: {
        select: {
          id: true, firstName: true, lastName: true,
          parentName: true, fatherName: true, motherName: true,
          class: { select: { name: true } },
        },
      },
      category: { select: { name: true } },
      invoice: { select: { number: true } },
    },
  });

  if (!payment) return NextResponse.json({ error: "Pagesa nuk u gjet" }, { status: 404 });

  let totalExpected: number, previouslyPaid: number, totalPaid: number, remainingBalance: number;

  if (payment.description?.startsWith("FLEX_PAY_")) {
    // Këste Fleksibël (ristrukturuar): "FLEX_HEADER" mban VETËM totalin e
    // vërtetë të planit (finalAmount) — çdo "FLEX_PAY_N" tjetër është thjesht
    // një dëftesë e vetë-mjaftueshme (finalAmount i vet = paidAmount i vet,
    // gjithmonë "e paguar plotësisht" për veten). Prandaj KËTU s'përdoret më
    // llogjika e vjetër "mblidh finalAmount të të gjithë motrave" (do të
    // numëronte header-in DHE çdo pagesë bashkë, duke e dyfishuar/shumëfishuar
    // totalin) — në vend të kësaj, totali merret VETËM nga header-i, dhe "paguar
    // më parë" mblidhet VETËM nga paidAmount i pagesave të tjera (jo finalAmount).
    const [header, otherFlexPayments] = await Promise.all([
      prisma.payment.findFirst({
        where: { studentId: payment.studentId, categoryId: payment.categoryId, description: "FLEX_HEADER" },
        select: { finalAmount: true },
      }),
      prisma.payment.findMany({
        where: { studentId: payment.studentId, categoryId: payment.categoryId, description: { startsWith: "FLEX_PAY_" }, id: { not: paymentId } },
        select: { paidAmount: true },
      }),
    ]);
    totalExpected    = header?.finalAmount ?? payment.finalAmount;
    previouslyPaid    = otherFlexPayments.reduce((s, p) => s + p.paidAmount, 0);
    totalPaid          = previouslyPaid + payment.paidAmount;
    remainingBalance   = Math.max(0, totalExpected - totalPaid);
  } else {
    // Pagasat motra të së NJËJTËS kategori DHE të së NJËJTIT vit akademik (p.sh.
    // KESTI_1/KESTI_2, MUAJI_1..10 të vitit 2025/2026) — përfshihen TË GJITHA,
    // edhe ato ende pa paguar fare, sepse "Shuma totale e faturës" dhe "Borxhi
    // i mbetur" duhet të pasqyrojnë GJITHË planin e pagesës të atij viti, jo
    // vetëm këtë këst të vetëm. Përndryshe një këst i paguar plotësisht (p.sh.
    // Kësti 1) do të dukej "✓ Pa borxh" edhe kur këstet e tjera (p.sh. Kësti 2)
    // ende presin pagesë — pikërisht defekti që u raportua fillimisht.
    //
    // Kategoria (p.sh. "Shkollimi") është E PËRHERSHME dhe përdoret çdo vit
    // akademik (shih PaymentCategory — s'krijohet kategori e re për çdo vit,
    // vetëm PaymentCategoryPrice ndryshon). Pa filtrin e vitit akademik më
    // poshtë, një pagesë e vitit 2026/2027 do të përmblidhej gabimisht bashkë
    // me këstet e vitit 2025/2026 — pikërisht defekti i dytë i gjetur (shuma
    // totale e fryrë, p.sh. 3.800€ në vend të 1.800€).
    //
    // Ushqimi ka fatura të pavarura për çdo periudhë (jo total kumulativ nëpër
    // muaj), prandaj kufizohet vetëm te i njëjti muaj/vit ekzakt.
    const isPeriodBased = payment.category.name === "Ushqimi";
    let yearScope: Record<string, unknown> = {};
    if (isPeriodBased) {
      yearScope = { month: payment.month, year: payment.year };
    } else if (payment.month != null && payment.year != null) {
      // Viti akademik fillon në Shtator: muajt 9-12 i takojnë `academicStart`,
      // muajt 1-8 i takojnë `academicStart + 1` (njësoj si te category-payments API).
      const academicStart = payment.month >= 9 ? payment.year : payment.year - 1;
      yearScope = {
        OR: [
          { month: { gte: 9 }, year: academicStart },
          { month: { lte: 8 }, year: academicStart + 1 },
        ],
      };
    }
    const siblingPayments = await prisma.payment.findMany({
      where: {
        studentId: payment.studentId,
        categoryId: payment.categoryId,
        id: { not: paymentId },
        description: { not: "FLEX_HEADER" },
        ...yearScope,
      },
      select: { paidAmount: true, finalAmount: true },
    });
    previouslyPaid   = siblingPayments.reduce((s, p) => s + p.paidAmount,  0);
    totalExpected    = payment.finalAmount + siblingPayments.reduce((s, p) => s + p.finalAmount, 0);
    totalPaid        = previouslyPaid + payment.paidAmount;
    remainingBalance = Math.max(0, totalExpected - totalPaid);
  }

  // Punonjësi që e regjistroi (nga audit log)
  const auditLog = await prisma.auditLog.findFirst({
    where: { entity: "Payment", entityId: paymentId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    receiptNumber: payment.receiptNumber,
    paymentId:     payment.id,
    student: {
      name:       `${payment.student.firstName} ${payment.student.lastName}`,
      parentName: payment.student.fatherName || payment.student.motherName || payment.student.parentName || "",
      class:      payment.student.class?.name || "",
    },
    category:      payment.category.name,
    invoiceNumber: payment.invoice?.number || null,
    // Shuma totale e GJITHË planit të pagesës (jo vetëm ky këst) — p.sh. Kësti 1 + Kësti 2.
    finalAmount:   totalExpected,
    // Shuma e paguar VETËM në këtë transaksion specifik (jo e gjithë planit).
    paidAmount:    payment.paidAmount,
    previouslyPaid,
    totalPaid,
    // Borxhi i mbetur i GJITHË planit — llogaritet kundrejt totalExpected, jo
    // vetëm kundrejt balancës së këtij kësti të vetëm.
    balance:       remainingBalance,
    method:        payment.method,
    paidDate:      payment.paidDate,
    month:         payment.month,
    year:          payment.year,
    description:   payment.description,
    registeredBy:  auditLog?.user?.name || null,
    createdAt:     payment.createdAt,
  });
}
