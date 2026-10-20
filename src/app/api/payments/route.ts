import { NextRequest, NextResponse } from "next/server";
import { recordPaymentEvent } from "@/lib/studentHistory";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alignPeriodToDue } from "@/lib/academicYear";
import { nextReceiptNumber } from "@/lib/receiptNumber";

// Rreshtat e një plani (muaj/këst) janë unikë për nxënës + kategori + vit shkollor.
// Pa këtë, klikimi i dyfishtë te "Ruaj" ose ruajtja e përsëritur pas një gabimi
// krijonin muajt sërish (Davud Dërmaku 3 × 12, Pars Buja 34 rreshta TIMI → çmimi 6.000 €).
const PLAN_ROW = /^(TI_MUAJI_|MUAJI_|KESTI_)\d+$|^FLEX_HEADER$/; // FLEX_PAY_N jo: numrat zhvendosen kur fshihet një pagesë
class DuplicatePlanRow extends Error {}
function schoolYearRange(due: Date): { gte: Date; lt: Date } {
  const start = due.getMonth() + 1 >= 9 ? due.getFullYear() : due.getFullYear() - 1;
  return { gte: new Date(start, 8, 1), lt: new Date(start + 1, 8, 1) };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const studentId = searchParams.get("studentId") || "";
  const month = searchParams.get("month") || "";
  const year = searchParams.get("year") || "";
  const categoryName = searchParams.get("categoryName") || "";
  const confirmedParam = searchParams.get("confirmed");
  const metoda = searchParams.get("metoda") || ""; // CASH | BANKE | NONE
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (status) where.status = status;
  if (studentId) where.studentId = parseInt(studentId);
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);
  if (categoryName) where.category = { name: categoryName };
  if (confirmedParam !== null) where.confirmed = confirmedParam === "true";
  // "Pa metodë" = shumë e paguar pa Cash/Bankë — që administrata t'i klasifikojë
  if (metoda === "NONE") { where.method = null; where.paidAmount = { gt: 0 }; }
  else if (metoda === "BANKE") where.method = { in: ["BANK", "CARD", "ONLINE"] };
  else if (metoda === "CASH") where.method = "CASH";
  if (search) {
    where.student = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    };
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json({ payments, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();

  const amount = parseFloat(body.amount);
  const discount = parseFloat(body.discount || 0);
  const scholarship = parseFloat(body.scholarship || 0);

  let discountAmount = discount;
  if (body.discountType === "percentage") {
    discountAmount = (amount * discount) / 100;
  }

  const finalAmount = Math.max(0, amount - discountAmount - scholarship);
  const paidAmount = parseFloat(body.paidAmount || 0);
  const balance = Math.max(0, finalAmount - paidAmount);

  let status = "PENDING";
  if (paidAmount >= finalAmount) status = "PAID";
  else if (paidAmount > 0) status = "PARTIAL";
  else if (new Date(body.dueDate) < new Date()) status = "OVERDUE";

  try {
    // Pagesat e nxënësve TIMI ruhen të konfirmuara si çdo pagesë tjetër — s'presin
    // më "Verifikim" (kërkesë e Pranverës, 19.10.2026).
    const studentIdNum = parseInt(body.studentId);
    const categoryIdNum = parseInt(body.categoryId);
    const category = await prisma.paymentCategory.findUnique({ where: { id: categoryIdNum }, select: { name: true } });

    const description: string | null = body.description || null;
    // Kontrolli dhe krijimi në NJË transaksion — transaksionet mbajnë radhën e shkrimeve
    // (src/lib/prisma.ts), ndaj dy kërkesa njëkohësisht s'mund ta kalojnë kontrollin të dyja.
    const payment = await prisma.$transaction(async tx => {
      if (description && PLAN_ROW.test(description)) {
        const dup = await tx.payment.findFirst({
          where: { studentId: studentIdNum, categoryId: categoryIdNum, description, dueDate: schoolYearRange(new Date(body.dueDate)) },
          select: { id: true },
        });
        if (dup) throw new DuplicatePlanRow();
      }
      const receiptNumber = paidAmount > 0 ? await nextReceiptNumber(orgId) : undefined;
      return tx.payment.create({
      data: {
        studentId: studentIdNum,
        categoryId: categoryIdNum,
        organizationId: orgId,
        confirmed: true,
        amount,
        discount,
        discountType: body.discountType || null,
        scholarship,
        finalAmount,
        dueDate: new Date(body.dueDate),
        paidDate: paidAmount > 0 ? (body.paidDate ? new Date(body.paidDate) : new Date()) : null,
        paidAmount,
        balance,
        method: body.method || null,
        status,
        description,
        note: body.note || null,
        // muaji s'mund t'i takojë një viti shkollor më të hershëm se Afati (shih alignPeriodToDue)
        ...alignPeriodToDue(body.month ? parseInt(body.month) : null, body.year ? parseInt(body.year) : new Date().getFullYear(), new Date(body.dueDate)),
        receiptNumber,
      },
      include: { student: { select: { firstName: true, lastName: true } } },
      });
    });

    const userId = parseInt((session?.user as { id?: string } | undefined)?.id ?? "0");
    if (userId > 0) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE",
          entity: "Payment",
          entityId: payment.id,
          details: `Shtoi pagesë ${finalAmount}€ për ${payment.student.firstName} ${payment.student.lastName} (${category?.name ?? "?"})`,
        },
      });
    }
    await recordPaymentEvent(session, {
      studentId: studentIdNum, categoryName: category?.name ?? "Pagesë",
      paidBefore: 0, paidAfter: paidAmount, paidDate: payment.paidDate,
      method: payment.method, paymentId: payment.id,
    });

    // Profili i nxënësit (/students/[id]) është faqe serveri (Server Component)
    // që lexon pagesat direkt me Prisma — pa këtë, "Router Cache" i Next.js e
    // mban versionin e vjetër të shfaqur kur kthehesh atje nga një faqe tjetër
    // (p.sh. Shkollimi) me navigim "të butë" (Link/back), edhe pse vetë baza e
    // të dhënave është përditësuar saktë (shih rastin real: pagesa dilte e
    // saktë te lista e Shkollimit, POR e vjetër te profili i nxënësit).
    revalidatePath(`/students/${body.studentId}`);

    return NextResponse.json(payment, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof DuplicatePlanRow) {
      return NextResponse.json({ error: "Ky muaj/këst ekziston tashmë për këtë nxënës — rifresko dhe kontrollo (s'u krijua sërish)." }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
