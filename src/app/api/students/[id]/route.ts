import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const clean = p.replace(/[\s+\-/()]/g, "").trim();
  return clean || null;
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
        parentPhone: normalizePhone(body.fatherPhone || body.motherPhone || body.parentPhone),
        address: body.address || null,
        status: body.status,
        notes: body.notes || null,
        motherName: body.motherName || null,
        motherBirth: parseDate(body.motherBirth),
        motherProf: body.motherProf || null,
        motherPhone: normalizePhone(body.motherPhone),
        motherEmail: body.motherEmail || null,
        fatherName: body.fatherName || null,
        fatherBirth: parseDate(body.fatherBirth),
        fatherProf: body.fatherProf || null,
        fatherPhone: normalizePhone(body.fatherPhone),
        fatherEmail: body.fatherEmail || null,
      },
    });

    // inactiveDate via raw SQL (Prisma client nuk e njeh fushën e re pa generate)
    if (body.status === "INACTIVE") {
      await prisma.$executeRawUnsafe(
        `UPDATE Student SET inactiveDate = datetime('now') WHERE id = ${parseInt(id)}`
      );
    } else if (body.status === "ACTIVE") {
      await prisma.$executeRawUnsafe(
        `UPDATE Student SET inactiveDate = NULL WHERE id = ${parseInt(id)}`
      );
    }

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

  const data: Record<string, unknown> = {};
  if ("kontrata" in body) data.kontrata = body.kontrata ?? null;
  if ("discountPct" in body) data.discountPct = Number(body.discountPct) || 0;

  const student = await prisma.student.update({
    where: { id: parseInt(id) },
    data,
  });

  await logAction(session, "UPDATE", "Student", student.id,
    `Ndryshoi kontratën/zbritjen e ${student.firstName} ${student.lastName}`);

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

  const existing = await prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
  const studentName = existing ? `${existing.firstName} ${existing.lastName}` : `#${studentId}`;

  if (permanent) {
    await prisma.payment.deleteMany({ where: { studentId } });
    await prisma.invoice.deleteMany({ where: { studentId } });
    await prisma.auditLog.deleteMany({ where: { entity: "Student", entityId: studentId } });
    await prisma.student.delete({ where: { id: studentId } });
    await logAction(session, "DELETE", "Student", studentId, `Fshiu përgjithmonë nxënësin ${studentName} (bashkë me pagesat/faturat)`);
  } else {
    await prisma.student.update({
      where: { id: studentId },
      data: { status: "INACTIVE" },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE Student SET inactiveDate = datetime('now') WHERE id = ${studentId}`
    );
    await logAction(session, "UPDATE", "Student", studentId, `Çaktivizoi nxënësin ${studentName}`);
  }

  return NextResponse.json({ success: true });
}
