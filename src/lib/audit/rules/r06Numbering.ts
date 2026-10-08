import type { AuditRuleDef, Violation } from "./types";

// R06 — Boshllëqe ose dyfishime në numërimin e dokumenteve. Seritë "PREFIKS-VIT-NNNN":
//   DEP (dëshmitë e pagesave), FAM (dëshmitë e familjeve), FAT/PRO/OFR (faturat).
// Një boshllëk (p.sh. DEP-2026-0007 mungon mes 0006 dhe 0008) zakonisht do të
// thotë se një dokument u fshi. Profaturat e TIMI Invest kontrollohen për dyfishime.
// Një gjetje për çdo seri/vit (përditësohet kur ndryshojnë numrat që mungojnë).

const SERIES: Record<string, string> = { DEP: "dëshmitë e pagesave", FAM: "dëshmitë e familjeve", FAT: "faturat", PRO: "profaturat", OFR: "ofertat" };
const RE = /^([A-Z]{3})-(\d{4})-(\d+)$/;

function gaps(nums: number[]): number[] {
  const set = new Set(nums);
  const max = Math.max(...nums);
  const out: number[] = [];
  for (let i = 1; i < max; i++) if (!set.has(i)) out.push(i);
  return out;
}

export const r06: AuditRuleDef = {
  code: "R06",
  name: "Boshllëqe ose dyfishime në numërimin e dokumenteve",
  description: "Numra që mungojnë në seritë e dëshmive/faturave (dokument i fshirë), ose numra të përsëritur.",
  module: "DOKUMENTET",
  severity: "MESATARE",
  async run(ctx) {
    const [pays, fams, invs, ti] = await Promise.all([
      ctx.db.payment.findMany({ where: { organizationId: ctx.orgId, receiptNumber: { not: null } }, select: { receiptNumber: true } }),
      ctx.db.familyReceipt.findMany({ where: { organizationId: ctx.orgId }, select: { receiptNumber: true } }),
      ctx.db.invoice.findMany({ where: { organizationId: ctx.orgId }, select: { number: true } }),
      ctx.db.timiInvestInvoice.findMany({ select: { id: true, number: true } }),
    ]);
    const series = new Map<string, number[]>();
    for (const n of [...pays.map(p => p.receiptNumber!), ...fams.map(f => f.receiptNumber), ...invs.map(i => i.number)]) {
      const m = RE.exec(n);
      if (!m || !SERIES[m[1]]) continue;
      const k = `${m[1]}-${m[2]}`;
      const a = series.get(k) ?? []; a.push(parseInt(m[3], 10)); series.set(k, a);
    }
    const out: Violation[] = [];
    for (const [k, nums] of series) {
      const missing = gaps(nums);
      if (missing.length === 0) continue;
      const [prefix, year] = k.split("-");
      const list = missing.map(n => `${k}-${String(n).padStart(4, "0")}`);
      out.push({
        fingerprint: `R06:${k}`, severity: prefix === "FAT" ? "MESATARE" : "E_ULET", module: "DOKUMENTET",
        title: `${missing.length} numra mungojnë te ${SERIES[prefix]} ${year}`,
        description: `Mungojnë: ${list.slice(0, 15).join(", ")}${list.length > 15 ? ` … (+${list.length - 15})` : ""}. Zakonisht do të thotë se dokumenti u fshi — kontrolloni gjurmën e auditimit.`,
        evidence: { series: k, missing: list, highest: Math.max(...nums), count: nums.length },
      });
    }
    const byNumber = new Map<string, number[]>();
    for (const t of ti) { const a = byNumber.get(t.number) ?? []; a.push(t.id); byNumber.set(t.number, a); }
    for (const [number, ids] of byNumber) {
      if (ids.length < 2) continue;
      out.push({
        fingerprint: `R06:ti-dyfish:${number}`, module: "DOKUMENTET", entityType: "TimiInvestInvoice", entityId: ids[1],
        title: `Numër i përsëritur i profaturës TIMI Invest: ${number} (${ids.length} herë)`,
        evidence: { number, ids },
      });
    }
    return out;
  },
};
