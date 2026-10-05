import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeTuitionMessageStatuses } from "@/lib/tuitionMessageStatus";
import { PERIOD_BUCKETS } from "@/lib/food-periods";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import {
  type MessageType, type MessageStatus, type StatusResult,
  PAYMENT_CATEGORY_FOR_TYPE, MESSAGE_TYPES,
  getCategoryMessageStatus, getSalesMessageStatus,
  isValidPhone,
} from "@/lib/smsStatus";

// VETËM LEXIM — lista e marrësve të mundshëm për modulin e mesazheve, me
// statusin e pagesës sipas llojit të mesazhit (shih src/lib/smsStatus.ts).
// S'ndryshon asnjë të dhënë dhe s'ndikon pagesat/raportet. Endpoint i veçantë
// (jo /api/uniforms, /api/librat) sepse ato janë të kufizuara te modulet e tyre
// në middleware, ndërsa Sekretaria (përdoruesi kryesor i SMS) s'i ka.

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "SECRETARY", "FINANCE"];
const DUPLICATE_WINDOW_DAYS = 3;

function phoneKey(raw: string): string {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `383${d.slice(1)}`;
  return d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!ALLOWED_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") || "GENERAL") as MessageType;
  if (!MESSAGE_TYPES.some(t => t.key === type)) {
    return NextResponse.json({ error: "Lloj i panjohur mesazhi" }, { status: 400 });
  }
  const year = parseInt(sp.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const periodParam = parseInt(sp.get("period") || "0");

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", organizationId: orgId },
    select: {
      id: true, firstName: true, lastName: true, discountPct: true,
      parentPhone: true, fatherPhone: true, motherPhone: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const results = new Map<number, StatusResult<MessageStatus>>();
  let unlinked = 0;
  let tuitionDueDate: Date | null = null;
  let periodLabel: string | null = null;

  const academicWhere = {
    OR: [
      { month: { gte: 9 }, year },
      { month: { lte: 8 }, year: year + 1 },
    ],
  };

  const categoryName = PAYMENT_CATEGORY_FOR_TYPE[type];
  if (categoryName) {
    const category = await prisma.paymentCategory.findFirst({ where: { name: categoryName } });
    let periodWhere: Record<string, unknown> = academicWhere;
    if (type === "USHQIMI") {
      const bucket = PERIOD_BUCKETS.find(p => p.canonicalMonth === periodParam);
      if (bucket) {
        periodLabel = bucket.label;
        periodWhere = { month: { in: bucket.months }, year: bucket.canonicalMonth >= 9 ? year : year + 1 };
      }
    }
    const payments = category && type !== "SHKOLLIMI" ? await prisma.payment.findMany({
      where: {
        categoryId: category.id,
        studentId: { in: students.map(s => s.id) },
        // Borxhi i vjetër i importuar s'hyn në statusin e vitit aktual
        AND: [{ OR: [{ description: null }, { description: { not: "BORXH_VJETER" } }] }],
        ...periodWhere,
      },
      select: { studentId: true, finalAmount: true, paidAmount: true, description: true, dueDate: true },
    }) : [];
    const byStudent = new Map<number, typeof payments>();
    for (const p of payments) {
      if (!byStudent.has(p.studentId)) byStudent.set(p.studentId, []);
      byStudent.get(p.studentId)!.push(p);
    }

    if (type === "SHKOLLIMI") {
      // E njëjta llogaritje përdoret edhe nga asistenti "Ora" (src/lib/tuitionMessageStatus.ts)
      const r = await computeTuitionMessageStatuses(students, year);
      tuitionDueDate = r.tuitionDueDate;
      for (const [id, st] of r.statuses) results.set(id, st);
    } else {
      // Ushqimi / eShkollori — kush s'ka asnjë rresht s'e ka shërbimin (përjashtohet)
      for (const s of students) {
        const r = getCategoryMessageStatus(byStudent.get(s.id) ?? []);
        if (r) results.set(s.id, r);
      }
    }
  } else if (type === "UNIFORMA" || type === "LIBRAT") {
    // Shitjet e vitit akademik + çdo shitje më e vjetër që ka ende borxh
    const from = new Date(year, 8, 1);
    const to = new Date(year + 1, 8, 1);
    const saleWhere = { OR: [{ saleDate: { gte: from, lt: to } }, { saleDate: { lt: from }, balance: { gt: 0 } }] };
    const sales = type === "UNIFORMA"
      ? await prisma.uniSale.findMany({ where: { ...saleWhere, status: { not: "CANCELLED" } }, select: { studentId: true, totalAmount: true, paidAmount: true } })
      : await prisma.bookSale.findMany({ where: { ...saleWhere, status: { not: "CANCELLED" } }, select: { studentId: true, totalAmount: true, paidAmount: true } });
    const activeIds = new Set(students.map(s => s.id));
    const byStudent = new Map<number, { totalAmount: number; paidAmount: number }[]>();
    for (const sale of sales) {
      if (!sale.studentId || !activeIds.has(sale.studentId)) { unlinked++; continue; }
      if (!byStudent.has(sale.studentId)) byStudent.set(sale.studentId, []);
      byStudent.get(sale.studentId)!.push(sale);
    }
    for (const s of students) {
      const r = getSalesMessageStatus(byStudent.get(s.id) ?? []);
      if (r) results.set(s.id, r);
    }
  }

  // Mbrojtja nga dyfishimi — SMS të dërguara me sukses për këtë lloj në 3 ditët e fundit
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await prisma.smsMessage.findMany({
    where: { organizationId: orgId, messageType: type, status: "SENT", createdAt: { gte: since } },
    select: { recipientPhone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const lastSent: Record<string, string> = {};
  for (const r of recent) {
    const k = phoneKey(r.recipientPhone);
    if (!lastSent[k]) lastSent[k] = r.createdAt.toISOString();
  }

  const rows = students
    .filter(s => type === "GENERAL" || results.has(s.id))
    .map(s => {
      const phones = [s.parentPhone, s.fatherPhone, s.motherPhone].filter((p): p is string => !!p && !!p.trim());
      const phone = phones.find(isValidPhone) ?? phones[0] ?? null;
      const r = results.get(s.id);
      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        classId: s.class?.id ?? null,
        className: s.class?.name ?? null,
        phone,
        phoneKey: phone ? phoneKey(phone) : null,
        phoneValid: isValidPhone(phone),
        status: r?.status ?? null,
        paid: r ? Math.round(r.paid * 100) / 100 : 0,
        balance: r ? Math.round(r.balance * 100) / 100 : 0,
        dueDate: r?.dueDate ?? null,
      };
    });

  return NextResponse.json({
    type, year, periodLabel,
    tuitionDueDate: tuitionDueDate?.toISOString() ?? null,
    students: rows,
    unlinked,
    lastSent,
    duplicateWindowDays: DUPLICATE_WINDOW_DAYS,
  });
}
