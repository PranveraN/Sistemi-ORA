import { cents, euro, DAY_MS, type AuditRuleDef, type Violation } from "./types";
import { categoryNames, fmtDate } from "./util";

// R09 — Nxënës të larguar/joaktivë me borxh të hapur ose me pagesa të reja.
//   • borxh i hapur (shuma e balance > 0 e të gjitha pagesave të tij)  → E ULËT (një për nxënës)
//   • pagesë me datë më shumë se 1 ditë pas datës së largimit          → MESATARE (një për pagesë)
export const r09: AuditRuleDef = {
  code: "R09",
  name: "Nxënës të larguar me borxh ose me pagesa të reja",
  description: "Nxënës joaktivë që kanë ende borxh, ose që kanë pagesa të regjistruara pas largimit.",
  module: "SHKOLLIMI",
  severity: "MESATARE",
  async run(ctx) {
    const students = await ctx.db.student.findMany({
      where: { organizationId: ctx.orgId, status: { not: "ACTIVE" } },
      select: { id: true, firstName: true, lastName: true, inactiveDate: true, leaveReason: true },
    });
    if (students.length === 0) return [];
    const byId = new Map(students.map(s => [s.id, s]));
    const [pays, cats] = await Promise.all([
      ctx.db.payment.findMany({
        where: { organizationId: ctx.orgId, studentId: { in: students.map(s => s.id) } },
        select: { id: true, studentId: true, categoryId: true, balance: true, paidAmount: true, paidDate: true, description: true },
      }),
      categoryNames(ctx.db, ctx.orgId),
    ]);
    const out: Violation[] = [];
    const debt = new Map<number, { cents: number; byCat: Record<string, number> }>();
    for (const p of pays) {
      const s = byId.get(p.studentId)!;
      if (p.balance > 0 && !(p.description ?? "").startsWith("FLEX_PAY_")) {
        const d = debt.get(p.studentId) ?? { cents: 0, byCat: {} };
        d.cents += cents(p.balance);
        const cn = cats.get(p.categoryId) ?? `#${p.categoryId}`;
        d.byCat[cn] = (d.byCat[cn] ?? 0) + cents(p.balance);
        debt.set(p.studentId, d);
      }
      if (s.inactiveDate && p.paidAmount > 0 && p.paidDate && p.paidDate.getTime() > s.inactiveDate.getTime() + DAY_MS) {
        out.push({
          fingerprint: `R09:pagese:${p.id}`, module: "SHKOLLIMI", entityType: "Payment", entityId: p.id, amountCents: cents(p.paidAmount),
          title: `Pagesë pas largimit: ${s.firstName} ${s.lastName}, ${euro(cents(p.paidAmount))} (${cats.get(p.categoryId) ?? "—"})`,
          description: `Larguar më ${fmtDate(s.inactiveDate)}, pagesa me datë ${fmtDate(p.paidDate)}.`,
          evidence: { studentId: s.id, paymentId: p.id, inactiveDate: s.inactiveDate, paidDate: p.paidDate },
        });
      }
    }
    for (const [sid, d] of debt) {
      const s = byId.get(sid)!;
      out.push({
        fingerprint: `R09:borxh:${sid}`, severity: "E_ULET", module: "SHKOLLIMI", entityType: "Student", entityId: sid, amountCents: d.cents,
        title: `Nxënës i larguar me borxh të hapur: ${s.firstName} ${s.lastName}, ${euro(d.cents)}`,
        description: `${Object.entries(d.byCat).map(([k, v]) => `${k} ${euro(v)}`).join(", ")}${s.inactiveDate ? ` · larguar më ${fmtDate(s.inactiveDate)}` : ""}${s.leaveReason ? ` · ${s.leaveReason}` : ""}.`,
        evidence: { studentId: sid, debtCents: d.cents, byCategory: d.byCat, inactiveDate: s.inactiveDate },
      });
    }
    return out;
  },
};
