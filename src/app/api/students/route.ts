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
  const siblingFatherPhone = searchParams.get("siblingFatherPhone") || "";
  const siblingFatherName = searchParams.get("siblingFatherName") || "";
  const siblingMotherPhone = searchParams.get("siblingMotherPhone") || "";
  const siblingMotherName = searchParams.get("siblingMotherName") || "";
  const excludeId = searchParams.get("excludeId") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};

  if (siblingFatherPhone || siblingMotherPhone) {
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

  const [students, total, activeCount, debtCount] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        class: { select: { name: true, level: true } },
        payments: {
          select: { balance: true, paidAmount: true },
          orderBy: { createdAt: "desc" },
          take: 60, // max 5 vjet × 12 muaj — shmang fetch të gjithë historikut
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
    // Nëse filtrimi është tashmë ACTIVE, activeCount = total
    status === "ACTIVE"
      ? Promise.resolve(0).then(() => prisma.student.count({ where }))
      : prisma.student.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...where, payments: { some: { balance: { gt: 0 } } } } }),
  ]);

  return NextResponse.json({ students, total, activeCount, debtCount, page, limit });
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
        parentPhone: body.fatherPhone || body.motherPhone || body.parentPhone || undefined,
        address: body.address || null,
        status: body.status || "ACTIVE",
        notes: body.notes || null,
        motherName: body.motherName || null,
        motherBirth: parseDate(body.motherBirth) ?? null,
        motherProf: body.motherProf || null,
        motherPhone: body.motherPhone || null,
        motherEmail: body.motherEmail || null,
        fatherName: body.fatherName || null,
        fatherBirth: parseDate(body.fatherBirth) ?? null,
        fatherProf: body.fatherProf || null,
        fatherPhone: body.fatherPhone || null,
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
