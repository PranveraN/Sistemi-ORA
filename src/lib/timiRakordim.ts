import type { PrismaClient } from "@prisma/client";
import { logTimi, type TimiActor } from "@/lib/timiAudit";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";

// Moduli TIMI INVEST — Faza 4: rakordimi mujor me bankën dhe bashkimi i dyfishimeve.
// Rakordimi vetëm KRAHASON (ekstrakti vs pagesat në Orë) — asnjë pagesë s'krijohet/ndryshohet
// vetvetiu. Bashkimi: rreshti i dytë s'fshihet (active=false, bashkuarMe), mund të kthehet.

type Db = PrismaClient;
const DAY = 24 * 60 * 60 * 1000;

export interface RreshtBanke { data: string; cents: number; pershkrim: string }
export type StatusRakordimi = "PERPUTHET" | "VETEM_BANKE" | "VETEM_ORA" | "NE_RREGULL";

export const celesi = (r: RreshtBanke, i: number) => `B${i}|${r.data}|${r.cents}`;

/** A është i mbyllur muaji (kalendarik) i kësaj date? */
export async function muajMbyllur(db: Db, orgId: number, date: Date) {
  return db.timiRakordim.findFirst({ where: { organizationId: orgId, viti: date.getUTCFullYear(), muaji: date.getUTCMonth() + 1, statusi: "MBYLLUR" } });
}

export async function rakordo(db: Db, orgId: number, viti: number, muaji: number) {
  const rak = await db.timiRakordim.findUnique({ where: { organizationId_viti_muaji: { organizationId: orgId, viti, muaji } } });
  const banka: RreshtBanke[] = rak ? JSON.parse(rak.rreshtat) : [];
  const shenimet: Record<string, string> = rak ? JSON.parse(rak.shenimet) : {};
  const fillim = new Date(Date.UTC(viti, muaji - 1, 1)), fund = new Date(Date.UTC(viti, muaji, 1));
  // Pagesat në Orë: të ruajtura, jo të stornuara — me ±5 ditë rreth muajit për përputhjet në skaje
  const ora = await db.timiPagese.findMany({
    where: { organizationId: orgId, statusi: "RUAJTUR", deletedAt: null, data: { gte: new Date(fillim.getTime() - 5 * DAY), lt: new Date(fund.getTime() + 5 * DAY) } },
    orderBy: [{ data: "asc" }, { id: "asc" }],
  });
  const perdorur = new Set<number>();
  const rreshtat: { celes: string; status: StatusRakordimi; banka?: RreshtBanke; ora?: { id: number; data: string; cents: number; referenca: string | null; prindi: string | null; femijet: string }; shenim?: string }[] = [];
  banka.forEach((b, i) => {
    const d = new Date(`${b.data}T00:00:00Z`).getTime();
    const m = ora.filter(o => !perdorur.has(o.id) && o.shumaCents === b.cents && Math.abs(o.data.getTime() - d) <= 5 * DAY)
      .sort((x, y) => Math.abs(x.data.getTime() - d) - Math.abs(y.data.getTime() - d))[0];
    const k = celesi(b, i);
    if (m) {
      perdorur.add(m.id);
      rreshtat.push({ celes: k, status: "PERPUTHET", banka: b, ora: oraInfo(m) });
    } else {
      rreshtat.push({ celes: k, status: shenimet[k] ? "NE_RREGULL" : "VETEM_BANKE", banka: b, shenim: shenimet[k] });
    }
  });
  for (const o of ora) {
    if (perdorur.has(o.id) || o.data < fillim || o.data >= fund) continue;
    const k = `O${o.id}`;
    rreshtat.push({ celes: k, status: shenimet[k] ? "NE_RREGULL" : "VETEM_ORA", ora: oraInfo(o), shenim: shenimet[k] });
  }
  const neMuaj = ora.filter(o => o.data >= fillim && o.data < fund);
  return {
    viti, muaji, ngarkuar: !!rak && banka.length > 0, emriSkedarit: rak?.emriSkedarit ?? null, ngarkuarAt: rak?.ngarkuarAt ?? null, ngarkuarNga: rak?.ngarkuarNga ?? null,
    statusi: rak?.statusi ?? "HAPUR", mbyllurAt: rak?.mbyllurAt ?? null, mbyllurNga: rak?.mbyllurNga ?? null,
    totalBanka: banka.reduce((a, b) => a + b.cents, 0), totalOra: neMuaj.reduce((a, o) => a + o.shumaCents, 0),
    rreshtat, mosperputhje: rreshtat.filter(r => r.status === "VETEM_BANKE" || r.status === "VETEM_ORA").length,
  };

  function oraInfo(o: (typeof ora)[number]) {
    let femijet = "";
    try { femijet = (JSON.parse(o.ndarja) as { emri: string }[]).map(f => f.emri).join(", "); } catch { /* bosh */ }
    return { id: o.id, data: o.data.toISOString().slice(0, 10), cents: o.shumaCents, referenca: o.referenca, prindi: o.prindi, femijet };
  }
}

