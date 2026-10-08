import { cents, euro, DAY_MS, type AuditRuleDef, type Violation } from "./types";
import { auditLogs, num, studentNames } from "./util";

// R04 — Zbritje mbi kufirin e politikës (maxDiscountPct), ose zbritje e dhënë nga
// i njëjti përdorues që regjistroi pagesën (ndarja e detyrave).
//   • pagesë me zbritje + bursë > kufiri (në %)              → MESATARE
//   • nxënës aktiv me zbritje vëllai/motre (discountPct) > kufiri, ose lirim
//     (FeeExemption) aktiv me përqindje > kufiri             → E ULËT
//   • zbritja u dha/u rrit nga i njëjti përdorues që e regjistroi pagesën
//     (sipas gjurmës)                                         → E ULËT
export const r04: AuditRuleDef = {
  code: "R04",
  name: "Zbritje mbi kufirin ose nga i njëjti përdorues",
  description: "Zbritje/bursë mbi kufirin e politikës, ose zbritje e dhënë nga i njëjti përdorues që regjistroi pagesën.",
  module: "SHKOLLIMI",
  severity: "MESATARE",
  async run(ctx) {
    const max = ctx.config.maxDiscountPct;
    const since = new Date(ctx.now.getTime() - ctx.config.lookbackDays * DAY_MS);
    const out: Violation[] = [];

    const pays = await ctx.db.payment.findMany({
      where: { organizationId: ctx.orgId, amount: { gt: 0 }, createdAt: { gte: since } },
      select: { id: true, studentId: true, amount: true, finalAmount: true, discount: true, scholarship: true, createdById: true, month: true, year: true },
    });
    const [students, exemptions, logs] = await Promise.all([
      ctx.db.student.findMany({ where: { organizationId: ctx.orgId, status: "ACTIVE", discountPct: { gt: max } }, select: { id: true, firstName: true, lastName: true, discountPct: true } }),
      ctx.db.feeExemption.findMany({ where: { organizationId: ctx.orgId, cancelledAt: null, percent: { gt: max } } }),
      auditLogs(ctx, ["Payment"]),
    ]);
    const names = await studentNames(ctx.db, [...pays.map(p => p.studentId), ...exemptions.map(e => e.studentId), ...logs.map(l => num((l.newRow ?? l.oldRow)?.studentId))]);

    for (const p of pays) {
      const pct = ((p.amount - p.finalAmount) / p.amount) * 100;
      if (pct <= max + 0.001) continue;
      out.push({
        fingerprint: `R04:pagese:${p.id}`, module: "SHKOLLIMI", entityType: "Payment", entityId: p.id, amountCents: cents(p.amount - p.finalAmount),
        title: `Zbritje ${pct.toFixed(0)}% (mbi kufirin ${max}%): ${names.get(p.studentId) ?? `#${p.studentId}`}`,
        description: `Shuma ${euro(cents(p.amount))}, pas zbritjes/bursës ${euro(cents(p.finalAmount))}.`,
        evidence: { paymentId: p.id, amount: p.amount, finalAmount: p.finalAmount, discount: p.discount, scholarship: p.scholarship, pct, limit: max, createdById: p.createdById },
      });
    }
    for (const s of students) {
      out.push({
        fingerprint: `R04:nxenes:${s.id}:${s.discountPct}`, severity: "E_ULET", module: "SHKOLLIMI", entityType: "Student", entityId: s.id,
        title: `Zbritje e nxënësit ${s.discountPct}% (mbi kufirin ${max}%): ${s.firstName} ${s.lastName}`,
        evidence: { studentId: s.id, discountPct: s.discountPct, limit: max },
      });
    }
    for (const e of exemptions) {
      out.push({
        fingerprint: `R04:lirim:${e.id}`, severity: "E_ULET", module: "SHKOLLIMI", entityType: "FeeExemption", entityId: e.id,
        title: `Lirim ${e.percent}% (mbi kufirin ${max}%): ${names.get(e.studentId) ?? `#${e.studentId}`}`,
        description: `Dhënë nga ${e.createdByName ?? "—"}${e.reasonText ? ` — ${e.reasonText}` : ""}.`,
        evidence: { exemptionId: e.id, percent: e.percent, reason: e.reason, createdByName: e.createdByName },
      });
    }
    // Ndarja e detyrave: zbritja u dha nga ai që e regjistroi pagesën
    for (const l of logs) {
      const n = l.newRow, o = l.oldRow;
      if (!n || l.userId == null) continue;
      const discNew = num(n.discount) + num(n.scholarship), discOld = o ? num(o.discount) + num(o.scholarship) : 0;
      if (discNew <= discOld || num(n.paidAmount) <= 0) continue;
      const creator = num(n.createdById) || (l.action === "CREATE" ? l.userId : 0);
      if (creator !== l.userId) continue;
      out.push({
        fingerprint: `R04:i-njejti:${l.id}`, severity: "E_ULET", module: "SHKOLLIMI", entityType: "Payment", entityId: l.recordId ?? undefined,
        amountCents: cents(discNew - discOld),
        title: `Zbritje nga i njëjti përdorues që regjistroi pagesën: ${names.get(num(n.studentId)) ?? "—"}`,
        description: `${l.userName ?? "Përdoruesi"} regjistroi pagesën dhe dha zbritjen/bursën (${euro(cents(discNew - discOld))}).`,
        evidence: { finAuditLogId: l.id, userId: l.userId, userName: l.userName, discountBefore: discOld, discountAfter: discNew },
      });
    }
    return out;
  },
};
