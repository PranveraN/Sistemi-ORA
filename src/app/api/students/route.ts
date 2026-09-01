import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";

function parseDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? undefined : d;
}

function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const clean = p.replace(/[\s+\-/()]/g, "").trim();
  return clean || null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const classId = searchParams.get("classId") || "";
  const siblingPhone = searchParams.get("siblingPhone") || "";
  const siblingFatherPhone = searchParams.get("siblingFatherPhone") || "";
  const siblingFatherName  = searchParams.get("siblingFatherName") || "";
  const siblingMotherPhone = searchParams.get("siblingMotherPhone") || "";
  const siblingMotherName  = searchParams.get("siblingMotherName") || "";
  const excludeId = searchParams.get("excludeId") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = { organizationId: orgId };

  if (search) {
    const parts = search.trim().split(/\s+/);
    const baseConditions = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { personalNumber: { contains: search } },
      { parentPhone: { contains: search } },
      { parentName: { contains: search } },
    ];
    if (parts.length >= 2) {
      where.OR = [
        ...baseConditions,
        { AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] },
        { AND: [{ firstName: { contains: parts[parts.length - 1] } }, { lastName: { contains: parts.slice(0, -1).join(" ") } }] },
      ];
    } else {
      where.OR = baseConditions;
    }
  } else if (siblingFatherPhone || siblingMotherPhone) {
    // Vëllezër/motra të VËRTETË — telefoni DHE emri i të njëjtit prind duhet të përputhen,
    // jo vetëm telefoni (një numër i gabuar/i përsëritur nuk duhet t'i "bashkojë" familje të ndryshme).
    const siblingConditions: Record<string, unknown>[] = [];
    if (siblingFatherPhone) {
      siblingConditions.push({
        fatherPhone: siblingFatherPhone,
        ...(siblingFatherName ? { fatherName: siblingFatherName } : {}),
      });
    }
    if (siblingMotherPhone) {
      siblingConditions.push({
        motherPhone: siblingMotherPhone,
        ...(siblingMotherName ? { motherName: siblingMotherName } : {}),
      });
    }
    where.OR = siblingConditions;
  } else if (siblingPhone) {
    where.OR = [
      { parentPhone: siblingPhone },
      { fatherPhone: siblingPhone },
      { motherPhone: siblingPhone },
    ];
  }

  if (status) where.status = status;
  if (classId) where.classId = parseInt(classId);
  if (excludeId) where.NOT = { id: parseInt(excludeId) };

  const [rawStudents, total, activeCount, debtCount] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { class: { select: { name: true, level: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
    status === "ACTIVE"
      ? prisma.student.count({ where })
      : prisma.student.count({ where: { ...where, status: "ACTIVE" } }),
    // "Borxhi"/"Paguar" te kjo listë krahasohen me "Çmimi Final" (çmimi i
    // Shkollimit — vetëm një kategori, shih `tuitionPrice` në frontend), prandaj
    // edhe këtu kufizohet vetëm te kategoria "Shkollimi" — përndryshe një student
    // pa borxh në Shkollimi por me borxh te p.sh. Ushqimi numërohej gabimisht si
    // "me borxh" këtu, duke mos përputhur me atë që tregon rreshti i tij.
    prisma.student.count({ where: { ...where, payments: { some: { balance: { gt: 0 }, category: { name: "Shkollimi", organizationId: orgId } } } } }),
  ]);

  const studentIds = rawStudents.map(s => s.id);
  // Kufizuar vetëm te "Shkollimi" — shih komentin mbi debtCount pak më sipër,
  // i njëjti arsyetim: kjo shumë krahasohet me "Çmimi Final" (Shkollimi), jo me
  // gjithë pagesat e nxënësit nga të gjitha kategoritë (Ushqimi, Eshkollori, etj).
  // Merren rekordet e papërpunuara (jo `groupBy` `_sum`) sepse Këste Fleksibël
  // përdor një model "FLEX_HEADER + FLEX_PAY_N" ku mbledhja e thjeshtë e
  // finalAmount do ta fryente totalin (shih `aggregatePaymentTotals`).
  const shkollimiPayments = await prisma.payment.findMany({
    where: { studentId: { in: studentIds }, category: { name: "Shkollimi", organizationId: orgId } },
    select: { studentId: true, paidAmount: true, finalAmount: true, description: true },
  });
  const shkollimiByStudent = new Map<number, { paidAmount: number; finalAmount: number; description: string | null }[]>();
  for (const p of shkollimiPayments) {
    const arr = shkollimiByStudent.get(p.studentId) ?? [];
    arr.push(p);
    shkollimiByStudent.set(p.studentId, arr);
  }
  const sumMap = new Map<number, number>();
  const shkollimiTotalMap = new Map<number, number>();
  const shkollimiCountMap = new Map<number, number>();
  for (const [studentId, payments] of shkollimiByStudent) {
    const { finalAmount, paidAmount } = aggregatePaymentTotals(payments);
    sumMap.set(studentId, paidAmount);
    shkollimiTotalMap.set(studentId, finalAmount);
    shkollimiCountMap.set(studentId, payments.length);
  }

  const students = rawStudents.map(s => ({
    ...s,
    totalPaid: sumMap.get(s.id) ?? 0,
    shkollimiFinalTotal: shkollimiTotalMap.get(s.id) ?? 0,
    hasShkollimiPlan: (shkollimiCountMap.get(s.id) ?? 0) > 0,
    timiInvest: null,
  }));

  return NextResponse.json({ students, total, activeCount, debtCount, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  try {
    const body = await req.json();

    if (!body.firstName || !body.lastName) {
      return NextResponse.json({ message: "Emri dhe mbiemri janë të detyrueshme." }, { status: 400 });
    }

    const student = await prisma.student.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        parentName: body.fatherName || body.motherName || body.parentName || undefined,
        birthDate: parseDate(body.birthDate),
        personalNumber: body.personalNumber || undefined,
        organizationId: orgId,
        ...(body.classId ? { classId: parseInt(body.classId) } : {}),
        guardian: body.guardian || null,
        motherNumber: body.motherNumber || null,
        diaryNumber: body.diaryNumber || null,
        parentPhone: normalizePhone(body.fatherPhone || body.motherPhone || body.parentPhone) ?? undefined,
        address: body.address || null,
        status: body.status || "ACTIVE",
        notes: body.notes || null,
        motherName: body.motherName || null,
        motherBirth: parseDate(body.motherBirth) ?? null,
        motherProf: body.motherProf || null,
        motherPhone: normalizePhone(body.motherPhone),
        motherEmail: body.motherEmail || null,
        fatherName: body.fatherName || null,
        fatherBirth: parseDate(body.fatherBirth) ?? null,
        fatherProf: body.fatherProf || null,
        fatherPhone: normalizePhone(body.fatherPhone),
        fatherEmail: body.fatherEmail || null,
      },
    });

    const userId = parseInt((session?.user as { id?: string } | undefined)?.id ?? "0");
    if (userId > 0) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE",
          entity: "Student",
          entityId: student.id,
          details: `Regjistroi nxënësin ${student.firstName} ${student.lastName}`,
        },
      });
    }

    return NextResponse.json(student, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
