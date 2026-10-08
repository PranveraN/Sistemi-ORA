import { euro, type AuditRuleDef, type Violation } from "./types";
import { computeTuitionFigures } from "../tuitionFigures";

// R08 — Barazimet e Shkollimit për vitin akademik aktual (s'ndryshon asnjë formulë):
//   1. Paguar = Cash + Bankë + Pa metodë                                  → E LARTË nëse s'përputhet
//   2. "Borxhe Shkollimi" (karta lart) ≠ "Borxhi i mbetur" (Pasqyra)       → MESATARE, me ndarjen
//      sipas përkufizimit të ri: borxh nga aktivët / nga të larguarit / kredi-mbipagesa
//   3. "Të hyra" (karta lart, edhe të larguarit) ≠ "Paguar" (Pasqyra, vetëm aktivët) → E ULËT
// (Totali i mbledhur = Bankë + Dorëzuar + Shpenzuar + Investuar + Arkë është i barabartë
// sipas ndërtimit te cashFlow.ts — "Në arkë" del si mbetje — prandaj s'kontrollohet këtu;
// mospërputhjet e arkës i kap R01 te numërimi.)
// Gjetjet kanë fingerprint sipas vitit dhe përditësohen me shifrat e fundit.
export const r08: AuditRuleDef = {
  code: "R08",
  name: "Barazimet e Shkollimit",
  description: "Kontrollon që i njëjti tregues të japë të njëjtin numër kudo, dhe e ndan borxhin: aktivë / të larguar / mbipagesa.",
  module: "SHKOLLIMI",
  severity: "MESATARE",
  async run(ctx) {
    const f = await computeTuitionFigures(ctx.db, ctx.orgId, ctx.academicYear);
    if (!f) return [];
    const y = `${ctx.academicYear}–${ctx.academicYear + 1}`;
    const out: Violation[] = [];
    const ch = f.overviewChannels;
    const channelsSum = ch.cashCents + ch.bankCents + ch.noMethodCents;
    if (channelsSum !== f.overviewPaidCents) {
      out.push({
        fingerprint: `R08:kanale:${ctx.academicYear}`, severity: "E_LARTE", module: "SHKOLLIMI", amountCents: f.overviewPaidCents - channelsSum,
        title: `Paguar ≠ Cash + Bankë + Pa metodë (${y})`,
        description: `Paguar ${euro(f.overviewPaidCents)}, ndërsa Cash ${euro(ch.cashCents)} + Bankë ${euro(ch.bankCents)} + Pa metodë ${euro(ch.noMethodCents)} = ${euro(channelsSum)}.`,
        evidence: { year: ctx.academicYear, ...ch, paidCents: f.overviewPaidCents },
      });
    }
    if (f.dashboardDebtCents !== f.overviewRemainingCents) {
      const t = f.target;
      out.push({
        fingerprint: `R08:borxhi:${ctx.academicYear}`, module: "SHKOLLIMI", amountCents: f.dashboardDebtCents - f.overviewRemainingCents,
        title: `"Borxhe Shkollimi" (${euro(f.dashboardDebtCents)}) ≠ "Borxhi i mbetur" (${euro(f.overviewRemainingCents)}) — ${y}`,
        description: `Sipas përkufizimit të ri (vetëm pagesa të konfirmuara, për çdo nxënës): borxh nga aktivët ${euro(t.debtActiveCents)} (${t.studentsActiveWithDebt} nxënës), `
          + `borxh nga të larguarit ${euro(t.debtDepartedCents)} (${t.studentsDepartedWithDebt} nxënës), kredi/mbipagesa ${euro(t.creditCents)} (${t.studentsWithCredit} nxënës).`,
        evidence: {
          year: ctx.academicYear,
          kartaBorxheShkollimi: f.dashboardDebtCents, borxhiIMbetur: f.overviewRemainingCents,
          totaliIPritur: f.overviewExpectedCents, paguarAktivet: f.overviewPaidCents,
          perkufizimiIRi: t,
          diferenca: f.dashboardDebtCents - f.overviewRemainingCents,
        },
      });
    }
    if (f.dashboardPaidCents !== f.overviewPaidCents) {
      out.push({
        fingerprint: `R08:paguar:${ctx.academicYear}`, severity: "E_ULET", module: "SHKOLLIMI", amountCents: f.dashboardPaidCents - f.overviewPaidCents,
        title: `"Të hyra" (${euro(f.dashboardPaidCents)}) ≠ "Paguar" në Pasqyrë (${euro(f.overviewPaidCents)}) — ${y}`,
        description: `Diferenca ${euro(f.dashboardPaidCents - f.overviewPaidCents)} janë pagesat e konfirmuara të nxënësve që s'janë më aktivë (karta lart i përfshin, Pasqyra jo).`,
        evidence: { year: ctx.academicYear, teHyra: f.dashboardPaidCents, paguarPasqyra: f.overviewPaidCents },
      });
    }
    return out;
  },
};
