import type { PrismaClient } from "@prisma/client";
import { CASH_TABLES, movementsOf, todayKey, type CashBox, type MovementKind } from "./cashEffect";
// Emri i kategorisë së Eshkollorit (si ESHKOLLORI_CATEGORY te src/lib/eshkollori.ts — s'importohet
// që të mos krijohet rreth importesh: prisma.ts → closedDay.ts → këtu → eshkollori.ts → prisma.ts)
const ESHKOLLORI_CATEGORY = "Platforma Digjitale";

// Numërimi i arkave (Faza 2). Çdo burim ka arkën e vet (cashEffect.ts) dhe
// numërohet më vete, kur të jepet mundësia — pa afat, pa detyrim ditor.
//
// Zinxhiri i çdo arke: numërimi i parë është gjendja fillestare. Çdo numërim
// pastaj: gjendja sipas sistemit = shuma e NUMËRUAR herën e kaluar + lëvizjet
// cash të pa-llogaritura ende. Kështu një diferencë s'bartet te numërimet e
// ardhshme — çdo herë krahasohet me paratë reale të numërimit të kaluar.
//
// Cila lëvizje i takon cilit numërim: lëvizja (dita d, rreshti i gjurmës me id i)
// llogaritet te numërimi i PARË C me i ≤ C.lastLogId dhe d ≤ C.data. Pra:
//   • lëvizjet normale bien te numërimi i parë pas ditës së tyre;
//   • një regjistrim i vonuar për një ditë tashmë të numëruar bie te numërimi
//     i radhës, i shfaqur veçmas si "Regjistrime të vonuara" (dhe krijon gjetje);
//   • lëvizjet me datë në të ardhmen presin ditën e tyre.
// Burimi: FinAuditLog (Faza 1) — e vetmja që di sa para hynë cilën ditë kur një
// pagesë paguhet në disa pjesë (i njëjti rresht Payment ndryshon).

type Db = PrismaClient;

export interface ClosingComputation {
  box: string;
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

/** Të gjitha arkat: një për çdo kategori pagese + Uniformat + Librat. */
export async function loadCashBoxes(db: Pick<Db, "paymentCategory" | "shpenzimKategori">, orgId: number): Promise<CashBox[]> {
  const [cats, food] = await Promise.all([
    db.paymentCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { id: "asc" } }),
    db.shpenzimKategori.findMany({ where: { fusha: "USHQIMI" }, select: { id: true } }),
  ]);
  const foodKategoriIds = food.map(f => f.id);
  const boxes: CashBox[] = cats.map(c => ({
    key: `CAT:${c.id}`, label: c.name === ESHKOLLORI_CATEGORY ? "Eshkollori" : c.name, categoryId: c.id, withShkollimiExtras: c.name === "Shkollimi", foodKategoriIds,
  }));
  boxes.sort((a, b) => Number(b.withShkollimiExtras) - Number(a.withShkollimiExtras));
  boxes.push({ key: "UNIFORMA", label: "Uniformat (shitjet)", module: "UNIFORMA", foodKategoriIds });
  boxes.push({ key: "LIBRAT", label: "Librat (shitjet)", module: "LIBRAT", foodKategoriIds });
  return boxes;
}

