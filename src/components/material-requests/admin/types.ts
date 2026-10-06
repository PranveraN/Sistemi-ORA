import type { ExportableRequest } from "@/lib/materialRequestExport";
import { isTooSoon } from "@/lib/materialConfig";

export interface OrderLinkRow {
  quantityContributed: number;
  orderItem: { order: { id: number; orderNumber: string; status: string } };
}

export interface RequestItemRow {
  id: number;
  isCustom: boolean;
  materialId: number | null;
  material: { id: number; name: string; needsColor: boolean; reviewStatus?: string } | null;
  customItemName: string | null;
  customDescription: string | null;
  productLink: string | null;
  attachmentPath: string | null;
  quantity: number;
  approvedQuantity: number | null;
  deliveredQuantity: number;
  unit: string;
  color: string | null;
  itemReason: string | null;
  approvalNote: string | null;
  sourceText: string | null;
  matchType: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  orderLinks: OrderLinkRow[];
}

export interface MaterialRequestRow extends Omit<ExportableRequest, "items"> {
  id: number;
  teacherId: number;
  priority: string | null;
  dateNeeded: string | null;
  submittedAt: string | null;
  originalText: string | null;
  urgencyReason: string | null;
  items: RequestItemRow[];
  sentSmsAt: string | null;
  sentToPhone: string | null;
}

export interface PendingItem {
  requestItemId: number;
  requestId: number;
  teacherName: string;
  className?: string | null;
  dateNeeded?: string | null;
  priority: string | null;
  isCustom: boolean;
  materialId: number | null;
  materialName: string | null;
  supplierId: number | null;
  unit: string;
  color: string | null;
  remaining: number;
}

export const OPEN_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "ORDERED"]);
export const UNDECIDED = new Set(["SUBMITTED", "UNDER_REVIEW"]);

export const itemName = (it: RequestItemRow) => (it.isCustom ? it.customItemName : it.material?.name) ?? "Artikull";
export const orderedQty = (it: RequestItemRow) => it.orderLinks.reduce((s, l) => s + l.quantityContributed, 0);
export const sentDate = (r: MaterialRequestRow) => r.submittedAt ?? r.createdAt;

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Ditë kalendarike nga sot deri te data (negative = ka kaluar). */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86400000);
}

/** Etiketa e afatit: gjelbër mbi 3 ditë, portokalli 1–3 (dhe sot), e kuqe kur ka kaluar. */
export function deadlineBadge(date: string | null): { text: string; cls: string } | null {
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0) return { text: `Afati kaloi ${-d} ditë më parë`, cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (d === 0) return { text: "Nevojitet sot", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  return { text: `Nevojitet për ${d} ditë`, cls: d <= 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
}

/** U dërgua me më pak se rregulli i ditëve, pa qenë urgjente. */
export function isShortNotice(r: MaterialRequestRow, leadDays: number): boolean {
  if (r.priority === "URGENT" || !r.dateNeeded) return false;
  return isTooSoon(r.dateNeeded, leadDays, new Date(sentDate(r)));
}

/** Urgjentet së pari, pastaj afati më i afërt, pastaj më të rejat. */
export function compareRequests(a: MaterialRequestRow, b: MaterialRequestRow): number {
  const ua = a.priority === "URGENT" ? 0 : 1, ub = b.priority === "URGENT" ? 0 : 1;
  if (ua !== ub) return ua - ub;
  const da = a.dateNeeded ? new Date(a.dateNeeded).getTime() : Infinity;
  const db = b.dateNeeded ? new Date(b.dateNeeded).getTime() : Infinity;
  if (da !== db) return da - db;
  return new Date(sentDate(b)).getTime() - new Date(sentDate(a)).getTime();
}

/** Një rresht nga teksti i kërkesës (teksti i lirë, ose artikujt për kërkesat e vjetra). */
export function requestSnippet(r: MaterialRequestRow): string {
  if (r.originalText?.trim()) return r.originalText.trim().replace(/\s+/g, " ");
  return r.items.map(it => `${itemName(it)} ×${it.quantity}`).join(", ");
}
