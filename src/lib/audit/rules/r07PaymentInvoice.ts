import { cents, euro, DAY_MS, type AuditRuleDef, type Violation } from "./types";
import { categoryNames } from "./util";

// R07 — Pagesë pa dëshmi/faturë, ose faturë pa pagesë.
//   • faturë (INVOICE) e shënuar "Paguar" pa asnjë pagesë të lidhur  → MESATARE (një për faturë)
//   • pagesa me para të paguara pa asnjë dokument (as dëshmi DEP, as dëshmi
//     familjeje, as faturë) — të grupuara sipas kategorisë dhe muajit të pagesës,
//     që të mos krijohet një gjetje për çdo rresht                 → E ULËT
export const r07: AuditRuleDef = {
  code: "R07",
  name: "Pagesë pa dokument ose faturë pa pagesë",
  description: "Pagesa të paguara pa dëshmi/faturë, ose fatura të shënuara si të paguara pa asnjë pagesë.",
  module: "DOKUMENTET",
  severity: "MESATARE",
  async run(ctx) {
    const since = new Date(ctx.now.getTime() - ctx.config.lookbackDays * DAY_MS);
    const [invoices, bare, cats] = await Promise.all([
      ctx.db.invoice.findMany({
        where: { organizationId: ctx.orgId, type: "INVOICE", status: "PAID", payments: { none: {} } },
        select: { id: true, number: true, total: true, student: { select: { firstName: true, lastName: true } } },
      }),
      ctx.db.payment.findMany({
        where: { organizationId: ctx.orgId, paidAmount: { gt: 0 }, paidDate: { gte: since }, receiptNumber: null, familyReceiptId: null, invoiceId: null },
        select: { id: true, categoryId: true, paidAmount: true, paidDate: true },
      }),
      categoryNames(ctx.db, ctx.orgId),
    ]);
    const out: Violation[] = invoices.map(i => ({
      fingerprint: `R07:fature:${i.id}`, module: "DOKUMENTET", entityType: "Invoice", entityId: i.id, amountCents: cents(i.total),
      title: `Faturë "Paguar" pa asnjë pagesë: ${i.number} (${i.student.firstName} ${i.student.lastName})`,
      description: `Totali ${euro(cents(i.total))}. Asnjë pagesë s'është e lidhur me këtë faturë.`,
      evidence: { invoiceId: i.id, number: i.number, total: i.total },
    }));
    const groups = new Map<string, typeof bare>();
    for (const p of bare) {
      const k = `${p.categoryId}|${p.paidDate!.toISOString().slice(0, 7)}`;
      const g = groups.get(k) ?? []; g.push(p); groups.set(k, g);
    }
    for (const [k, g] of groups) {
      const [catId, month] = k.split("|");
      const total = g.reduce((s, p) => s + cents(p.paidAmount), 0);
      out.push({
        fingerprint: `R07:pa-dokument:${catId}:${month}`, severity: "E_ULET", module: "DOKUMENTET", amountCents: total,
        title: `${g.length} pagesa pa dëshmi/faturë — ${cats.get(Number(catId)) ?? "—"}, ${month}`,
        description: `Gjithsej ${euro(total)} të paguara pa asnjë dokument të lëshuar.`,
        evidence: { categoryId: Number(catId), month, paymentIds: g.map(p => p.id) },
      });
    }
    return out;
  },
};
