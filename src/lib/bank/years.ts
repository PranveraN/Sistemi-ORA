import type { PrismaClient } from "@prisma/client";

// Pamja e "vitit të hapur" të bankës: për çdo llogari dhe vit kalendarik, të gjitha ngarkimet
// (PDF) bashkë — sipas datave të rreshtave, pa i bashkuar fizikisht. Një ngarkim që kalon vitin
// (p.sh. 15.12.2025 – 10.01.2026) del pjesërisht te secili vit. Rreshtat "dyfisht" s'llogariten.
// Vazhdimësia kontrollohet mes ngarkimeve: gjendja në fund të njërit = gjendja para rreshtit
// të parë të tjetrit; ndryshe del "Mungon: data – data". Shumat në cent.

const OK_STATUSET = ["DRAFT", "IMPORTUAR"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (s: string, n: number) => { const t = new Date(`${s}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return iso(t); };
const yearOf = (s: string) => parseInt(s.slice(0, 4));

interface Row { id: number; ekstraktId: number; nr: number; data: string; debi: number; kredi: number; gjendja: number; importuar: boolean; zerId: number | null; llogaria: string }
interface Ek { id: number; llogaria: string | null; periudhaNga: Date | null; periudhaDeri: Date | null; pjeset: string | null; emriSkedarit: string | null; statusi: string; createdAt: Date }

export interface Mungese { llogaria: string; nga: string; deri: string; diferenca: number; pas: string; para: string }
export type MuajStatus = "ok" | "pret" | "mungon" | "pjeserisht" | "ardhshem" | "bosh";
export interface VitSummary {
  llogaria: string; viti: number;
  nga: string | null; deri: string | null;           // data e rreshtit të parë / të fundit të vitit
  fillestare: number | null; perfundimtare: number | null;
  rreshta: number; kredi: number; debi: number;
  paZe: number; paImportuar: number; importuar: number;
  muajt: MuajStatus[];                              // 12 muaj
  mungojne: Mungese[];
  ngarkime: number;
}

/** Periudhat që mbulon një ngarkim (sipas pjesëve të PDF-ve, nëse ka). */
function periods(e: Ek): [string, string][] {
  try {
    const p = e.pjeset ? JSON.parse(e.pjeset) : null;
    const parts = (p?.pjeset ?? []).filter((x: { nga: string | null; deri: string | null }) => x.nga && x.deri).map((x: { nga: string; deri: string }) => [x.nga, x.deri] as [string, string]);
    if (parts.length) return parts;
  } catch { /* JSON i vjetër */ }
  return e.periudhaNga && e.periudhaDeri ? [[iso(e.periudhaNga), iso(e.periudhaDeri)]] : [];
}

async function loadAll(db: PrismaClient, orgId: number, llogaria?: string) {
  const eks: Ek[] = await db.bankEkstrakt.findMany({
    where: { organizationId: orgId, statusi: { in: OK_STATUSET }, ...(llogaria ? { llogaria } : {}) },
    select: { id: true, llogaria: true, periudhaNga: true, periudhaDeri: true, pjeset: true, emriSkedarit: true, statusi: true, createdAt: true },
  });
  const raw = await db.bankLevizje.findMany({
    where: { organizationId: orgId, ekstraktId: { in: eks.map(e => e.id) }, statusi: { not: "DYFISHT" } },
    select: { id: true, ekstraktId: true, nr: true, data: true, debi: true, kredi: true, gjendja: true, importuar: true, zerId: true, llogaria: true },
    orderBy: [{ ekstraktId: "asc" }, { nr: "asc" }],
  });
  const rows: Row[] = raw.map(r => ({ ...r, data: iso(r.data), gjendja: r.gjendja ?? 0, llogaria: r.llogaria ?? "" }));
  return { eks, rows };
}

/** Rreshtat e një llogarie sipas radhës kohore: ngarkimet renditen sipas rreshtit të tyre të parë. */
function sequence(eks: Ek[], rows: Row[], acct: string) {
  const byEk = new Map<number, Row[]>();
  for (const r of rows) if (r.llogaria === acct) { const a = byEk.get(r.ekstraktId) ?? []; a.push(r); byEk.set(r.ekstraktId, a); }
  const segs = [...byEk.entries()].map(([id, rs]) => ({ ek: eks.find(e => e.id === id)!, rs }))
    .sort((a, b) => a.rs[0].data.localeCompare(b.rs[0].data) || a.ek.id - b.ek.id);
  return segs;
}

const opening = (r: Row) => r.gjendja - r.kredi + r.debi;

/** Boshllëqet mes ngarkimeve të një llogarie (dhe ato brenda një ngarkimi me disa PDF). */
function gaps(segs: ReturnType<typeof sequence>, acct: string): Mungese[] {
  const out: Mungese[] = [];
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1], b = segs[i];
    const last = a.rs[a.rs.length - 1], first = b.rs[0];
    if (last.gjendja === opening(first)) continue;
    const aEnd = periods(a.ek).map(p => p[1]).sort().pop() ?? last.data;
    const bStart = periods(b.ek).map(p => p[0]).sort()[0] ?? first.data;
    let nga = shift(aEnd, 1), deri = shift(bStart, -1);
    if (nga > deri) { nga = last.data; deri = first.data; }
    out.push({ llogaria: acct, nga, deri, diferenca: opening(first) - last.gjendja, pas: a.ek.emriSkedarit ?? `#${a.ek.id}`, para: b.ek.emriSkedarit ?? `#${b.ek.id}` });
  }
  for (const s of segs) {
    try {
      const m = s.ek.pjeset ? JSON.parse(s.ek.pjeset).mungojne : [];
      for (const x of m ?? []) out.push({ llogaria: acct, nga: x.nga, deri: x.deri, diferenca: x.diferenca, pas: x.mes?.[0] ?? "", para: x.mes?.[1] ?? "" });
    } catch { /* s'ka */ }
  }
  return out;
}

function summarize(acct: string, viti: number, segs: ReturnType<typeof sequence>, allGaps: Mungese[], today: string): VitSummary {
  const rs = segs.flatMap(s => s.rs).filter(r => yearOf(r.data) === viti).sort((a, b) => a.data.localeCompare(b.data) || 0);
  // Radha brenda vitit: sipas segmentit dhe nr (data mund të përsëritet brenda ditës)
  const ordered = segs.flatMap(s => s.rs.filter(r => yearOf(r.data) === viti));
  const y0 = `${viti}-01-01`, y1 = `${viti}-12-31`;
  // Ditët e mbuluara nga periudhat e ngarkimeve
  const covered = new Set<string>();
  for (const s of segs) for (const [a, b] of periods(s.ek)) {
    for (let d = a < y0 ? y0 : a; d <= (b > y1 ? y1 : b); d = shift(d, 1)) covered.add(d);
  }
  const yGaps = allGaps.filter(g => g.nga <= y1 && g.deri >= y0);
  for (const g of yGaps) for (let d = g.nga < y0 ? y0 : g.nga; d <= (g.deri > y1 ? y1 : g.deri); d = shift(d, 1)) covered.delete(d);
  const muajt: MuajStatus[] = Array.from({ length: 12 }, (_, m) => {
    const first = `${viti}-${String(m + 1).padStart(2, "0")}-01`;
    if (first > today) return "ardhshem";
    let all = 0, cov = 0;
    for (let d = first; d.slice(5, 7) === first.slice(5, 7) && d <= today; d = shift(d, 1)) { all++; if (covered.has(d)) cov++; }
    if (cov === 0) return "mungon";
    if (cov < all) return "pjeserisht";
    const mr = ordered.filter(r => r.data.slice(5, 7) === first.slice(5, 7));
    if (!mr.length) return "bosh"; // i mbuluar nga ekstrakti, por pa asnjë lëvizje
    return mr.some(r => !r.importuar) ? "pret" : "ok";
  });
  return {
    llogaria: acct, viti,
    nga: rs[0]?.data ?? null, deri: rs[rs.length - 1]?.data ?? null,
    fillestare: ordered.length ? opening(ordered[0]) : null, perfundimtare: ordered.length ? ordered[ordered.length - 1].gjendja : null,
    rreshta: ordered.length,
    kredi: ordered.reduce((s, r) => s + r.kredi, 0), debi: ordered.reduce((s, r) => s + r.debi, 0),
    paZe: ordered.filter(r => r.zerId === null).length,
    paImportuar: ordered.filter(r => !r.importuar).length, importuar: ordered.filter(r => r.importuar).length,
    muajt, mungojne: yGaps, ngarkime: segs.filter(s => s.rs.some(r => yearOf(r.data) === viti)).length,
  };
}

/** Të gjitha vitet (për çdo llogari), nga më i riu. */
export async function listYears(db: PrismaClient, orgId: number): Promise<VitSummary[]> {
  const { eks, rows } = await loadAll(db, orgId);
  const today = iso(new Date());
  const out: VitSummary[] = [];
  for (const acct of [...new Set(rows.map(r => r.llogaria))]) {
    const segs = sequence(eks, rows, acct);
    const g = gaps(segs, acct);
    const years = [...new Set(segs.flatMap(s => s.rs.map(r => yearOf(r.data))))];
    for (const y of years) out.push(summarize(acct, y, segs, g, today));
  }
  return out.sort((a, b) => b.viti - a.viti || a.llogaria.localeCompare(b.llogaria));
}

/** Një vit: përmbledhja, ngarkimet që kanë rreshta në të, dhe ID-të e rreshtave të vitit. */
export async function yearDetail(db: PrismaClient, orgId: number, llogaria: string, viti: number) {
  const { eks, rows } = await loadAll(db, orgId, llogaria);
  const segs = sequence(eks, rows, llogaria);
  const summary = summarize(llogaria, viti, segs, gaps(segs, llogaria), iso(new Date()));
  const ids = segs.flatMap(s => s.rs.filter(r => yearOf(r.data) === viti).map(r => r.id));
  const ngarkimet = segs.filter(s => s.rs.some(r => yearOf(r.data) === viti)).map(s => {
    const inY = s.rs.filter(r => yearOf(r.data) === viti);
    return { id: s.ek.id, emriSkedarit: s.ek.emriSkedarit, statusi: s.ek.statusi, periudhaNga: s.ek.periudhaNga, periudhaDeri: s.ek.periudhaDeri,
      pjeset: s.ek.pjeset, ngaVit: inY[0].data, deriVit: inY[inY.length - 1].data, rreshta: inY.length, importuar: inY.filter(r => r.importuar).length, createdAt: s.ek.createdAt };
  });
  return { summary, ids, ngarkimet };
}

/** Ekstraktet: "IMPORTUAR" kur të gjithë rreshtat (jo dyfisht) janë importuar, ndryshe "DRAFT". */
export async function syncEkstraktStatus(db: PrismaClient, ekstraktIds: number[]) {
  for (const id of [...new Set(ekstraktIds)]) {
    const ek = await db.bankEkstrakt.findUnique({ where: { id }, select: { statusi: true } });
    if (!ek || !OK_STATUSET.includes(ek.statusi)) continue;
    const pending = await db.bankLevizje.count({ where: { ekstraktId: id, statusi: { not: "DYFISHT" }, importuar: false } });
    const any = await db.bankLevizje.count({ where: { ekstraktId: id, importuar: true } });
    const next = pending === 0 && any > 0 ? "IMPORTUAR" : "DRAFT";
    if (next !== ek.statusi) await db.bankEkstrakt.update({ where: { id }, data: { statusi: next, ...(next === "IMPORTUAR" ? { importuarAt: new Date() } : { importuarAt: null, importuarNga: null }) } });
  }
}

/**
 * Importon rreshtat e dhënë (vetëm ata të lexuar pa gabim, jo dyfisht, ende jo të importuar).
 * Kontrolli i fundit i dyfishimit: nëse i njëjti rresht është tashmë i importuar nga një ngarkim
 * tjetër, ky shënohet "dyfisht" dhe s'importohet. Kthen { importuar, dyfisht }.
 */
export async function importRows(db: PrismaClient, orgId: number, ids: number[]) {
  const rows = await db.bankLevizje.findMany({
    where: { id: { in: ids }, organizationId: orgId, importuar: false, statusi: { not: "DYFISHT" }, ekstrakt: { statusi: { in: OK_STATUSET } } },
    select: { id: true, celesi: true, ekstraktId: true },
  });
  const taken = new Set((await db.bankLevizje.findMany({
    where: { organizationId: orgId, importuar: true, celesi: { in: rows.map(r => r.celesi) } }, select: { celesi: true },
  })).map(r => r.celesi));
  const dupIds = rows.filter(r => taken.has(r.celesi)).map(r => r.id);
  const okIds = rows.filter(r => !taken.has(r.celesi)).map(r => r.id);
  const now = new Date();
  for (let i = 0; i < okIds.length; i += 500) await db.bankLevizje.updateMany({ where: { id: { in: okIds.slice(i, i + 500) } }, data: { importuar: true, importuarAt: now } });
  if (dupIds.length) await db.bankLevizje.updateMany({ where: { id: { in: dupIds } }, data: { statusi: "DYFISHT", zerId: null } });
  await syncEkstraktStatus(db, rows.map(r => r.ekstraktId));
  return { importuar: okIds.length, dyfisht: dupIds.length };
}

/** I nxjerr rreshtat nga bilanci (asgjë s'fshihet). */
export async function unimportRows(db: PrismaClient, orgId: number, ids: number[]) {
  const rows = await db.bankLevizje.findMany({ where: { id: { in: ids }, organizationId: orgId, importuar: true }, select: { id: true, ekstraktId: true } });
  for (let i = 0; i < rows.length; i += 500) await db.bankLevizje.updateMany({ where: { id: { in: rows.slice(i, i + 500).map(r => r.id) } }, data: { importuar: false, importuarAt: null } });
  await syncEkstraktStatus(db, rows.map(r => r.ekstraktId));
  return rows.length;
}
