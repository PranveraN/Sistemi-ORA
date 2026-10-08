import { cents, euro, DAY_MS, type AuditRuleDef, type Violation } from "./types";
import { auditLogs, fmtDate, ms, num, studentNames } from "./util";

// R03 — Pagesa të regjistruara me datë më shumë se X ditë në të kaluarën
// (X = backdateDays). Kapen dy raste:
//   • rreshti Payment u krijua me paidDate shumë para datës së regjistrimit;
//   • një pagesë e mëvonshme (rritje e shumës së paguar) u regjistrua me datë të vjetër.
export const r03: AuditRuleDef = {
  code: "R03",
  name: "Pagesa me datë të prapambetur",
  description: "Pagesë e regjistruar me datë pagese më shumë se X ditë para ditës kur u fut në sistem.",
  module: "SHKOLLIMI",
  severity: "MESATARE",
  async run(ctx) {
    const limit = ctx.config.backdateDays * DAY_MS;
    const since = new Date(ctx.now.getTime() - ctx.config.lookbackDays * DAY_MS);
    const out: Violation[] = [];

    // Krijimet (edhe ato para gjurmës së auditimit): createdAt − paidDate > X ditë
    const created = await ctx.db.payment.findMany({
      where: { organizationId: ctx.orgId, paidAmount: { gt: 0 }, paidDate: { not: null }, createdAt: { gte: since } },
      select: { id: true, studentId: true, paidAmount: true, paidDate: true, createdAt: true, createdById: true },
    });
    // Pagesat e mëvonshme në të njëjtin rresht, nga gjurma
    const logs = (await auditLogs(ctx, ["Payment"])).filter(l => l.action === "UPDATE" && l.oldRow && l.newRow && num(l.newRow.paidAmount) > num(l.oldRow.paidAmount));
    const names = await studentNames(ctx.db, [...created.map(p => p.studentId), ...logs.map(l => num(l.newRow!.studentId))]);

    for (const p of created) {
      const lag = p.createdAt.getTime() - p.paidDate!.getTime();
      if (lag <= limit) continue;
      out.push({
        fingerprint: `R03:create:${p.id}`, module: "SHKOLLIMI", entityType: "Payment", entityId: p.id, amountCents: cents(p.paidAmount),
        title: `Pagesë e regjistruar ${Math.floor(lag / DAY_MS)} ditë pas datës së pagesës: ${names.get(p.studentId) ?? `#${p.studentId}`}, ${euro(cents(p.paidAmount))}`,
        description: `Data e pagesës ${fmtDate(p.paidDate)}, regjistruar më ${fmtDate(p.createdAt)}.`,
        evidence: { paymentId: p.id, paidDate: p.paidDate, createdAt: p.createdAt, createdById: p.createdById, lagDays: Math.floor(lag / DAY_MS) },
      });
    }
    for (const l of logs) {
      const paidAt = ms(l.newRow!.paidDate);
      if (paidAt == null) continue;
      const lag = l.createdAt.getTime() - paidAt;
      if (lag <= limit) continue;
      const added = cents(l.newRow!.paidAmount) - cents(l.oldRow!.paidAmount);
      out.push({
        fingerprint: `R03:log:${l.id}`, module: "SHKOLLIMI", entityType: "Payment", entityId: l.recordId ?? undefined, amountCents: added,
        title: `Pagesë e shtuar ${Math.floor(lag / DAY_MS)} ditë pas datës së saj: ${names.get(num(l.newRow!.studentId)) ?? "—"}, +${euro(added)}`,
        description: `Data e pagesës ${fmtDate(paidAt)}, regjistruar më ${fmtDate(l.createdAt)} nga ${l.userName ?? "përdorues i panjohur"}.`,
        evidence: { finAuditLogId: l.id, paidDate: paidAt, recordedAt: l.createdAt, userName: l.userName, lagDays: Math.floor(lag / DAY_MS) },
      });
    }
    return out;
  },
};