const emptyKinds = (): ClosingComputation["byKind"] => ({
  PAGESA: { inCents: 0, outCents: 0, count: 0 },
  SHITJE: { inCents: 0, outCents: 0, count: 0 },
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

/** Gjendja sipas sistemit për numërimin e arkës `box` në datën `date` (pa e ruajtur). */
export async function computeClosing(db: Db, orgId: number, box: CashBox, date: string): Promise<ClosingComputation> {
  const upTo = await maxLogId(db);
  const closings = await db.cashClosing.findMany({ where: { organizationId: orgId, box: box.key }, orderBy: { date: "asc" } });
  const previous = [...closings].reverse().find(c => c.date < date) ?? null;
  const base = closings[0] ?? null;
  const result: ClosingComputation = {
    box: box.key, date, kind: previous ? "DAILY" : "OPENING",
    previous: previous ? { id: previous.id, date: previous.date, countedCents: previous.countedCents } : null,
    openingCents: previous?.countedCents ?? 0, inCents: 0, outCents: 0, lateCents: 0, systemCents: previous?.countedCents ?? 0,
    byKind: emptyKinds(), late: [], noMethodPayments: 0, lastLogId: upTo,
  };
  if (!previous || !base) return result; // numërimi i parë: s'ka lëvizje për t'u llogaritur

  const logs = await db.finAuditLog.findMany({
    where: { tableName: { in: [...CASH_TABLES] }, id: { gt: base.lastLogId, lte: upTo } },
    orderBy: { id: "asc" },
  });
  for (const log of logs) {
    const oldRow = parse(log.oldValues), newRow = parse(log.newValues);
    if (log.tableName === "Payment" && newRow && newRow.method == null && Number(newRow.paidAmount) > 0
      && Number(newRow.categoryId) === box.categoryId && log.id > previous.lastLogId) {
      result.noMethodPayments++;
    }
    for (const m of movementsOf(log.tableName, oldRow, newRow, box)) {
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

/** Data e numërimit të fundit për çdo arkë (key → "YYYY-MM-DD"). */
export async function lastCountedDays(db: Pick<Db, "cashClosing">, orgId?: number): Promise<Map<string, { date: string; organizationId: number }>> {
  const rows = await db.cashClosing.groupBy({ by: ["box", "organizationId"], where: orgId ? { organizationId: orgId } : {}, _max: { date: true } });
  return new Map(rows.filter(r => r._max.date).map(r => [r.box, { date: r._max.date!, organizationId: r.organizationId }]));
}

export interface ClosingActor { id: number | null; name: string | null }

export class ClosingError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** Ruan numërimin e arkës. Diferenca ≠ 0 krijon gjetje auditimi KRITIKE. */
export async function createClosing(db: Db, orgId: number, actor: ClosingActor, box: CashBox, input: { date: string; countedCents: number; note?: string | null }) {
  const { date, countedCents } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ClosingError("Data e pavlefshme.");
  if (date > todayKey()) throw new ClosingError("S'mund të numërohet një ditë e ardhshme.");
  if (!Number.isInteger(countedCents) || countedCents < 0) throw new ClosingError("Shuma e numëruar duhet të jetë 0 ose më shumë.");
  const last = (await lastCountedDays(db, orgId)).get(box.key)?.date ?? null;
  if (last && date <= last) throw new ClosingError(`Arka "${box.label}" është numëruar më ${last}. Zgjidhni një datë pas saj.`, 409);

  const c = await computeClosing(db, orgId, box, date);
  const opening = c.kind === "OPENING";
  const closing = await db.cashClosing.create({
    data: {
      organizationId: orgId, box: box.key, date, kind: c.kind,
      scope: JSON.stringify({ box: box.key, label: box.label }),
      openingCents: c.openingCents, inCents: c.inCents, outCents: c.outCents, lateCents: c.lateCents, lastLogId: c.lastLogId,
      systemCents: opening ? countedCents : c.systemCents,
      countedCents, diffCents: opening ? 0 : countedCents - c.systemCents,
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
        title: `Diferencë në arkën "${box.label}" më ${date}: ${closing.diffCents < 0 ? "mungojnë" : "tepër"} ${(Math.abs(closing.diffCents) / 100).toFixed(2)} €`,
        description: `Sipas sistemit ${(closing.systemCents / 100).toFixed(2)} €, numëruar ${(countedCents / 100).toFixed(2)} €. Numëroi: ${actor.name ?? "—"}.`,
        evidence: JSON.stringify({ closingId: closing.id, box: box.key, date, systemCents: closing.systemCents, countedCents, diffCents: closing.diffCents, openingCents: c.openingCents, inCents: c.inCents, outCents: c.outCents, lateCents: c.lateCents, late: c.late }),
        fingerprint: `R01:closing:${closing.id}`,
      },
    });
  }
  return closing;
}

/** Verifikimi nga një person i dytë (jo ai që numëroi). */
export async function verifyClosing(db: Db, orgId: number, actor: ClosingActor, id: number, note?: string | null) {
  const c = await db.cashClosing.findFirst({ where: { id, organizationId: orgId } });
  if (!c) throw new ClosingError("Numërimi s'u gjet.", 404);
  if (c.verifiedAt) throw new ClosingError("Ky numërim është verifikuar tashmë.", 409);
  if (actor.id != null && c.countedById === actor.id) throw new ClosingError("Verifikimin duhet ta bëjë një person tjetër, jo ai që numëroi.", 403);
  return db.cashClosing.update({
    where: { id },
    data: { verifiedById: actor.id, verifiedByName: actor.name, verifiedAt: new Date(), verifyNote: note?.trim() || null },
  });
}
