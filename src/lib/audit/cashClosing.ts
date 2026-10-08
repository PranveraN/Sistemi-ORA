import type { PrismaClient } from "@prisma/client";
import { CASH_TABLES, movementsOf, todayKey, type CashScope, type MovementKind } from "./cashEffect";

// Mbyllja ditore e arkës (Faza 2).
//
// Zinxhiri: e para është HAPJA (gjendja fillestare e numëruar). Çdo mbyllje
// pastaj: gjendja sipas sistemit = shuma e NUMËRUAR e mbylljes së mëparshme +
// lëvizjet cash të pa-llogaritura ende. Kështu një diferencë s'bartet në ditët
// pasuese — çdo ditë krahasohet me paratë reale të ditës së kaluar.
//
// Cila lëvizje i takon cilës mbyllje: lëvizja (dita d, rreshti i gjurmës me id i)
// llogaritet te mbyllja e PARË C me i ≤ C.lastLogId dhe d ≤ C.data. Pra:
//   • lëvizjet normale bien te dita e tyre;
//   • një regjistrim i vonuar për një ditë tashmë të mbyllur bie te mbyllja e
//     radhës, i shfaqur veçmas si "Regjistrime të vonuara" (dhe krijon gjetje);
//   • lëvizjet me datë në të ardhmen presin ditën e tyre.
// Burimi: FinAuditLog (Faza 1) — e vetmja që di sa para hynë cilën ditë kur një
// pagesë paguhet në disa pjesë (i njëjti rresht Payment ndryshon).

type Db = PrismaClient;

export const SCOPE_SETTING = "cashClosing.scope";

export interface ClosingComputation {
  date: string;
  kind: "OPENING" | "DAILY";
  previous: { id: number; date: string; countedCents: number } | null;
  openingCents: number;
  inCents: number;
  outCents: number;
  lateCents: number;
  systemCents: number;
  byKind: Record<MovementKind, { inCents: number; outCents: number; count: number }>;
  late: { table: string; recordId: number | null; day: string; cents: number; kind: MovementKind; at: string; userName: string | null }[];
  noMethodPayments: number; // pagesa pa metodë në këtë periudhë — s'hyjnë në arkë
  lastLogId: number;        // rreshti i fundit i gjurmës i marrë parasysh
}

export async function loadCashScope(db: Db, orgId: number): Promise<CashScope & { categoryNames: string[] }> {
  const [setting, cats, food] = await Promise.all([
    db.setting.findUnique({ where: { key: SCOPE_SETTING } }),
    db.paymentCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    db.shpenzimKategori.findMany({ where: { fusha: "USHQIMI" }, select: { id: true } }),
  ]);
  let ids: number[] = [];
  try { ids = (JSON.parse(setting?.value ?? "{}").categoryIds ?? []).map(Number).filter(Boolean); } catch { ids = []; }
  const shk = cats.find(c => c.name === "Shkollimi");
  if (ids.length === 0 && shk) ids = [shk.id]; // parazgjedhje: arka e Shkollimit (si "Numëro arkën")
  return {
    categoryIds: ids,
    includesShkollimi: !!shk && ids.includes(shk.id),
    foodKategoriIds: food.map(f => f.id),
    categoryNames: cats.filter(c => ids.includes(c.id)).map(c => c.name),
  };
}

const emptyKinds = (): ClosingComputation["byKind"] => ({
  PAGESA: { inCents: 0, outCents: 0, count: 0 },
  HYRA: { inCents: 0, outCents: 0, count: 0 },
  SHPENZIM: { inCents: 0, outCents: 0, count: 0 },
  SHPENZIM_VJETER: { inCents: 0, outCents: 0, count: 0 },
  DOREZIM: { inCents: 0, outCents: 0, count: 0 },
  INVESTIM: { inCents: 0, outCents: 0, count: 0 },
});

const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; } };

async function maxLogId(db: Db): Promise<number> {
  const r = await db.finAuditLog.aggregate({ _max: { id: true } });
  return r._max.id ?? 0;
}

/** Gjendja sipas sistemit për mbylljen e ditës `date` (pa e ruajtur). */
export async function computeClosing(db: Db, orgId: number, date: string): Promise<ClosingComputation> {
  const upTo = await maxLogId(db);
  const closings = await db.cashClosing.findMany({ where: { organizationId: orgId }, orderBy: { date: "asc" } });
  const previous = [...closings].reverse().find(c => c.date < date) ?? null;
  const base = closings[0] ?? null;
  const result: ClosingComputation = {
    date, kind: previous ? "DAILY" : "OPENING",
    previous: previous ? { id: previous.id, date: previous.date, countedCents: previous.countedCents } : null,
    openingCents: previous?.countedCents ?? 0, inCents: 0, outCents: 0, lateCents: 0, systemCents: previous?.countedCents ?? 0,
    byKind: emptyKinds(), late: [], noMethodPayments: 0, lastLogId: upTo,
  };
  if (!previous || !base) return result; // hapja: s'ka lëvizje për t'u llogaritur

  const scope = await loadCashScope(db, orgId);
  const logs = await db.finAuditLog.findMany({
    where: { tableName: { in: [...CASH_TABLES] }, id: { gt: base.lastLogId, lte: upTo } },
    orderBy: { id: "asc" },
  });
  for (const log of logs) {
    const oldRow = parse(log.oldValues), newRow = parse(log.newValues);
    if (log.tableName === "Payment" && newRow && newRow.method == null && Number(newRow.paidAmount) > 0 && log.id > previous.lastLogId) {
      result.noMethodPayments++;
    }
    for (const m of movementsOf(log.tableName, oldRow, newRow, scope)) {
      if (m.day > date) continue;                                           // dita s'ka ardhur ende
      if (log.id <= previous.lastLogId && m.day <= previous.date) continue; // llogaritur më parë
      const k = result.byKind[m.kind];
      k.count++;
      if (m.cents > 0) { k.inCents += m.cents; result.inCents += m.cents; } else { k.outCents -= m.cents; result.outCents -= m.cents; }
      if (m.day <= previous.date) {
        result.lateCents += m.cents;
        result.late.push({ table: log.tableName, recordId: log.recordId, day: m.day, cents: m.cents, kind: m.kind, at: log.createdAt.toISOString(), userName: log.userName });
      }
    }
  }
  result.systemCents = result.openingCents + result.inCents - result.outCents;
  return result;
}

