import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ORDER_LINK, recomputeRequestStatuses, notifyStatusChanges } from "@/lib/materialRequestStatus";
import { toTeacherView } from "@/lib/materialRequestTeacherView";

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

// Statusi i kërkesës (prind) rrjedh nga artikujt — shih src/lib/materialRequestStatus.ts.

const ITEM_STATUS_LABEL: Record<string, string> = { APPROVED: "përfshirë", REJECTED: "përjashtuar", PENDING: "në pritje" };

// Detaj i plotë i një kërkese të vetme — përdoret nga Historiku (Faza 8) për
// timeline-in e statuseve dhe gjurmimin e përmbushjes (porositur/pranuar).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const isManagement = role === "ADMIN" || role === "SUPERADMIN" || role === "FINANCE";

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
  return NextResponse.json(isManagement ? request : toTeacherView(request));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SUPERADMIN" && role !== "FINANCE") {
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
    select: {
      status: true,
      items: {
        select: {
          id: true, quantity: true, status: true, approvedQuantity: true, isCustom: true, customItemName: true,
          material: { select: { name: true } },
          orderLinks: { where: ACTIVE_ORDER_LINK, select: { quantityContributed: true } },
        },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: "Kërkesa nuk u gjet" }, { status: 404 });
  type ExistingItem = (typeof existing.items)[number];
  const orderedOf = (it: ExistingItem) => it.orderLinks.reduce((s, l) => s + l.quantityContributed, 0);
  const nameOf = (it: ExistingItem) => (it.isCustom ? it.customItemName : it.material?.name) ?? "Artikull";

  // ── Veprim i shpejtë: shëno "Në shqyrtim", pa prekur artikujt ──
  // (edhe automatikisht kur administrata hap një kërkesë "Në pritje")
  if (body.action === "UNDER_REVIEW") {
    if (existing.status !== "SUBMITTED") {
      const current = await prisma.materialRequest.findUnique({ where: { id: requestId }, include: REQUEST_INCLUDE });
      return NextResponse.json(current);
    }
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
    const changeNotes: string[] = [];

    for (const raw of body.items) {
      const itemId = parseInt(String(raw.id));
      if (!validItemIds.has(itemId)) continue;
      const status = String(raw.status ?? "");
      if (status !== "APPROVED" && status !== "REJECTED" && status !== "PENDING") continue;

      const cur = existing.items.find(it => it.id === itemId)!;
      const itemQuantity = cur.quantity;
      let approvedQuantity: number | null = null;
      if (status === "APPROVED") {
        const requested = raw.approvedQuantity !== undefined && raw.approvedQuantity !== ""
          ? parseInt(String(raw.approvedQuantity))
          : itemQuantity;
        approvedQuantity = Math.min(Math.max(1, requested || itemQuantity), itemQuantity);
      }

      // Artikulli që është tashmë në porosi s'mund të përjashtohet ose të ulet nën sasinë e porositur
      const ordered = orderedOf(cur);
      if (ordered > 0 && (status !== "APPROVED" || (approvedQuantity ?? 0) < ordered)) {
        return NextResponse.json(
          { error: `"${nameOf(cur)}" është tashmë në porosi (${ordered}) — anuloje porosinë para se ta ulësh ose ta përjashtosh.` },
          { status: 409 }
        );
      }

      if (cur.status !== status) {
        changeNotes.push(`${nameOf(cur)}: ${ITEM_STATUS_LABEL[status]}${status === "APPROVED" ? ` (${approvedQuantity})` : ""}`);
      } else if (status === "APPROVED" && cur.approvedQuantity !== approvedQuantity) {
        changeNotes.push(`${nameOf(cur)}: sasia ${cur.approvedQuantity ?? cur.quantity} → ${approvedQuantity}`);
      }

      decisions.push({ id: itemId, status, approvedQuantity });
    }

    if (!decisions.length) {
      return NextResponse.json({ error: "Asnjë vendim i vlefshëm" }, { status: 400 });
    }

    const { updated, changes } = await prisma.$transaction(async (tx) => {
      for (const d of decisions) {
        await tx.materialRequestItem.update({
          where: { id: d.id },
          data: { status: d.status, approvedQuantity: d.approvedQuantity, approvalNote: reviewNote },
        });
      }
      await tx.materialRequest.update({
        where: { id: requestId },
        data: { reviewNote, reviewedById: userId, reviewedAt: new Date() },
      });
      const changes = await recomputeRequestStatuses(tx, [requestId], userId, reviewNote);

      // Ndryshimet e artikujve/sasive ruhen te historiku (data + përdoruesi) edhe kur statusi s'ndryshon
      if (changeNotes.length) {
        const now = (await tx.materialRequest.findUnique({ where: { id: requestId }, select: { status: true } }))!.status;
        await tx.materialRequestStatusHistory.create({
          data: { requestId, fromStatus: now, toStatus: now, changedById: userId, note: changeNotes.join("; ") },
        });
      }

      const updated = await tx.materialRequest.findUnique({ where: { id: requestId }, include: REQUEST_INCLUDE });
      return { updated, changes };
    });

    notifyStatusChanges(changes, reviewNote).catch(() => {});

    return NextResponse.json(updated);
  }

  // ── Vendim i tërë kërkesës (rrugë e shpejtë: "Aprovo të gjitha" / "Refuzo") ──
  const status = String(body.status ?? "");
  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Status i pavlefshëm" }, { status: 400 });
  }
  if (status === "REJECTED" && !reviewNote) {
    return NextResponse.json({ error: "Shkruaj arsyen e refuzimit — i dërgohet mësuesit." }, { status: 400 });
  }
  const orderedItems = existing.items.filter(it => orderedOf(it) > 0);
  if (orderedItems.length) {
    return NextResponse.json(
      { error: `${orderedItems.length} artikuj janë tashmë në porosi — anuloje porosinë para se ta ndryshosh vendimin.` },
      { status: 409 }
    );
  }

  const { updated, changes } = await prisma.$transaction(async (tx) => {
    await tx.materialRequest.update({
      where: { id: requestId },
      data: { reviewNote, reviewedById: userId, reviewedAt: new Date() },
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

    const changes = await recomputeRequestStatuses(tx, [requestId], userId, reviewNote);
    const updated = await tx.materialRequest.findUnique({ where: { id: requestId }, include: REQUEST_INCLUDE });
    return { updated, changes };
  });

  notifyStatusChanges(changes, reviewNote).catch(() => {});

  return NextResponse.json(updated);
}

// Lejohet vetëm nëse asnjë artikull s'është përfshirë ende në ndonjë porosi
// (do të prishte gjurmën e porosisë/pranimit) — përndryshe çaktivizo në vend
// të fshirjes (statuset ekzistuese e mbulojnë këtë rast, s'ka "aktiv/joaktiv"
// të veçantë për kërkesat, ndaj fshirja mbetet e vetmja rrugë kur nevojitet).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SUPERADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const requestId = parseInt(id);

  const existing = await prisma.materialRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    select: { items: { select: { id: true, orderLinks: { select: { id: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Kërkesa nuk u gjet" }, { status: 404 });

  const orderedCount = existing.items.filter(it => it.orderLinks.length > 0).length;
  if (orderedCount > 0) {
    return NextResponse.json(
      { error: `${orderedCount} nga artikujt tashmë janë përfshirë në një porosi — kërkesa s'mund të fshihet` },
      { status: 409 }
    );
  }

  await prisma.materialRequest.delete({ where: { id: requestId } });
  return NextResponse.json({ success: true });
}
