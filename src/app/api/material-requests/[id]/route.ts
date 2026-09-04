import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REQUEST_INCLUDE = {
  teacher: { select: { name: true, email: true } },
  reviewedBy: { select: { name: true } },
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  items: {
    include: {
      material: { select: { id: true, name: true, needsColor: true } },
      customCategory: { select: { id: true, name: true } },
    },
    orderBy: { id: "asc" as const },
  },
} as const;

// Statusi i kërkesës (prind) rrjedh nga statuset e artikujve, jo anasjelltas —
// e vetmja "e vërtetë" mbahet te artikujt; ky funksion vetëm e përmbledh.
function deriveParentStatus(items: { status: string; quantity: number; approvedQuantity: number | null }[]): string {
  if (items.some(it => it.status === "PENDING")) return "UNDER_REVIEW";
  const allApproved = items.every(it => it.status === "APPROVED" && it.approvedQuantity === it.quantity);
  if (allApproved) return "APPROVED";
  const allRejected = items.every(it => it.status === "REJECTED");
  if (allRejected) return "REJECTED";
  return "PARTIALLY_APPROVED";
}

// Detaj i plotë i një kërkese të vetme — përdoret nga Historiku (Faza 8) për
// timeline-in e statuseve dhe gjurmimin e përmbushjes (porositur/pranuar).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const isManagement = role === "ADMIN" || role === "FINANCE";

  const { id } = await params;
  const requestId = parseInt(id);

  const request = await prisma.materialRequest.findFirst({
    where: { id: requestId, organizationId: orgId, ...(isManagement ? {} : { teacherId: userId }) },
    include: {
      ...REQUEST_INCLUDE,
      items: {
        ...REQUEST_INCLUDE.items,
        include: {
          ...REQUEST_INCLUDE.items.include,
          orderLinks: {
            include: { orderItem: { include: { order: { select: { id: true, orderNumber: true, status: true } } } } },
          },
        },
      },
      statusHistory: {
        include: { changedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!request) return NextResponse.json({ error: "Kërkesa nuk u gjet" }, { status: 404 });
  return NextResponse.json(request);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const { id } = await params;
  const requestId = parseInt(id);
  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const reviewNote = body.reviewNote ? String(body.reviewNote).trim() : null;

  const existing = await prisma.materialRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    select: { status: true, items: { select: { id: true, quantity: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Kërkesa nuk u gjet" }, { status: 404 });

  // ── Veprim i shpejtë: shëno "Në shqyrtim", pa prekur artikujt ──
  if (body.action === "UNDER_REVIEW") {
    const updated = await prisma.$transaction(async (tx) => {
      const req = await tx.materialRequest.update({
        where: { id: requestId },
        data: { status: "UNDER_REVIEW" },
        include: REQUEST_INCLUDE,
      });
      await tx.materialRequestStatusHistory.create({
        data: { requestId, fromStatus: existing.status, toStatus: "UNDER_REVIEW", changedById: userId },
      });
      return req;
    });
    return NextResponse.json(updated);
  }

  // ── Vendim artikull-për-artikull (aprovim i pjesshëm) ──
  if (Array.isArray(body.items)) {
    const validItemIds = new Set(existing.items.map(it => it.id));
    const decisions: { id: number; status: string; approvedQuantity: number | null }[] = [];

    for (const raw of body.items) {
      const itemId = parseInt(String(raw.id));
      if (!validItemIds.has(itemId)) continue;
      const status = String(raw.status ?? "");
      if (status !== "APPROVED" && status !== "REJECTED" && status !== "PENDING") continue;

      const itemQuantity = existing.items.find(it => it.id === itemId)!.quantity;
      let approvedQuantity: number | null = null;
      if (status === "APPROVED") {
        const requested = raw.approvedQuantity !== undefined && raw.approvedQuantity !== ""
          ? parseInt(String(raw.approvedQuantity))
          : itemQuantity;
        approvedQuantity = Math.min(Math.max(1, requested || itemQuantity), itemQuantity);
      }

      decisions.push({ id: itemId, status, approvedQuantity });
    }

    if (!decisions.length) {
      return NextResponse.json({ error: "Asnjë vendim i vlefshëm" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const d of decisions) {
        await tx.materialRequestItem.update({
          where: { id: d.id },
          data: { status: d.status, approvedQuantity: d.approvedQuantity, approvalNote: reviewNote },
        });
      }

      const allItems = await tx.materialRequestItem.findMany({
        where: { requestId },
        select: { status: true, quantity: true, approvedQuantity: true },
      });
      const parentStatus = deriveParentStatus(allItems);

      const req = await tx.materialRequest.update({
        where: { id: requestId },
        data: { status: parentStatus, reviewNote, reviewedById: userId, reviewedAt: new Date() },
        include: REQUEST_INCLUDE,
      });

      if (parentStatus !== existing.status) {
        await tx.materialRequestStatusHistory.create({
          data: { requestId, fromStatus: existing.status, toStatus: parentStatus, changedById: userId, note: reviewNote },
        });
      }

      return req;
    });

    return NextResponse.json(updated);
  }

  // ── Vendim i tërë kërkesës (rrugë e shpejtë: "Aprovo të gjitha" / "Refuzo të gjitha") ──
  const status = String(body.status ?? "");
  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Status i pavlefshëm" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.materialRequest.update({
      where: { id: requestId },
      data: { status, reviewNote, reviewedById: userId, reviewedAt: new Date() },
      include: REQUEST_INCLUDE,
    });

    for (const item of existing.items) {
      await tx.materialRequestItem.update({
        where: { id: item.id },
        data: {
          status,
          approvalNote: reviewNote,
          approvedQuantity: status === "APPROVED" ? item.quantity : null,
        },
      });
    }

    await tx.materialRequestStatusHistory.create({
      data: { requestId, fromStatus: existing.status, toStatus: status, changedById: userId, note: reviewNote },
    });

    return req;
  });

  return NextResponse.json(updated);
}
