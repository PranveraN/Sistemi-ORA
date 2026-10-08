import { euro, DAY_MS, type AuditRuleDef, type Violation } from "./types";
import { CASH_TABLES, dayKey, movementsOf } from "../cashEffect";
import { loadCashBoxes } from "../cashClosing";
import { auditLogs } from "./util";

// R11 — Cash që s'është dorëzuar pas X ditësh (undeliveredCashDays), për çdo arkë.
// Parimi "e para që hyn, e para që del": paratë e hyra para X ditësh (+ shuma e
// numëruar herën e parë, nëse është më e vjetër) − gjithë daljet (dorëzime,
// shpenzime, investime). Nëse mbetet diçka mbi pragun, ato para të vjetra janë
// ende në arkë. Lëvizjet merren nga gjurma e auditimit (Faza 1). Një gjetje për
// arkë, që përditësohet me shumën e fundit.
export const r11: AuditRuleDef = {
  code: "R11",
  name: "Cash i padorëzuar pas X ditësh",
  description: "Para cash që kanë hyrë në arkë më shumë se X ditë më parë dhe s'janë dorëzuar/shpenzuar ende.",
  module: "ARKA",
  severity: "MESATARE",
  async run(ctx) {
    const cutoff = dayKey(new Date(ctx.now.getTime() - ctx.config.undeliveredCashDays * DAY_MS))!;
    const [boxes, logs, openings] = await Promise.all([
      loadCashBoxes(ctx.db, ctx.orgId),
      auditLogs(ctx, [...CASH_TABLES]),
      ctx.db.cashClosing.findMany({ where: { organizationId: ctx.orgId, kind: "OPENING" } }),
    ]);
    const out: Violation[] = [];
    for (const box of boxes) {
      const opening = openings.find(o => o.box === box.key);
      let oldIn = opening && opening.date <= cutoff ? opening.countedCents : 0;
      let allOut = 0;
      for (const l of logs) {
        if (opening && l.id <= opening.lastLogId) continue; // para hapjes: pjesë e shumës së numëruar
        for (const m of movementsOf(l.tableName, l.oldRow, l.newRow, box)) {
          if (m.cents > 0) { if (m.day <= cutoff) oldIn += m.cents; } else allOut -= m.cents;
        }
      }
      const remaining = oldIn - allOut;
      if (remaining <= Math.round(ctx.config.undeliveredMinEuro * 100) || remaining <= 0) continue;
      out.push({
        fingerprint: `R11:${box.key}`, module: "ARKA", amountCents: remaining,
        title: `Arka "${box.label}": ${euro(remaining)} cash të hyra para më shumë se ${ctx.config.undeliveredCashDays} ditësh s'janë dorëzuar`,
        description: `Hyrje deri më ${cutoff}: ${euro(oldIn)}; gjithë daljet (dorëzime, shpenzime, investime): ${euro(allOut)}.`,
        evidence: { box: box.key, cutoff, oldInCents: oldIn, outCents: allOut, remainingCents: remaining, days: ctx.config.undeliveredCashDays },
      });
    }
    return out;
  },
};
