import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendDecisionEmail } from "@/lib/materialRequestEmails";

// Statusi i kërkesës (prind) rrjedh nga artikujt e saj — e vetmja "e vërtetë"
// mbahet te artikujt (vendimi, sasia e aprovuar), te lidhjet me porositë dhe
// te sasitë e pranuara. Çdo vend që prek këto (vendimi, krijimi/anulimi/
// pranimi i porosisë) thërret recomputeRequestStatuses() — asnjë kod tjetër
// s'shkruan ORDERED/DELIVERED drejtpërdrejt.

type Tx = Prisma.TransactionClient;

/** Lidhjet me porosi që s'janë anuluar. */
export const ACTIVE_ORDER_LINK = { orderItem: { order: { status: { not: "CANCELLED" } } } } as const;

export interface DeriveItem {
  status: string;
  quantity: number;
  approvedQuantity: number | null;
  orderedQuantity: number;
  deliveredQuantity: number;
}

export function deriveRequestStatus(current: string, items: DeriveItem[]): string {
  if (!items.length) return current;
  if (items.some(it => it.status === "PENDING")) {
    return current === "SUBMITTED" && items.every(it => it.status === "PENDING") ? "SUBMITTED" : "UNDER_REVIEW";
  }
  const approved = items.filter(it => it.status === "APPROVED" && (it.approvedQuantity ?? 0) > 0);
  if (!approved.length) return "REJECTED";
  if (approved.some(it => Math.min(it.deliveredQuantity, it.approvedQuantity ?? 0) > 0)) return "DELIVERED";
  if (approved.some(it => it.orderedQuantity > 0)) return "ORDERED";
  const full = items.every(it => it.status === "APPROVED" && it.approvedQuantity === it.quantity);
  return full ? "APPROVED" : "PARTIALLY_APPROVED";
}

/**
 * Sa ka ardhur për çdo artikull kërkese: sasia e pranuar e çdo rreshti porosie
 * ndahet te kërkesat e lidhura sipas radhës së lidhjes (e para mbushet e para).
 */
async function computeDelivered(tx: Tx, requestItemIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (!requestItemIds.length) return result;
  const links = await tx.materialOrderRequestItem.findMany({
    where: { requestItemId: { in: requestItemIds }, ...ACTIVE_ORDER_LINK },
    select: { orderItemId: true },
  });
  const orderItemIds = [...new Set(links.map(l => l.orderItemId))];
  if (!orderItemIds.length) return result;
  const wanted = new Set(requestItemIds);
  const orderItems = await tx.materialOrderItem.findMany({
    where: { id: { in: orderItemIds } },
    select: { receivedQuantity: true, requestLinks: { select: { requestItemId: true, quantityContributed: true }, orderBy: { id: "asc" } } },
  });
  for (const oi of orderItems) {
    let left = oi.receivedQuantity;
    for (const l of oi.requestLinks) {
      const share = Math.min(l.quantityContributed, Math.max(0, left));
      left -= share;
      if (wanted.has(l.requestItemId)) result.set(l.requestItemId, (result.get(l.requestItemId) ?? 0) + share);
    }
  }
  return result;
}

export interface StatusChange { requestId: number; from: string; to: string }

/**
 * Rillogarit sasinë e dorëzuar dhe statusin e kërkesave të dhëna; shkruan
 * historikun për çdo ndryshim statusi. Idempotente — mund të thirret sa herë.
 */
export async function recomputeRequestStatuses(tx: Tx, requestIds: number[], userId: number, note?: string | null): Promise<StatusChange[]> {
  const plan = await planRequestStatuses(tx, requestIds);
  const changes: StatusChange[] = [];
  for (const p of plan) {
    for (const d of p.deliveries) {
      await tx.materialRequestItem.update({ where: { id: d.itemId }, data: { deliveredQuantity: d.quantity } });
    }
    if (p.to === p.from) continue;
    await tx.materialRequest.update({
      where: { id: p.requestId },
      data: { status: p.to, ...(p.to === "DELIVERED" && !p.deliveredAt ? { deliveredAt: new Date(), deliveredById: userId } : {}) },
    });
    await tx.materialRequestStatusHistory.create({
      data: { requestId: p.requestId, fromStatus: p.from, toStatus: p.to, changedById: userId, note: note ?? null },
    });
    changes.push({ requestId: p.requestId, from: p.from, to: p.to });
  }
  return changes;
}