/** Përmbledhja e 12 muajve të vitit shkollor (shtator–gusht): Ora vs banka, statusi. */
export async function permbledhjaMujore(db: Db, orgId: number, vitiShkollor: number) {
  const muajt = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8].map((m, i) => ({ muaji: m, viti: i < 4 ? vitiShkollor : vitiShkollor + 1 }));
  const out = [];
  for (const { viti, muaji } of muajt) {
    const r = await rakordo(db, orgId, viti, muaji);
    out.push({ viti, muaji, totalOra: r.totalOra, totalBanka: r.totalBanka, ngarkuar: r.ngarkuar, statusi: r.statusi, mosperputhje: r.mosperputhje });
  }
  return out;
}

// ── Dyfishimet ───────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Grupet e lidhjeve TIMI aktive për të njëjtin nxënës (ose i njëjti emër + prind pa nxënës). */
export async function grupetDyfishe(db: Db) {
  const links = await db.timiInvestStudent.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  const grupet = new Map<string, typeof links>();
  for (const l of links) {
    const k = l.studentId ? `S${l.studentId}` : `N${norm(`${l.firstName} ${l.lastName}`)}|${norm(l.parentName)}`;
    grupet.set(k, [...(grupet.get(k) ?? []), l]);
  }
  const invoices = await db.timiInvestInvoice.findMany({ select: { number: true, timiStudentIds: true } });
  const profOf = (id: number) => invoices.filter(inv => { try { return (JSON.parse(inv.timiStudentIds ?? "[]") as number[]).includes(id); } catch { return false; } }).map(i => i.number);
  return [...grupet.values()].filter(g => g.length > 1).map(g => g.map(l => ({
    id: l.id, emri: `${l.firstName} ${l.lastName}`.trim(), prindi: l.parentName, studentId: l.studentId, stage: l.stage,
    cmimi: computeTiExpectedPrice(l), regularPrice: l.regularPrice, discountPct: l.discountPct, notes: l.notes, createdAt: l.createdAt, profaturat: profOf(l.id),
  })));
}

/** Bashkon: `mbaj` mbetet; të tjerat çaktivizohen dhe shënohen "bashkuar me". Asgjë s'fshihet. */
export async function bashko(db: Db, orgId: number, actor: TimiActor, mbaj: number, bashkoIds: number[], arsye: string) {
  return db.$transaction(async tx => {
    const keep = await tx.timiInvestStudent.findUnique({ where: { id: mbaj } });
    if (!keep || !keep.active) throw new Error("Rreshti që mbahet s'u gjet ose s'është aktiv.");
    const tjeret = await tx.timiInvestStudent.findMany({ where: { id: { in: bashkoIds.filter(x => x !== mbaj) }, active: true } });
    for (const t of tjeret) {
      if (keep.studentId && t.studentId && t.studentId !== keep.studentId) throw new Error(`${t.firstName} ${t.lastName} i takon një nxënësi tjetër — s'bashkohet.`);
      await tx.timiInvestStudent.update({ where: { id: t.id }, data: { active: false, bashkuarMe: keep.id, bashkuarAt: new Date() } });
    }
    await logTimi(tx, orgId, actor, tjeret.map(t => ({
      action: "UPDATE" as const, entity: "TimiInvestStudent" as const, entityId: t.id, tiId: t.id, studentId: t.studentId,
      field: "bashkuarMe", oldValue: "aktiv", newValue: `bashkuar me #${keep.id} (${keep.firstName} ${keep.lastName})`, reason: arsye,
    })));
    return tjeret.length;
  });
}

/** Kthen një rresht të bashkuar (aktiv sërish). */
export async function ndaje(db: Db, orgId: number, actor: TimiActor, id: number, arsye: string) {
  return db.$transaction(async tx => {
    const l = await tx.timiInvestStudent.findUnique({ where: { id } });
    if (!l || !l.bashkuarMe) throw new Error("Ky rresht s'është i bashkuar.");
    await tx.timiInvestStudent.update({ where: { id }, data: { active: true, bashkuarMe: null, bashkuarAt: null } });
    await logTimi(tx, orgId, actor, [{ action: "UPDATE", entity: "TimiInvestStudent", entityId: id, tiId: id, studentId: l.studentId, field: "bashkuarMe", oldValue: `bashkuar me #${l.bashkuarMe}`, newValue: "aktiv", reason: arsye }]);
  });
}
