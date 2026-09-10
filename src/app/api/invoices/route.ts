import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") || "";
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const month = parseInt(searchParams.get("month") || "0");
  const year  = parseInt(searchParams.get("year")  || "0");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (studentId) where.studentId = parseInt(studentId);
  if (type) where.type = type;
  if (status) where.status = status;
  if (year > 0) {
    const start = month > 0 ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const end   = month > 0 ? new Date(year, month, 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59);
    where.createdAt = { gte: start, lte: end };
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, fatherEmail: true, motherEmail: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({ invoices, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  try {
    const body = await req.json();

    type ItemInput = { description: string; quantity: number; regularPrice: number; discountPct: number; unitPrice: number; total: number; studentId?: number | string | null };
    const rawItems: ItemInput[] = Array.isArray(body.items) ? body.items : [];

    // Nxënësi i çdo zëri (opsional — bosh = zë i përgjithshëm, jo i lidhur me
    // një fëmijë specifik). Verifikohen kundër organizatës për të shmangur
    // referenca ndaj nxënësve të një organizate tjetër.
    const itemStudentIds = [...new Set(rawItems.map(it => it.studentId).filter((id): id is number | string => !!id).map(id => parseInt(String(id))))];
    if (itemStudentIds.length) {
      const validStudents = await prisma.student.findMany({ where: { id: { in: itemStudentIds }, organizationId: orgId }, select: { id: true } });
      if (validStudents.length !== itemStudentIds.length) {
        return NextResponse.json({ message: "Një nga nxënësit e zgjedhur për zërat nuk ekziston" }, { status: 400 });
      }
    }

    // Fatura vetë kërkon një nxënës kryesor (fushë e vjetër, e detyrueshme) —
    // përdoret ai i dhënë eksplicit, përndryshe i pari nga zërat.
    const primaryStudentId = body.studentId ? parseInt(String(body.studentId)) : itemStudentIds[0];
    if (!primaryStudentId) {
      return NextResponse.json({ message: "Zgjidh të paktën një nxënës" }, { status: 400 });
    }
    const primaryStudent = await prisma.student.findFirst({ where: { id: primaryStudentId, organizationId: orgId } });
    if (!primaryStudent) {
      return NextResponse.json({ message: "Nxënësi kryesor nuk ekziston" }, { status: 400 });
    }

    const vatRate = parseFloat(body.vatRate) || 0;
    const subtotal = rawItems.reduce((sum: number, item) => {
      const reg  = parseFloat(String(item.regularPrice)) || 0;
      const disc = parseFloat(String(item.discountPct))  || 0;
      const unit = reg > 0 ? Math.round(reg * (1 - disc / 100) * 100) / 100 : (parseFloat(String(item.unitPrice)) || 0);
      return sum + Math.round(item.quantity * unit * 100) / 100;
    }, 0);
    const vatAmount = (subtotal * vatRate) / 100;
    const total = subtotal + vatAmount;

    const prefix = body.type === "INVOICE" ? "FAT" : body.type === "PROFORMA" ? "PRO" : "OFR";
    const year = new Date().getFullYear();
    const lastInvoice = await prisma.invoice.findFirst({
      where: { number: { startsWith: `${prefix}-${year}-` }, organizationId: orgId },
      orderBy: { number: "desc" },
    });
    const lastSeq = lastInvoice
      ? parseInt(lastInvoice.number.split("-").pop() || "0")
      : 0;
    const number = `${prefix}-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        number,
        type: body.type,
        studentId: primaryStudentId,
        organizationId: orgId,
        subtotal,
        vatRate,
        vatAmount,
        total,
        status: "DRAFT",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes || null,
        items: {
          create: rawItems.map((item) => {
            const reg  = parseFloat(String(item.regularPrice)) || 0;
            const disc = parseFloat(String(item.discountPct))  || 0;
            const unit = reg > 0 ? Math.round(reg * (1 - disc / 100) * 100) / 100 : (parseFloat(String(item.unitPrice)) || 0);
            return {
              description:  item.description,
              quantity:     item.quantity,
              regularPrice: reg,
              discountPct:  disc,
              unitPrice:    unit,
              total:        Math.round(item.quantity * unit * 100) / 100,
              studentId:    item.studentId ? parseInt(String(item.studentId)) : null,
            };
          }),
        },
      },
      include: { items: { include: { student: { select: { id: true, firstName: true, lastName: true } } } }, student: true },
    });

    const userId = parseInt((session?.user as { id?: string } | undefined)?.id ?? "0");
    if (userId > 0) {
      const childrenNote = itemStudentIds.length > 1 ? ` (${itemStudentIds.length} fëmijë)` : "";
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE",
          entity: "Invoice",
          entityId: invoice.id,
          details: `Krijoi ${invoice.number} për ${primaryStudent.firstName} ${primaryStudent.lastName}${childrenNote}`,
        },
      });
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
