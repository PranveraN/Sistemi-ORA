import type { AuditRuleDef, Violation } from "./types";
import { computeTuitionFigures } from "../tuitionFigures";

// R10 — Nxënës aktivë pa detyrim shkollimi për vitin akademik aktual: asnjë rresht
// pagese Shkollimi dhe pa TIMI Invest. (Pasqyra i llogarit me çmimin standard, por
// në sistem s'ka plan pagese për ta.) Një gjetje për nxënës.
export const r10: AuditRuleDef = {
  code: "R10",
  name: "Nxënës aktivë pa detyrim shkollimi",
  description: "Nxënës aktivë që s'kanë asnjë plan/pagesë Shkollimi për vitin akademik aktual.",
  module: "SHKOLLIMI",
  severity: "MESATARE",
  async run(ctx) {
    const f = await computeTuitionFigures(ctx.db, ctx.orgId, ctx.academicYear);
    if (!f) return [];
    const y = `${ctx.academicYear}–${ctx.academicYear + 1}`;
    return f.activeWithoutObligation.map((s): Violation => ({
      fingerprint: `R10:${ctx.academicYear}:${s.id}`, module: "SHKOLLIMI", entityType: "Student", entityId: s.id,
      title: `Pa detyrim shkollimi për ${y}: ${s.name}${s.className ? ` (${s.className})` : ""}`,
      description: "Nxënësi është aktiv, por s'ka asnjë plan/pagesë Shkollimi për këtë vit.",
      evidence: { studentId: s.id, year: ctx.academicYear },
    }));
  },
};