export interface StatusPlan extends StatusChange {
  deliveredAt: Date | null;
  /** Artikujt ku sasia e dorëzuar ndryshon. */
  deliveries: { itemId: number; quantity: number }[];
}

/** VETËM LEXIM — çfarë do të ndryshonte recomputeRequestStatuses() (përdoret edhe nga pamja paraprake). */
export async function planRequestStatuses(tx: Tx, requestIds: number[]): Promise<StatusPlan[]> {
  const ids = [...new Set(requestIds)].filter(Boolean);
  if (!ids.length) return [];
  const requests = await tx.materialRequest.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, status: true, deliveredAt: true,
      items: {
        select: {
          id: true, status: true, quantity: true, approvedQuantity: true, deliveredQuantity: true,
          orderLinks: { where: ACTIVE_ORDER_LINK, select: { quantityContributed: true } },
        },
      },
    },
  });
  const delivered = await computeDelivered(tx, requests.flatMap(r => r.items.map(it => it.id)));

  const plan: StatusPlan[] = [];
  for (const r of requests) {
    const items: DeriveItem[] = [];
    const deliveries: StatusPlan["deliveries"] = [];
    for (const it of r.items) {
      const del = delivered.get(it.id) ?? 0;
      if (del !== it.deliveredQuantity) deliveries.push({ itemId: it.id, quantity: del });
      items.push({
        status: it.status, quantity: it.quantity, approvedQuantity: it.approvedQuantity,
        orderedQuantity: it.orderLinks.reduce((s, l) => s + l.quantityContributed, 0),
        deliveredQuantity: del,
      });
    }
    const to = deriveRequestStatus(r.status, items);
    if (to === r.status && !deliveries.length) continue;
    plan.push({ requestId: r.id, from: r.status, to, deliveredAt: r.deliveredAt, deliveries });
  }
  return plan;
}

/**
 * Migrimi te statuset e reja (Porositur/Dorëzuar): prek VETËM kërkesat që kanë
 * artikuj në ndonjë porosi — të tjerat mbeten siç janë. Kthen planin.
 */
export async function planOrderedRequestsBackfill(orgId: number): Promise<StatusPlan[]> {
  const linked = await prisma.materialRequest.findMany({
    where: { organizationId: orgId, items: { some: { orderLinks: { some: {} } } } },
    select: { id: true },
  });
  return planRequestStatuses(prisma as unknown as Tx, linked.map(r => r.id));
}

const NOTIFY_STATUSES = new Set(["APPROVED", "PARTIALLY_APPROVED", "REJECTED", "ORDERED", "DELIVERED"]);

/** Email te mësuesi për çdo ndryshim statusi (best-effort, jashtë transaksionit). */
export async function notifyStatusChanges(changes: StatusChange[], note?: string | null): Promise<void> {
  for (const c of changes) {
    if (!NOTIFY_STATUSES.has(c.to)) continue;
    // Kthimi te "Aprovuara" pas anulimit të porosisë s'është lajm për mësuesin
    if ((c.to === "APPROVED" || c.to === "PARTIALLY_APPROVED") && (c.from === "ORDERED" || c.from === "DELIVERED")) continue;
    const req = await prisma.materialRequest.findUnique({
      where: { id: c.requestId },
      include: { teacher: { select: { name: true, email: true } }, items: { include: { material: { select: { name: true } } } } },
    });
    if (req) await sendDecisionEmail(req, c.to, note ?? null).catch(() => {});
  }
}
