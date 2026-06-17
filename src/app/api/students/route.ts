import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const classId = searchParams.get("classId") || "";
  const siblingPhone = searchParams.get("siblingPhone") || "";
  const siblingAnyPhone = searchParams.get("siblingAnyPhone") || ""; // numra të shumëfishtë, ndarë me presje
  const siblingFatherPhone = searchParams.get("siblingFatherPhone") || "";
  const siblingFatherName = searchParams.get("siblingFatherName") || "";
  const siblingMotherPhone = searchParams.get("siblingMotherPhone") || "";
  const siblingMotherName = searchParams.get("siblingMotherName") || "";
  const siblingByParentName = searchParams.get("siblingByParentName") || ""; // "fatherName|lastName" ose "motherName|lastName"
  const siblingLastName = searchParams.get("siblingLastName") || "";
  const excludeId = searchParams.get("excludeId") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};

  if (siblingAnyPhone) {
    // Kërko me normalizim SQLite: heq hapësira, +, /, - para krahasimit
    // Kjo zgjidhë rastet ku DB ka "049 233 097" por query dërgon "049233097"
    const phones = siblingAnyPhone.split(",").map(p => p.trim()).filter(Boolean);
    if (phones.length > 0) {
      const norm = (col: string) =>
        `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col},''),' ',''),'+',''),'/',''),'-',''),'(','')`;
      const ph = phones.map(() => "?").join(",");
      const exId = parseInt(excludeId || "0") || 0;
      const rawIds = await prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT DISTINCT id FROM Student
         WHERE id != ? AND (
           ${norm("parentPhone")} IN (${ph})
           OR ${norm("fatherPhone")} IN (${ph})
           OR ${norm("motherPhone")} IN (${ph})
         )`,
        exId, ...phones, ...phones, ...phones
      );
      where.id = { in: rawIds.map(r => Number(r.id)) };
    }
  } else if (siblingFatherPhone || siblingMotherPhone) {
    const orConditions: Record<string, unknown>[] = [];
    if (siblingFatherPhone && siblingFatherName) {
      orConditions.push({ fatherPhone: siblingFatherPhone, fatherName: siblingFatherName });
    } else if (siblingFatherPhone) {
      orConditions.push({ fatherPhone: siblingFatherPhone });
    }
    if (siblingMotherPhone && siblingMotherName) {
      orConditions.push({ motherPhone: siblingMotherPhone, motherName: siblingMotherName });
    } else if (siblingMotherPhone) {
      orConditions.push({ motherPhone: siblingMotherPhone });
    }
    if (orConditions.length > 0) where.OR = orConditions;
  } else if (siblingByParentName && siblingLastName) {
    // Fallback: kërko sipas emrit të prindit + mbiemrit (kur telefoni mungon)
    where.OR = [
      { lastName: siblingLastName, fatherName: siblingByParentName },
      { lastName: siblingLastName, motherName: siblingByParentName },
      { lastName: siblingLastName, parentName: siblingByParentName },
    ];
  } else if (siblingPhone) {
    where.OR = [
      { parentPhone: siblingPhone },
      { fatherPhone: siblingPhone },
      { motherPhone: siblingPhone },
    ];
  } else if (search) {
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
  }
  if (status) where.status = status;
  if (classId) where.classId = parseInt(classId);
  if (excludeId) where.NOT = { id: parseInt(excludeId) };

  const [rawStudents, total, activeCount, debtCount] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        class: { select: { name: true, level: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
    status === "ACTIVE"
      ? prisma.student.count({ where })
      : prisma.student.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...where, payments: { some: { balance: { gt: 0 } } } } }),
  ]);

  // Merr totalet e pagesave për këta nxënës me 1 query grupuese
  const studentIds = rawStudents.map(s => s.id);
  const paymentSums = await prisma.payment.groupBy({
    by: ["studentId"],
    where: { studentId: { in: studentIds } },
    _sum: { paidAmount: true },
  });
  const sumMap = new Map(paymentSums.map(p => [p.studentId, p._sum.paidAmount ?? 0]));

  // Merr TË GJITHË nxënësit aktivë të Timi Invest (me ose pa studentId)
  type TIRow = { id: number; studentId: number | null; firstName: string; lastName: string; regularPrice: number; discountPct: number; manualDiscAmt: number };
  const allTiRows: TIRow[] = await prisma.$queryRawUnsafe<TIRow[]>(
    `SELECT id, studentId, firstName, lastName, regularPrice, discountPct, manualDiscAmt FROM TimiInvestStudent WHERE active = 1`
  );

  // Map 1: sipas studentId (lidhje direkte)
  const tiByStudentId = new Map<number, { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number }>();
  // Map 2: sipas "firstName|lastName" (fallback për ata pa studentId)
  const tiByName = new Map<string, { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number }>();

  for (const ti of allTiRows) {
    const val = { id: Number(ti.id), regularPrice: Number(ti.regularPrice), discountPct: Number(ti.discountPct), manualDiscAmt: Number(ti.manualDiscAmt) };
    if (ti.studentId) {
      tiByStudentId.set(Number(ti.studentId), val);
    } else {
      const nameKey = `${String(ti.firstName).trim().toLowerCase()}|${String(ti.lastName).trim().toLowerCase()}`;
      tiByName.set(nameKey, val);
    }
  }

  const students = rawStudents.map(s => {
    const tiDirect = tiByStudentId.get(s.id);
    const tiByNameMatch = !tiDirect
      ? tiByName.get(`${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}`)
      : undefined;
    return {
      ...s,
      totalPaid: sumMap.get(s.id) ?? 0,
      timiInvest: tiDirect ?? tiByNameMatch ?? null,
    };
  });

  return NextResponse.json({ students, total, activeCount, debtCount, page, limit });
}

// Normalizo numrin e telefonit: largo hapësirat, +, /, -, ()
function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const clean = p.replace(/[\s+\-/()]/g, "").trim();
  return clean || null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        ...(body.classId ? { class: { connect: { id: parseInt(body.classId) } } } : {}),
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
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ message: "Numri personal ekziston tashmë." }, { status: 409 });
    }
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
