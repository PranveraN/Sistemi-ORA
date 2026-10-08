import { cents, euro, type AuditRuleDef, type Violation } from "./types";
import { auditLogs, fmtDate, ms, num, studentNames } from "./util";

// R02 — Pagesa të fshira ose të ndryshuara (veçanërisht shuma ose data).
// Nga gjurma e auditimit (Faza 1):
//   • fshirja e një pagese që kishte para të paguara               → E LARTË
//   • ulja e shumës së paguar, ose ndërrimi i datës/metodës së pagesës
//     pa rritje të shumës (një pagesë e re e pjesshme NUK është gjetje) → MESATARE
export const r02: AuditRuleDef = {
  code: "R02",
  name: "Pagesa të fshira ose të ndryshuara",
  description: "Pagesë me para të paguara që u fshi, ose iu ul shuma, ose iu ndërrua data/metoda e pagesës.",
  module: "SHKOLLIMI",
  severity: "MESATARE",
  async run(ctx) {
    const logs = (await auditLogs(ctx, ["Payment"])).filter(l => l.oldRow && num(l.oldRow.paidAmount) > 0);
    const names = await studentNames(ctx.db, logs.map(l => num((l.oldRow ?? l.newRow)?.studentId)));
    const out: Violation[] = [];
    for (const l of logs) {
      const o = l.oldRow!, n = l.newRow;
      const who = names.get(num(o.studentId)) ?? `nxënësi #${num(o.studentId)}`;
      const by = `${l.userName ?? "Përdorues i panjohur"}${l.reason ? ` — arsyeja: ${l.reason}` : ""}`;
      const base = { module: "SHKOLLIMI", entityType: "Payment", entityId: l.recordId ?? undefined };
      const evidence = { finAuditLogId: l.id, before: o, after: n, userId: l.userId, userName: l.userName, reason: l.reason, at: l.createdAt };
      if (l.action === "DELETE") {
        out.push({ ...base, fingerprint: `R02:del:${l.id}`, severity: "E_LARTE", amountCents: -cents(o.paidAmount),
          title: `U fshi një pagesë e paguar: ${who}, ${euro(cents(o.paidAmount))}`,
          description: `Pagesa #${l.recordId} (paguar më ${fmtDate(o.paidDate)}) u fshi nga ${by}.`, evidence });
        continue;
      }
      if (!n) continue;
      const paidOld = cents(o.paidAmount), paidNew = cents(n.paidAmount);
      if (paidNew < paidOld) {
        out.push({ ...base, fingerprint: `R02:ulje:${l.id}`, amountCents: paidNew - paidOld,
          title: `U ul shuma e paguar: ${who}, ${euro(paidOld)} → ${euro(paidNew)}`,
          description: `Ndryshoi: ${by}.`, evidence });
      } else if (paidNew === paidOld && (ms(o.paidDate) !== ms(n.paidDate) || o.method !== n.method)) {
        const what = [ms(o.paidDate) !== ms(n.paidDate) ? `data ${fmtDate(o.paidDate)} → ${fmtDate(n.paidDate)}` : null,
          o.method !== n.method ? `metoda ${o.method ?? "pa metodë"} → ${n.method ?? "pa metodë"}` : null].filter(Boolean).join(", ");
        out.push({ ...base, fingerprint: `R02:ndryshim:${l.id}`, amountCents: paidOld,
          title: `U ndryshua pagesa e paguar e ${who}: ${what}`,
          description: `Shuma ${euro(paidOld)}. Ndryshoi: ${by}.`, evidence });
      }
    }
    return out;
  },
};
