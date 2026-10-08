import type { PrismaClient } from "@prisma/client";
import { AUDITED_MODELS } from "./tables";

// Historiku i ndryshimeve të një rekordi (pagesë, faturë, …) nga FinAuditLog —
// për faqen e Auditimit (Faza 4) dhe për detajet e gjetjeve.

export interface HistoryChange { field: string; label: string; from: unknown; to: unknown }
export interface HistoryEntry {
  id: number; at: string; table: string; recordId: number | null; action: string;
  userName: string | null; ip: string | null; reason: string | null; source: string;
  changes: HistoryChange[];
}

const LABELS: Record<string, string> = {
  amount: "Shuma", finalAmount: "Për t'u paguar", paidAmount: "Paguar", balance: "Borxhi", discount: "Zbritja",
  discountType: "Lloji i zbritjes", scholarship: "Bursa", paidDate: "Data e pagesës", dueDate: "Afati", method: "Metoda",
  status: "Statusi", note: "Shënim", description: "Përshkrimi", confirmed: "Konfirmuar", month: "Muaji", year: "Viti",
  studentId: "Nxënësi", categoryId: "Kategoria", receiptNumber: "Nr. i dëshmisë", invoiceId: "Fatura", createdById: "Regjistruar nga",
  number: "Numri", total: "Totali", subtotal: "Nëntotali", quantity: "Sasia", unitPrice: "Çmimi", shuma: "Shuma", data: "Data",
  metoda: "Metoda", pershkrim: "Përshkrimi", paguar: "E paguar", deletedAt: "Fshirë më", kategoriId: "Kategoria", vlera: "Vlera",
  date: "Data", type: "Lloji", recipient: "Marrësi", paguesit: "Paguesi", muaj: "Muaji", vit: "Viti", kategoria: "Kategoria",
  discountPct: "Zbritja %", inactiveDate: "Data e largimit", enrollDate: "Data e regjistrimit", paymentPlan: "Plani i pagesës",
  countedCents: "Numëruar (cent)", systemCents: "Sipas sistemit (cent)", diffCents: "Diferenca (cent)",
};
const SKIP = new Set(["updatedAt", "organizationId"]);
const parse = (s: string | null): Record<string, unknown> | null => { if (!s) return null; try { return JSON.parse(s); } catch { return null; } };

function changesOf(action: string, o: Record<string, unknown> | null, n: Record<string, unknown> | null): HistoryChange[] {
  const keys = new Set([...Object.keys(o ?? {}), ...Object.keys(n ?? {})]);
  const out: HistoryChange[] = [];
  for (const k of keys) {
    if (SKIP.has(k) || (action === "UPDATE" && k === "createdAt")) continue;
    const from = o?.[k] ?? null, to = n?.[k] ?? null;
    if (action === "UPDATE" && JSON.stringify(from) === JSON.stringify(to)) continue;
    if (action === "CREATE" && to == null) continue;
    if (action === "DELETE" && from == null) continue;
    out.push({ field: k, label: LABELS[k] ?? k, from, to });
  }
  return out;
}

/** Historiku i një rekordi; për faturat përfshihen edhe ndryshimet e zërave të saj. */
export async function entityHistory(db: PrismaClient, table: string, id: number, limit = 200): Promise<HistoryEntry[]> {
  if (!AUDITED_MODELS.has(table)) return [];
  const logs = await db.finAuditLog.findMany({ where: { tableName: table, recordId: id }, orderBy: { id: "desc" }, take: limit });
  if (table === "Invoice") {
    const items = await db.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "FinAuditLog" WHERE "tableName" = 'InvoiceItem' AND (json_extract("newValues", '$.invoiceId') = ? OR json_extract("oldValues", '$.invoiceId') = ?) ORDER BY id DESC LIMIT ?`, id, id, limit);
    if (items.length) logs.push(...await db.finAuditLog.findMany({ where: { id: { in: items.map(i => Number(i.id)) } } }));
    logs.sort((a, b) => b.id - a.id);
  }
  return logs.map(l => ({
    id: l.id, at: l.createdAt.toISOString(), table: l.tableName, recordId: l.recordId, action: l.action,
    userName: l.userName, ip: l.ip, reason: l.reason, source: l.source,
    changes: changesOf(l.action, parse(l.oldValues), parse(l.newValues)),
  }));
}

/** Lidhja për te rekordi përkatës në aplikacion (nëse ka faqe për të). */
export async function entityLink(db: PrismaClient, entityType: string | null, entityId: number | null, evidence: Record<string, unknown> | null): Promise<{ href: string; label: string } | null> {
  const sid = Number(evidence?.studentId) || null;
  switch (entityType) {
    case "Payment": {
      const p = entityId ? await db.payment.findUnique({ where: { id: entityId }, select: { studentId: true } }) : null;
      const s = p?.studentId ?? sid;
      return s ? { href: `/students/${s}`, label: "Hap profilin e nxënësit (pagesat)" } : null;
    }
    case "Student": return entityId ? { href: `/students/${entityId}`, label: "Hap profilin e nxënësit" } : null;
    case "FeeExemption": {
      const e = entityId ? await db.feeExemption.findUnique({ where: { id: entityId }, select: { studentId: true } }) : null;
      return e ? { href: `/students/${e.studentId}`, label: "Hap profilin e nxënësit" } : null;
    }
    case "Invoice": return entityId ? { href: `/invoices/${entityId}`, label: "Hap faturën" } : null;
    case "CashClosing": return { href: "/arka", label: "Hap Numërimin e Arkave" };
    case "Shpenzim": return { href: "/shkollimi?tab=expense", label: "Hap Shpenzimet e Shkollimit" };
    case "Expense": return { href: "/shkollimi?tab=handover", label: "Hap Shkollimin (Dorëzimet/Shpenzimet)" };
    case "Hyra": return { href: "/hyrat", label: "Hap Të Hyrat Tjera" };
    case "Investim": return { href: "/investime", label: "Hap Investimet" };
    default: return sid ? { href: `/students/${sid}`, label: "Hap profilin e nxënësit" } : null;
  }
}
