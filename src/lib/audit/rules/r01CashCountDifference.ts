import { euro, type AuditRuleDef, type Violation } from "./types";

// R01 — Diferencë në numërimin e arkës. Çdo numërim (CashClosing) ku shuma e
// numëruar ≠ sipas sistemit. Krijohet edhe në çastin e numërimit (cashClosing.ts)
// me të njëjtin fingerprint — këtu sigurohet që asnjë të mos mungojë.
export const r01: AuditRuleDef = {
  code: "R01",
  name: "Diferencë në numërimin e arkës",
  description: "Shuma e numëruar në arkë nuk përputhet me shumën që duhet të jetë sipas sistemit.",
  module: "ARKA",
  severity: "KRITIKE",
  async run(ctx) {
    const rows = await ctx.db.cashClosing.findMany({ where: { organizationId: ctx.orgId, diffCents: { not: 0 } } });
    return rows.map((c): Violation => {
      const label = (() => { try { return JSON.parse(c.scope).label as string; } catch { return c.box; } })();
      return {
        fingerprint: `R01:closing:${c.id}`,
        module: "ARKA", entityType: "CashClosing", entityId: c.id, amountCents: c.diffCents,
        title: `Diferencë në arkën "${label}" më ${c.date}: ${c.diffCents < 0 ? "mungojnë" : "tepër"} ${euro(Math.abs(c.diffCents))}`,
        description: `Sipas sistemit ${euro(c.systemCents)}, numëruar ${euro(c.countedCents)}. Numëroi: ${c.countedByName ?? "—"}.`,
        evidence: { closingId: c.id, box: c.box, date: c.date, systemCents: c.systemCents, countedCents: c.countedCents, diffCents: c.diffCents },
      };
    });
  },
};
