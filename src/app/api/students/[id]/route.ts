import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id: parseInt(id) },
    include: {
      class: true,
      payments: {
        include: { category: true },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();

    const student = await prisma.student.update({
      where: { id: parseInt(id) },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        parentName: body.fatherName || body.motherName || body.parentName || null,
        birthDate: parseDate(body.birthDate),
        personalNumber: body.personalNumber || null,
        class: body.classId ? { connect: { id: parseInt(body.classId) } } : { disconnect: true },
        guardian: body.guardian || null,
        motherNumber: body.motherNumber || null,
        diaryNumber: body.diaryNumber || null,
        parentPhone: body.fatherPhone || body.motherPhone || body.parentPhone || null,
        address: body.address || null,
        status: body.status,
        notes: body.notes || null,
        motherName: body.motherName || null,
        motherBirth: parseDate(body.motherBirth),
        motherProf: body.motherProf || null,
        motherPhone: body.motherPhone || null,
        motherEmail: body.motherEmail || null,
        fatherName: body.fatherName || null,
        fatherBirth: parseDate(body.fatherBirth),
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
          action: "UPDATE",
          entity: "Student",
          entityId: student.id,
          details: `Modifikoi nxënësin ${student.firstName} ${student.lastName}`,
        },
      });
    }

    return NextResponse.json(student);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ message: "Numri personal ekziston tashmë." }, { status: 409 });
    }
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const student = await prisma.student.update({
    where: { id: parseInt(id) },
    data: { kontrata: body.kontrata ?? null },
  });

  return NextResponse.json(student);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const studentId = parseInt(id);

  // Kontrollo nëse është fshirje e vërtetë ose vetëm deaktivizim
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get("permanent") === "true";

  if (permanent) {
    await prisma.payment.deleteMany({ where: { studentId } });
    await prisma.invoice.deleteMany({ where: { studentId } });
    await prisma.auditLog.deleteMany({ where: { entity: "Student", entityId: studentId } });
    await prisma.student.delete({ where: { id: studentId } });
  } else {
    await prisma.student.update({
      where: { id: studentId },
      data: { status: "INACTIVE" },
    });
  }

  return NextResponse.json({ success: true });
}