/** Dita e fundit e mbyllur — çdo ditë deri në të (përfshirë) llogaritet e mbyllur. */
export async function lastClosedDay(db: Pick<Db, "cashClosing">, orgId?: number): Promise<string | null> {
  const last = await db.cashClosing.findFirst({ where: orgId ? { organizationId: orgId } : {}, orderBy: { date: "desc" }, select: { date: true } });
  return last?.date ?? null;
}

export interface ClosingActor { id: number | null; name: string | null }

export class ClosingError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** Ruan mbylljen e ditës. Diferenca ≠ 0 krijon gjetje auditimi KRITIKE. */
export async function createClosing(db: Db, orgId: number, actor: ClosingActor, input: { date: string; countedCents: number; note?: string | null }) {
  const { date, countedCents } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ClosingError("Data e pavlefshme.");
  if (date > todayKey()) throw new ClosingError("S'mund të mbyllet një ditë e ardhshme.");
  if (!Number.isInteger(countedCents) || countedCents < 0) throw new ClosingError("Shuma e numëruar duhet të jetë 0 ose më shumë.");
  const last = await lastClosedDay(db, orgId);
  if (last && date <= last) throw new ClosingError(`Dita ${date} është tashmë e mbyllur (mbyllja e fundit: ${last}).`, 409);

  const c = await computeClosing(db, orgId, date);
  const scope = await loadCashScope(db, orgId);
  const diffCents = countedCents - c.systemCents;
  const closing = await db.cashClosing.create({
    data: {
      organizationId: orgId, date, kind: c.kind,
      scope: JSON.stringify({ categoryIds: scope.categoryIds, categoryNames: scope.categoryNames }),
      openingCents: c.openingCents, inCents: c.inCents, outCents: c.outCents, lateCents: c.lateCents, lastLogId: c.lastLogId,
      systemCents: c.kind === "OPENING" ? countedCents : c.systemCents,
      countedCents, diffCents: c.kind === "OPENING" ? 0 : diffCents,
      breakdown: JSON.stringify({ byKind: c.byKind, late: c.late, noMethodPayments: c.noMethodPayments }),
      note: input.note?.trim() || null, countedById: actor.id, countedByName: actor.name,
    },
  });
  if (closing.diffCents !== 0) {
    await db.auditFinding.upsert({
      where: { fingerprint: `R01:closing:${closing.id}` },
      update: {},
      create: {
        organizationId: orgId, ruleCode: "R01", severity: "KRITIKE", module: "ARKA",
        entityType: "CashClosing", entityId: closing.id, amountCents: closing.diffCents,
        title: `Diferencë në arkë më ${date}: ${closing.diffCents < 0 ? "mungojnë" : "tepër"} ${(Math.abs(closing.diffCents) / 100).toFixed(2)} €`,
        description: `Sipas sistemit ${(closing.systemCents / 100).toFixed(2)} €, numëruar ${(countedCents / 100).toFixed(2)} €. Numëroi: ${actor.name ?? "—"}.`,
        evidence: JSON.stringify({ closingId: closing.id, date, systemCents: closing.systemCents, countedCents, diffCents: closing.diffCents, openingCents: c.openingCents, inCents: c.inCents, outCents: c.outCents, lateCents: c.lateCents, late: c.late }),
        fingerprint: `R01:closing:${closing.id}`,
      },
    });
  }
  return closing;
}

/** Verifikimi nga një person i dytë (jo ai që numëroi). */
export async function verifyClosing(db: Db, orgId: number, actor: ClosingActor, id: number, note?: string | null) {
  const c = await db.cashClosing.findFirst({ where: { id, organizationId: orgId } });
  if (!c) throw new ClosingError("Mbyllja s'u gjet.", 404);
  if (c.verifiedAt) throw new ClosingError("Kjo mbyllje është verifikuar tashmë.", 409);
  if (actor.id != null && c.countedById === actor.id) throw new ClosingError("Verifikimin duhet ta bëjë një person tjetër, jo ai që numëroi.", 403);
  return db.cashClosing.update({
    where: { id },
    data: { verifiedById: actor.id, verifiedByName: actor.name, verifiedAt: new Date(), verifyNote: note?.trim() || null },
  });
}
