import { cents, euro, DAY_MS, type AuditRuleDef, type Violation } from "./types";
import { fmtDate } from "./util";

// R12 — Shuma negative, zero ose data në të ardhmen.
//   • shumë negative (pagesë, zbritje, shpenzim, të hyra, investim, dorëzim)  → E LARTË
//   • shumë zero te shpenzimet, të hyrat, investimet, dorëzimet               → E ULËT
//     (te pagesat 0 € është normale: p.sh. lirimet)
//   • data e pagesës / shpenzimit / investimit / dorëzimit në të ardhmen
//     (përtej tolerancës futureToleranceDays)                                 → MESATARE
export const r12: AuditRuleDef = {
  code: "R12",
  name: "Shuma negative, zero ose data në të ardhmen",
  description: "Regjistrime me shuma negative ose zero, ose me data në të ardhmen.",
  module: "SHKOLLIMI",
  severity: "MESATARE",
  async run(ctx) {
    const future = new Date(ctx.now.getTime() + ctx.config.futureToleranceDays * DAY_MS);
    const org = ctx.orgId;
    const [pays, shp, hyrat, inv, exp] = await Promise.all([
      ctx.db.payment.findMany({
        where: { organizationId: org, OR: [{ amount: { lt: 0 } }, { finalAmount: { lt: 0 } }, { paidAmount: { lt: 0 } }, { discount: { lt: 0 } }, { scholarship: { lt: 0 } }, { paidAmount: { gt: 0 }, paidDate: { gt: future } }] },
        select: { id: true, amount: true, finalAmount: true, paidAmount: true, discount: true, scholarship: true, paidDate: true },
      }),
      ctx.db.shpenzim.findMany({ where: { deletedAt: null, OR: [{ shuma: { lte: 0 } }, { data: { gt: future } }] }, select: { id: true, shuma: true, data: true, pershkrim: true } }),
      ctx.db.hyra.findMany({ where: { shuma: { lte: 0 } }, select: { id: true, shuma: true, paguesit: true } }),
      ctx.db.investim.findMany({ where: { OR: [{ vlera: { lte: 0 } }, { data: { gt: future } }] }, select: { id: true, vlera: true, data: true, pershkrim: true } }),
      ctx.db.expense.findMany({ where: { OR: [{ amount: { lte: 0 } }, { date: { gt: future } }] }, select: { id: true, amount: true, date: true, type: true } }),
    ]);
    const out: Violation[] = [];
    const add = (v: Violation) => out.push(v);
    for (const p of pays) {
      const neg = ([["amount", p.amount], ["finalAmount", p.finalAmount], ["paidAmount", p.paidAmount], ["discount", p.discount], ["scholarship", p.scholarship]] as const).filter(([, v]) => v < 0);
      if (neg.length) add({ fingerprint: `R12:pagese-neg:${p.id}`, severity: "E_LARTE", module: "SHKOLLIMI", entityType: "Payment", entityId: p.id,
        title: `Pagesë me shumë negative (#${p.id})`, description: neg.map(([k, v]) => `${k} = ${v}`).join(", "), evidence: Object.fromEntries(neg) });
      if (p.paidAmount > 0 && p.paidDate && p.paidDate > future) add({ fingerprint: `R12:pagese-ardhme:${p.id}`, module: "SHKOLLIMI", entityType: "Payment", entityId: p.id,
        amountCents: cents(p.paidAmount), title: `Pagesë me datë në të ardhmen: ${fmtDate(p.paidDate)} (${euro(cents(p.paidAmount))})`, evidence: { paidDate: p.paidDate } });
    }
    for (const s of shp) {
      if (s.shuma <= 0) add({ fingerprint: `R12:shpenzim-shuma:${s.id}`, severity: s.shuma < 0 ? "E_LARTE" : "E_ULET", module: "SHPENZIME", entityType: "Shpenzim", entityId: s.id,
        title: `Shpenzim me shumë ${s.shuma < 0 ? "negative" : "zero"}: ${s.pershkrim ?? `#${s.id}`}`, evidence: { shuma: s.shuma } });
      if (s.data > future) add({ fingerprint: `R12:shpenzim-ardhme:${s.id}`, module: "SHPENZIME", entityType: "Shpenzim", entityId: s.id, amountCents: cents(s.shuma),
        title: `Shpenzim me datë në të ardhmen: ${fmtDate(s.data)} — ${s.pershkrim ?? `#${s.id}`}`, evidence: { data: s.data } });
    }
    for (const h of hyrat) add({ fingerprint: `R12:hyra:${h.id}`, severity: h.shuma < 0 ? "E_LARTE" : "E_ULET", module: "HYRAT", entityType: "Hyra", entityId: h.id,
      title: `Të hyra me shumë ${h.shuma < 0 ? "negative" : "zero"}: ${h.paguesit}`, evidence: { shuma: h.shuma } });
    for (const i of inv) {
      if (i.vlera <= 0) add({ fingerprint: `R12:investim-shuma:${i.id}`, severity: i.vlera < 0 ? "E_LARTE" : "E_ULET", module: "INVESTIME", entityType: "Investim", entityId: i.id,
        title: `Investim me vlerë ${i.vlera < 0 ? "negative" : "zero"}: ${i.pershkrim ?? `#${i.id}`}`, evidence: { vlera: i.vlera } });
      if (i.data > future) add({ fingerprint: `R12:investim-ardhme:${i.id}`, module: "INVESTIME", entityType: "Investim", entityId: i.id, amountCents: cents(i.vlera),
        title: `Investim me datë në të ardhmen: ${fmtDate(i.data)} — ${i.pershkrim ?? `#${i.id}`}`, evidence: { data: i.data } });
    }
    for (const e of exp) {
      const what = e.type === "HANDOVER" ? "Dorëzim" : "Shpenzim (skeda e vjetër)";
      if (e.amount <= 0) add({ fingerprint: `R12:expense-shuma:${e.id}`, severity: e.amount < 0 ? "E_LARTE" : "E_ULET", module: "SHKOLLIMI", entityType: "Expense", entityId: e.id,
        title: `${what} me shumë ${e.amount < 0 ? "negative" : "zero"} (#${e.id})`, evidence: { amount: e.amount } });
      if (e.date > future) add({ fingerprint: `R12:expense-ardhme:${e.id}`, module: "SHKOLLIMI", entityType: "Expense", entityId: e.id, amountCents: cents(e.amount),
        title: `${what} me datë në të ardhmen: ${fmtDate(e.date)} (${euro(cents(e.amount))})`, evidence: { date: e.date } });
    }
    return out;
  },
};
