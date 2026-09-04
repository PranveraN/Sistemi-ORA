import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const ORDER_INCLUDE = {
  supplier: { select: { id: true, emri: true } },
  createdBy: { select: { name: true } },
  items: {
    include: {
      material: { select: { id: true, name: true } },
      requestLinks: {
        include: {
          requestItem: {
            select: {
              id: true, color: true,
              request: { select: { id: true, teacher: { select: { name: true } } } },
            },
          },
        },
      },
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const status = req.nextUrl.searchParams.get("status");

  const orders = await prisma.materialOrder.findMany({
    where: { organizationId: orgId, ...(status ? { status } : {}) },
    include: ORDER_INCLUDE,
    orderBy: { orderDate: "desc" },
  });

  return NextResponse.json(orders);
}

interface LineContribution { requestItemId: number; quantity: number }
interface LineInput {
  materialId?: number;
  customItemName?: string;
  color?: string;
  unit: string;
  unitPrice?: number | string;
  contributions: LineContribution[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const lines: LineInput[] = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) {
    return NextResponse.json({ error: "Porosia duhet të ketë të paktën një artikull" }, { status: 400 });
  }

  let supplierId: number | null = null;
  if (body.supplierId) {
    const supplier = await prisma.sipartner.findUnique({ where: { id: parseInt(String(body.supplierId)) } });
    if (!supplier) return NextResponse.json({ error: "Furnitori i zgjedhur nuk ekziston" }, { status: 400 });
    supplierId = supplier.id;
  }

  // Verifikojmë "sasinë e mbetur" të çdo artikulli kërkese pikërisht si te
  // /pending-items — s'i besojmë klientit për sasitë, rillogariten këtu.
  const allRequestItemIds = [...new Set(lines.flatMap(l => l.contributions.map(c => c.requestItemId)))];
  const requestItems = await prisma.materialRequestItem.findMany({
    where: { id: { in: allRequestItemIds }, status: "APPROVED", request: { organizationId: orgId } },
    include: {
      orderLinks: {
        where: { orderItem: { order: { status: { not: "CANCELLED" } } } },
        select: { quantityContributed: true },
      },
    },
  });
  const remainingById = new Map(
    requestItems.map(it => [it.id, (it.approvedQuantity ?? 0) - it.orderLinks.reduce((s, l) => s + l.quantityContributed, 0)])
  );

  for (const line of lines) {
    if (!line.contributions?.length) {
      return NextResponse.json({ error: "Çdo rresht porosie duhet të ketë të paktën një kontribuim nga një kërkesë" }, { status: 400 });
    }
    for (const c of line.contributions) {
      const remaining = remainingById.get(c.requestItemId);
      if (remaining === undefined) {
        return NextResponse.json({ error: `Artikulli i kërkesës #${c.requestItemId} s'është më i disponueshëm për porosi` }, { status: 400 });
      }
      if (c.quantity <= 0 || c.quantity > remaining) {
        return NextResponse.json({ error: `Sasia e kërkuar (${c.quantity}) kalon sasinë e mbetur (${remaining}) për artikullin e kërkesës #${c.requestItemId}` }, { status: 400 });
      }
    }
    if (!line.materialId && !line.customItemName?.trim()) {
      return NextResponse.json({ error: "Çdo rresht duhet të ketë ose material nga katalogu ose emër të veçantë" }, { status: 400 });
    }
  }

  const year = new Date().getFullYear();
  const last = await prisma.materialOrder.findFirst({
    where: { orderNumber: { startsWith: `MAT-${year}-` } },
    orderBy: { orderNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.orderNumber.split("-").pop() || "0") : 0;
  const orderNumber = `MAT-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

  let totalQuantity = 0;
  let estimatedCost = 0;
  const orderItemsData = lines.map(line => {
    const quantity = line.contributions.reduce((s, c) => s + c.quantity, 0);
    const unitPrice = line.unitPrice !== undefined && line.unitPrice !== "" ? parseFloat(String(line.unitPrice)) : null;
    const totalPrice = unitPrice !== null ? Math.round(quantity * unitPrice * 100) / 100 : null;
    totalQuantity += quantity;
    estimatedCost += totalPrice ?? 0;
    return {
      materialId: line.materialId ?? null,
      customItemName: line.materialId ? null : line.customItemName!.trim(),
      color: line.color ? String(line.color).trim() || null : null,
      unit: line.unit,
      quantity, unitPrice, totalPrice,
      requestLinks: { create: line.contributions.map(c => ({ requestItemId: c.requestItemId, quantityContributed: c.quantity })) },
    };
  });

  const order = await prisma.materialOrder.create({
    data: {
      organizationId: orgId,
      orderNumber,
      supplierId,
      status: "PENDING",
      expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
      notes: body.notes ? String(body.notes).trim() : null,
      totalItems: lines.length,
      totalQuantity,
      estimatedCost,
      createdById: userId,
      items: { create: orderItemsData },
    },
    include: ORDER_INCLUDE,
  });

  await logAction(session, "CREATE", "MaterialOrder", order.id,
    `Krijoi porosinë ${order.orderNumber}${order.supplier ? ` te ${order.supplier.emri}` : ""} — ${order.totalItems} artikuj, ${order.totalQuantity} copë`);

  return NextResponse.json(order, { status: 201 });
}
