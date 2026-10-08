import { cents, euro, DAY_MS, type AuditRuleDef, type Violation } from "./types";
import { categoryNames, fmtDate, studentNames } from "./util";

// R05 — Pagesa të mundshme të dyfishta: i njëjti nxënës, e njëjta kategori, i
// njëjti muaj/vit i detyrimit dhe e njëjta shumë e paguar, me data pagese brenda
// X ditëve (duplicateWindowDays). Pagesat e muajve të ndryshëm (p.sh. shtator e
// tetor të paguara bashkë) NUK janë dyfishim.
export const r05: AuditRuleDef = {
  code: "R05",
  name: "Pagesa të mundshme të dyfishta",
  description: "I njëjti nxënës, e njëjta shumë, për të njëjtin detyrim, brenda pak ditëve.",
  module: "SHKOLLIMI",
  severity: "E_LARTE",
  async run(ctx) {
    const since = new Date(ctx.now.getTime() - ctx.config.lookbackDays * DAY_MS);
    const pays = await ctx.db.payment.findMany({
      where: { organizationId: ctx.orgId, paidAmount: { gt: 0 }, paidDate: { not: null, gte: since } },
      select: { id: true, studentId: true, categoryId: true, month: true, year: true, paidAmount: true, paidDate: true, description: true },
      orderBy: { paidDate: "asc" },
    });
    const groups = new Map<string, typeof pays>();
    for (const p of pays) {
      if (p.description === "FLEX_HEADER") continue;
      const k = `${p.studentId}|${p.categoryId}|${p.month ?? ""}|${p.year ?? ""}|${cents(p.paidAmount)}`;
      const g = groups.get(k) ?? []; g.push(p); groups.set(k, g);
    }
    const window = ctx.config.duplicateWindowDays * DAY_MS;
    const pairs: [typeof pays[number], typeof pays[number]][] = [];
    for (const g of groups.values()) {
      for (let i = 1; i < g.length; i++) {
        if (g[i].paidDate!.getTime() - g[i - 1].paidDate!.getTime() <= window) pairs.push([g[i - 1], g[i]]);
      }
    }
    const [names, cats] = await Promise.all([studentNames(ctx.db, pairs.map(p => p[0].studentId)), categoryNames(ctx.db, ctx.orgId)]);
    return pairs.map(([a, b]): Violation => ({
      fingerprint: `R05:${a.id}:${b.id}`, module: "SHKOLLIMI", entityType: "Payment", entityId: b.id, amountCents: cents(b.paidAmount),
      title: `Pagesë e mundshme e dyfishtë: ${names.get(a.studentId) ?? `#${a.studentId}`}, ${euro(cents(a.paidAmount))} (${cats.get(a.categoryId) ?? "—"})`,
      description: `Pagesat #${a.id} (${fmtDate(a.paidDate)}) dhe #${b.id} (${fmtDate(b.paidDate)}) për të njëjtin detyrim${a.month ? ` (${a.month}/${a.year})` : ""}.`,
      evidence: { paymentIds: [a.id, b.id], studentId: a.studentId, categoryId: a.categoryId, month: a.month, year: a.year, paidAmount: a.paidAmount, dates: [a.paidDate, b.paidDate] },
    }));
  },
};
