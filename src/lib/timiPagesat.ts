import type { PrismaClient } from "@prisma/client";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";
import { withAuditReason } from "@/lib/audit/context";
import { logTimi, type TimiActor } from "@/lib/timiAudit";

// Pagesat nga TIMI Invest — çfarëdo shume, kurdo (e plotë ose pjesë-pjesë, 10 ose 12 muaj:
// varet nga marrëveshja e prindit me TIMI). Shkolla regjistron vetëm atë që hyn në bankë.
//
// Rregulli: TIMI paguan çmimin minus komisionin (marrëveshja: 4,66%).
//   bruto (që i llogaritet fëmijës) = shuma në bankë ÷ (1 − komisioni)
//   komisioni = bruto − shuma në bankë → shpenzim i shkollës (Shpenzim, Bankë)
// Bruto ndahet mes fëmijëve dhe mbush këstet "TIMI Invest" (TI_MUAJI_1..12) të vitit
// shkollor me metodë Bankë. Krejt mund të kthehet mbrapsht (fshiTimiPagese).

import { TIMI_KOMISION_PCT, TI_PREFIX, brutoNgaShuma, ndajProporcionalisht, mbushKestet, type RreshtKesti } from "@/lib/timiPagesatCalc";
export { TIMI_KOMISION_PCT, TI_PREFIX, brutoNgaShuma, ndajProporcionalisht, mbushKestet, vitiNgaData, type RreshtKesti } from "@/lib/timiPagesatCalc";

const TI_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
const KOMISION_KATEGORIA = "Komision TIMI Invest";

const c2e = (c: number) => Math.round(c) / 100;
const e2c = (v: number) => Math.round((Number(v) || 0) * 100);
const statusOf = (paid: number, final: number, due: Date) => paid >= final - 0.005 ? "PAID" : paid > 0 ? "PARTIAL" : due < new Date() ? "OVERDUE" : "PENDING";

export class TimiError extends Error {}

type Db = PrismaClient;
type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

export interface NdarjaFemije { studentId: number; emri: string; cents: number; rreshtat: { paymentId: number; cents: number }[] }

async function nextDep(tx: Tx, orgId: number): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.payment.findFirst({ where: { organizationId: orgId, receiptNumber: { startsWith: `DEP-${year}-` } }, orderBy: { receiptNumber: "desc" }, select: { receiptNumber: true } });
  const seq = last ? parseInt(last.receiptNumber!.split("-").pop() || "0") : 0;
  return `DEP-${year}-${String(seq + 1).padStart(4, "0")}`;
}

const yearMonths = (viti: number) => TI_MONTHS.map((m, i) => ({ month: m, year: i < 4 ? viti : viti + 1 }));

/** Këstet TIMI të vitit (krijohen nëse s'ka; pagesat bosh të një plani tjetër fshihen, si te "TIMI Invest" në Shkollim). */
async function kestetTimi(tx: Tx, orgId: number, categoryId: number, studentId: number, emri: string, viti: number) {
  const rows = await tx.payment.findMany({
    where: { organizationId: orgId, categoryId, studentId, OR: yearMonths(viti) },
    select: { id: true, description: true, finalAmount: true, paidAmount: true, method: true, dueDate: true },
  });
  const byIdx = (a: { description: string | null }, b: { description: string | null }) =>
    parseInt(a.description!.slice(TI_PREFIX.length)) - parseInt(b.description!.slice(TI_PREFIX.length));
  const ti = rows.filter(r => r.description?.startsWith(TI_PREFIX));
  if (ti.length > 0) {
    // Plan i ruajtur pjesërisht (p.sh. disa muaj dështuan te ruajtja) → krijo muajt që mungojnë.
    const link = ti.length < 12 ? await tx.timiInvestStudent.findFirst({ where: { studentId, active: true } }) : null;
    if (!link) return ti.sort(byIdx);
    const regular = e2c(link.regularPrice), price = e2c(computeTiExpectedPrice(link));
    const am = ndajProporcionalisht(regular, Array(12).fill(1)), fi = ndajProporcionalisht(price, Array(12).fill(1));
    const have = new Set(ti.map(r => r.description));
    for (let i = 0; i < 12; i++) {
      if (have.has(`${TI_PREFIX}${i + 1}`)) continue;
      const { month, year } = yearMonths(viti)[i];
      const due = new Date(`${year}-${String(month).padStart(2, "0")}-05T00:00:00Z`);
      ti.push(await tx.payment.create({
        data: {
          organizationId: orgId, studentId, categoryId, amount: c2e(am[i]), discount: c2e(am[i] - fi[i]), discountType: "fixed", scholarship: 0,
          finalAmount: c2e(fi[i]), balance: c2e(fi[i]), paidAmount: 0, dueDate: due, status: statusOf(0, c2e(fi[i]), due),
          description: `${TI_PREFIX}${i + 1}`, month, year, confirmed: true,
        },
        select: { id: true, description: true, finalAmount: true, paidAmount: true, method: true, dueDate: true },
      }));
    }
    return ti.sort(byIdx);
  }

  const other = rows.filter(r => !r.description?.startsWith(TI_PREFIX));
  if (other.some(r => r.paidAmount > 0)) {
    throw new TimiError(`${emri}: ka pagesa me plan tjetër për ${viti}–${viti + 1}. Hape te Shkollimi → "TIMI Invest" (pagesat bartën te muajt), pastaj regjistroje këtë pagesë.`);
  }
  const link = await tx.timiInvestStudent.findFirst({ where: { studentId, active: true } });
  if (!link) throw new TimiError(`${emri} s'është i lidhur me TIMI Invest — lidhe te moduli TIMI ose te profili.`);
  if (other.length > 0) {
    await withAuditReason("Kalim në planin TIMI Invest (pagesë nga TIMI)", async () => {
      await tx.payment.deleteMany({ where: { id: { in: other.map(r => r.id) }, paidAmount: 0 } });
    });
  }
  const regular = e2c(link.regularPrice), price = e2c(computeTiExpectedPrice(link));
  const am = ndajProporcionalisht(regular, Array(12).fill(1)), fi = ndajProporcionalisht(price, Array(12).fill(1));
  const created = [];
  for (let i = 0; i < 12; i++) {
    const { month, year } = yearMonths(viti)[i];
    const due = new Date(`${year}-${String(month).padStart(2, "0")}-05T00:00:00Z`);
    created.push(await tx.payment.create({
      data: {
        organizationId: orgId, studentId, categoryId, amount: c2e(am[i]), discount: c2e(am[i] - fi[i]), discountType: "fixed", scholarship: 0,
        finalAmount: c2e(fi[i]), balance: c2e(fi[i]), paidAmount: 0, dueDate: due, status: statusOf(0, c2e(fi[i]), due),
        description: `${TI_PREFIX}${i + 1}`, month, year, confirmed: true,
      },
      select: { id: true, description: true, finalAmount: true, paidAmount: true, method: true, dueDate: true },
    }));
  }
  await tx.student.update({ where: { id: studentId }, data: { paymentPlan: "TIMI_INVEST" } });
  return created;
}

async function rifreskoFazen(tx: Tx, orgId: number, categoryId: number, studentId: number, viti: number) {
  const link = await tx.timiInvestStudent.findFirst({ where: { studentId, active: true } });
  if (!link) return;
  // Fazat manuale "Pezulluar" / "Anuluar" (moduli TIMI, Faza 2) s'ndryshohen vetë nga pagesat
  if (link.stage === "PEZULLUAR" || link.stage === "ANULUAR") return;
  const paid = (await tx.payment.aggregate({ where: { organizationId: orgId, categoryId, studentId, OR: yearMonths(viti) }, _sum: { paidAmount: true } }))._sum.paidAmount ?? 0;
  const price = computeTiExpectedPrice(link);
  // Rregulli (Pranvera, 23.10): pa pagesë → Profaturë · ka filluar → Në proces · e shlyer → E kryer
  const stage = paid >= price - 0.5 ? "KRYER" : paid > 0 ? "NE_PROCES" : "PROFATURE";
  if (stage !== link.stage) await tx.timiInvestStudent.update({ where: { id: link.id }, data: { stage } });
}

export interface TimiPageseInput {
  data: string; shumaCents: number; komisionPct: number; vitiShkollor: number;
  referenca?: string | null; prindi?: string | null; shenim?: string | null;
  femijet: { studentId: number; cents: number }[];
  /** Faza 3 (magjistari): banka, dokumenti i transferit dhe drafti që po ruhet si pagesë. */
  banka?: string | null; dokumenti?: string | null; dokumentiEmri?: string | null; draftId?: number | null;
}

export async function krijoTimiPagese(db: Db, orgId: number, actor: { id: number | null; name: string | null }, inp: TimiPageseInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.data)) throw new TimiError("Data e pavlefshme.");
  if (!Number.isInteger(inp.shumaCents) || inp.shumaCents <= 0) throw new TimiError("Shkruani shumën që hyri në bankë.");
  if (!(inp.komisionPct >= 0 && inp.komisionPct < 20)) throw new TimiError("Komisioni i pavlefshëm.");
  if (!Number.isInteger(inp.vitiShkollor)) throw new TimiError("Zgjidhni vitin shkollor.");
  const femijet = inp.femijet.filter(f => f.cents > 0);
  if (femijet.length === 0) throw new TimiError("Zgjidhni të paktën një fëmijë.");
  const bruto = brutoNgaShuma(inp.shumaCents, inp.komisionPct);
  const shuma = femijet.reduce((a, f) => a + f.cents, 0);
  if (Math.abs(shuma - bruto) > 2) throw new TimiError(`Ndarja te fëmijët (${c2e(shuma)} €) duhet të jetë ${c2e(bruto)} €.`);
  femijet[femijet.length - 1].cents += bruto - shuma; // diferenca e centëve nga rrumbullakimi
  const komision = bruto - inp.shumaCents;
  const cat = await db.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId }, select: { id: true } });
  if (!cat) throw new TimiError("Kategoria 'Shkollimi' s'ekziston.");
  const studs = await db.student.findMany({ where: { id: { in: femijet.map(f => f.studentId) } }, select: { id: true, firstName: true, lastName: true } });
  const emri = (id: number) => { const s = studs.find(x => x.id === id); return s ? `${s.firstName} ${s.lastName}`.replace(/\s+/g, " ").trim() : `#${id}`; };
  const date = new Date(`${inp.data}T00:00:00Z`);

  return db.$transaction(async tx => {
    const ndarja: NdarjaFemije[] = [];
    for (const f of femijet) {
      const rows = await kestetTimi(tx, orgId, cat.id, f.studentId, emri(f.studentId), inp.vitiShkollor);
      const kestet: RreshtKesti[] = rows.map(r => ({ id: r.id, finalCents: e2c(r.finalAmount), paidCents: e2c(r.paidAmount), method: r.method }));
      const { ndarja: nd, mbetja } = mbushKestet(kestet, f.cents);
      if (mbetja > 100) {
        const mbetet = kestet.reduce((a, r) => a + Math.max(0, r.finalCents - r.paidCents), 0);
        throw new TimiError(`${emri(f.studentId)}: për ${inp.vitiShkollor}–${inp.vitiShkollor + 1} mbetet vetëm ${c2e(mbetet)} € (TIMI: ${c2e(f.cents)} €). Kontrollo çmimin TIMI ose vitin shkollor.`);
      }
      if (mbetja > 0) { // centë nga rrumbullakimi i komisionit — te kësti i fundit i mbushur
        if (nd.length) nd[nd.length - 1].cents += mbetja; else nd.push({ id: kestet[kestet.length - 1].id, cents: mbetja });
      }
      // Një kupon (DEP) për fëmijë për këtë pagesë — te kësti i parë që mbushet
      let kupon = false;
      for (const a of nd) {
        const r = rows.find(x => x.id === a.id)!;
        const paid = c2e(e2c(r.paidAmount) + a.cents);
        const ex = await tx.payment.findUnique({ where: { id: a.id }, select: { receiptNumber: true } });
        const jepKupon: boolean = !kupon && !ex?.receiptNumber;
        kupon = kupon || jepKupon || !!ex?.receiptNumber;
        await tx.payment.update({
          where: { id: a.id },
          data: {
            paidAmount: paid, method: "BANK", paidDate: date, confirmed: true,
            balance: Math.max(0, c2e(e2c(r.finalAmount) - e2c(paid))), status: statusOf(paid, r.finalAmount, r.dueDate),
            ...(jepKupon ? { receiptNumber: await nextDep(tx, orgId) } : {}),
          },
        });
      }
      ndarja.push({ studentId: f.studentId, emri: emri(f.studentId), cents: f.cents, rreshtat: nd.map(a => ({ paymentId: a.id, cents: a.cents })) });
      await rifreskoFazen(tx, orgId, cat.id, f.studentId, inp.vitiShkollor);
    }

    let shpenzimId: number | null = null;
    if (komision > 0) {
      const kat = await tx.shpenzimKategori.findFirst({ where: { emri: KOMISION_KATEGORIA } })
        ?? await tx.shpenzimKategori.create({ data: { emri: KOMISION_KATEGORIA, ngjyra: "#7c3aed", ikona: "🏦", fusha: "SHKOLLIMI" } });
      const kush = inp.prindi?.trim() || ndarja.map(n => n.emri).join(", ");
      const sh = await tx.shpenzim.create({
        data: {
          kategoriId: kat.id, shuma: c2e(komision), data: date, metoda: "BANK", lloji: "BANKE", paguar: true,
          emriBiznesit: "TIMI Invest SHA", referenca: inp.referenca?.trim() || null, vitiShkollor: inp.vitiShkollor,
          pershkrim: `Komision TIMI ${inp.komisionPct}% — ${kush}${inp.referenca ? ` (${inp.referenca.trim()})` : ""}`.slice(0, 300),
        },
      });
      shpenzimId = sh.id;
    }

    const fields = {
      organizationId: orgId, data: date, shumaCents: inp.shumaCents, brutoCents: bruto, komisionCents: komision, komisionPct: inp.komisionPct,
      vitiShkollor: inp.vitiShkollor, referenca: inp.referenca?.trim() || null, prindi: inp.prindi?.trim() || null, shenim: inp.shenim?.trim() || null,
      ndarja: JSON.stringify(ndarja), shpenzimId, createdById: actor.id, createdByName: actor.name,
      banka: inp.banka?.trim() || null, dokumenti: inp.dokumenti || null, dokumentiEmri: inp.dokumentiEmri || null, statusi: "RUAJTUR",
    };
    // Nga një draft: i njëjti rresht bëhet pagesë (s'krijohet i dyti)
    if (inp.draftId) {
      const d = await tx.timiPagese.findFirst({ where: { id: inp.draftId, organizationId: orgId } });
      if (!d || d.statusi !== "DRAFT" || d.deletedAt) throw new TimiError("Drafti s'u gjet ose është ruajtur tashmë.");
      return tx.timiPagese.update({ where: { id: d.id }, data: { ...fields, draftData: null } });
    }
    return tx.timiPagese.create({ data: fields });
  });
}

/**
 * DRAFT i një transferi (Faza 3) — ruan vetëm të dhënat e magjistarit. S'prek asnjë muaj,
 * s'krijon komision dhe s'numërohet askund (të gjitha llogaritjet lexojnë vetëm statusi = RUAJTUR).
 */
export async function ruajDraftTimi(db: Db, orgId: number, actor: { id: number | null; name: string | null }, inp: TimiPageseInput & { draftData: unknown }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.data)) throw new TimiError("Data e pavlefshme.");
  const shuma = Number.isInteger(inp.shumaCents) && inp.shumaCents > 0 ? inp.shumaCents : 0;
  const bruto = shuma ? brutoNgaShuma(shuma, inp.komisionPct) : 0;
  const fields = {
    organizationId: orgId, data: new Date(`${inp.data}T00:00:00Z`), shumaCents: shuma, brutoCents: bruto, komisionCents: bruto - shuma, komisionPct: inp.komisionPct,
    vitiShkollor: inp.vitiShkollor, referenca: inp.referenca?.trim() || null, prindi: inp.prindi?.trim() || null, shenim: inp.shenim?.trim() || null,
    ndarja: "[]", banka: inp.banka?.trim() || null, dokumenti: inp.dokumenti || null, dokumentiEmri: inp.dokumentiEmri || null,
    statusi: "DRAFT", draftData: JSON.stringify(inp.draftData ?? null), createdById: actor.id, createdByName: actor.name,
  };
  if (inp.draftId) {
    const d = await db.timiPagese.findFirst({ where: { id: inp.draftId, organizationId: orgId } });
    if (!d || d.statusi !== "DRAFT" || d.deletedAt) throw new TimiError("Drafti s'u gjet ose është ruajtur tashmë.");
    return db.timiPagese.update({ where: { id: d.id }, data: fields });
  }
  return db.timiPagese.create({ data: fields });
}

interface SnapRresht { id: number; paidAmount: number; paidDate: string | null; method: string | null; status: string; balance: number; receiptNumber: string | null }
interface Snapshot { rreshtat: SnapRresht[]; faza: { tiId: number; stage: string }[] }

/**
 * STORNO e një pagese nga TIMI (Faza 2): ul pagesat te këstet, anulon (logjikisht) komisionin
 * dhe e shënon pagesën si të stornuar — asgjë s'fshihet fizikisht. Ruhet "fotografia" e muajve
 * dhe e fazave para stornos, që "Rikthe" t'i kthejë saktësisht. Gjithçka në një transaksion.
 */
export async function fshiTimiPagese(db: Db, orgId: number, actor: { id?: number | null; name: string | null }, id: number, arsye?: string | null) {
  const p = await db.timiPagese.findFirst({ where: { id, organizationId: orgId } });
  if (!p) throw new TimiError("Pagesa s'u gjet.");
  if (p.deletedAt) throw new TimiError("Kjo pagesë është stornuar tashmë.");
  if (p.statusi === "DRAFT") {
    await db.timiPagese.update({ where: { id }, data: { deletedAt: new Date(), deletedByName: actor.name, stornoArsye: arsye?.trim() || null } });
    return p;
  }
  const ndarja = JSON.parse(p.ndarja) as NdarjaFemije[];
  const cat = await db.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId }, select: { id: true } });
  const a: TimiActor = { id: actor.id ?? null, name: actor.name };
  await db.$transaction(async tx => {
    // Kontroll i dytë brenda transaksionit (radha e shkrimeve) — kundër stornos së dyfishtë
    const fresh = await tx.timiPagese.findUnique({ where: { id }, select: { deletedAt: true } });
    if (fresh?.deletedAt) throw new TimiError("Kjo pagesë është stornuar tashmë.");
    const snap: Snapshot = { rreshtat: [], faza: [] };
    const tiOf = new Map<number, number>();
    for (const f of ndarja) {
      const link = await tx.timiInvestStudent.findFirst({ where: { studentId: f.studentId, active: true }, select: { id: true, stage: true } });
      if (link) { snap.faza.push({ tiId: link.id, stage: link.stage }); tiOf.set(f.studentId, link.id); }
      for (const r of f.rreshtat) {
        const row = await tx.payment.findUnique({ where: { id: r.paymentId }, select: { paidAmount: true, finalAmount: true, dueDate: true, paidDate: true, method: true, status: true, balance: true, receiptNumber: true } });
        if (!row) continue;
        snap.rreshtat.push({ id: r.paymentId, paidAmount: row.paidAmount, paidDate: row.paidDate?.toISOString() ?? null, method: row.method, status: row.status, balance: row.balance, receiptNumber: row.receiptNumber });
        const paid = Math.max(0, c2e(e2c(row.paidAmount) - r.cents));
        await tx.payment.update({
          where: { id: r.paymentId },
          data: { paidAmount: paid, balance: Math.max(0, c2e(e2c(row.finalAmount) - e2c(paid))), status: statusOf(paid, row.finalAmount, row.dueDate), ...(paid === 0 ? { paidDate: null, method: null } : {}) },
        });
      }
      if (cat) await rifreskoFazen(tx, orgId, cat.id, f.studentId, p.vitiShkollor);
    }
    if (p.shpenzimId) await tx.shpenzim.update({ where: { id: p.shpenzimId }, data: { deletedAt: new Date(), deletedByName: actor.name } });
    await tx.timiPagese.update({ where: { id }, data: { deletedAt: new Date(), deletedByName: actor.name, stornoArsye: arsye?.trim() || null, stornoSnapshot: JSON.stringify(snap) } });
    await logTimi(tx, orgId, a, ndarja.map(f => ({
      action: "STORNO" as const, entity: "TimiPagese" as const, entityId: id, studentId: f.studentId,
      tiId: tiOf.get(f.studentId) ?? null,
      field: "pagesa", oldValue: `${c2e(f.cents)} € (${p.referenca ?? "pa ref."}, ${p.data.toISOString().slice(0, 10)})`, newValue: "e stornuar", reason: arsye,
    })));
  });
  return p;
}

/**
 * RIKTHE një pagesë të stornuar: i kthen muajt, komisionin dhe fazat SAKTËSISHT si ishin para
 * stornos (nga fotografia). Refuzohet nëse pagesa s'është e stornuar, s'ka fotografi (u fshi
 * para Fazës 2), ose nëse muajt janë ndryshuar pas stornos (që të mos mbishkruhet pagesë tjetër).
 */
export async function rikthejTimiPagese(db: Db, orgId: number, actor: TimiActor, id: number, arsye?: string | null) {
  const p = await db.timiPagese.findFirst({ where: { id, organizationId: orgId } });
  if (!p) throw new TimiError("Pagesa s'u gjet.");
  if (!p.deletedAt) throw new TimiError("Kjo pagesë s'është e stornuar — s'ka çka të rikthehet.");
  if (p.statusi === "DRAFT") throw new TimiError("Draftet e fshira s'rikthehen — krijoni një draft të ri.");
  if (!p.stornoSnapshot) throw new TimiError("Kjo pagesë u fshi para versionit me Storno/Rikthe — s'mund të rikthehet automatikisht. Regjistrojeni sërish nëse duhet.");
  const snap = JSON.parse(p.stornoSnapshot) as Snapshot;
  const ndarja = JSON.parse(p.ndarja) as NdarjaFemije[];
  const centsByRow = new Map<number, number>();
  for (const f of ndarja) for (const r of f.rreshtat) centsByRow.set(r.paymentId, (centsByRow.get(r.paymentId) ?? 0) + r.cents);
  await db.$transaction(async tx => {
    const fresh = await tx.timiPagese.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!fresh?.deletedAt) throw new TimiError("Kjo pagesë është rikthyer tashmë.");
    for (const s0 of snap.rreshtat) {
      const row = await tx.payment.findUnique({ where: { id: s0.id }, select: { paidAmount: true } });
      const pritet = Math.max(0, e2c(s0.paidAmount) - (centsByRow.get(s0.id) ?? 0));
      if (!row || e2c(row.paidAmount) !== pritet) {
        throw new TimiError("Muajt e kësaj pagese janë ndryshuar pas stornos (p.sh. u regjistrua pagesë tjetër) — s'mund të rikthehet automatikisht pa mbishkruar atë ndryshim. Kontrolloni muajt te Shkollimi.");
      }
    }
    for (const s0 of snap.rreshtat) {
      await tx.payment.update({
        where: { id: s0.id },
        data: { paidAmount: s0.paidAmount, paidDate: s0.paidDate ? new Date(s0.paidDate) : null, method: s0.method, status: s0.status, balance: s0.balance, receiptNumber: s0.receiptNumber },
      });
    }
    for (const fz of snap.faza) await tx.timiInvestStudent.update({ where: { id: fz.tiId }, data: { stage: fz.stage } });
    const tiOf = new Map<number, number>();
    for (const f of ndarja) { const l = await tx.timiInvestStudent.findFirst({ where: { studentId: f.studentId, active: true }, select: { id: true } }); if (l) tiOf.set(f.studentId, l.id); }
    if (p.shpenzimId) await tx.shpenzim.update({ where: { id: p.shpenzimId }, data: { deletedAt: null, deletedByName: null } });
    await tx.timiPagese.update({ where: { id }, data: { deletedAt: null, deletedByName: null, rikthyerAt: new Date(), rikthyerByName: actor.name } });
    await logTimi(tx, orgId, actor, ndarja.map(f => ({
      action: "RIKTHE" as const, entity: "TimiPagese" as const, entityId: id, studentId: f.studentId, tiId: tiOf.get(f.studentId) ?? null,
      field: "pagesa", oldValue: "e stornuar", newValue: `${c2e(f.cents)} € (${p.referenca ?? "pa ref."}, ${p.data.toISOString().slice(0, 10)})`, reason: arsye,
    })));
  });
  return p;
}

export interface FemijeTimi {
  tiId: number; studentId: number; emri: string; klasa: string | null; prindi: string; statusi: string;
  cmimiCents: number; ngaTimiCents: number; paguarCents: number; mbetetCents: number; faza: string;
  /** Muaj TIMI të shënuar me dorë si të paguar (me bankë), jo përmes "Pagesat nga TIMI" — p.sh. Grupi A (qershor–gusht). Vetëm për pamje. */
  meDoreCents: number;
}

/** Për secilin fëmijë TIMI: çmimi, sa ka paguar TIMI (bruto), sa është paguar gjithsej, sa mbetet. */
export async function permbledhjaTimi(db: Db, orgId: number, viti: number) {
  const [links, cat, pagesat] = await Promise.all([
    db.timiInvestStudent.findMany({ where: { active: true, studentId: { not: null } } }),
    db.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId }, select: { id: true } }),
    db.timiPagese.findMany({ where: { organizationId: orgId, deletedAt: null, statusi: "RUAJTUR" }, orderBy: [{ data: "desc" }, { id: "desc" }] }),
  ]);
  const ids = links.map(l => l.studentId!);
  const [studs, pays, tiPays] = await Promise.all([
    db.student.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, parentName: true, status: true, class: { select: { name: true } } } }),
    cat ? db.payment.groupBy({ by: ["studentId"], where: { organizationId: orgId, categoryId: cat.id, studentId: { in: ids }, OR: yearMonths(viti) }, _sum: { paidAmount: true } }) : Promise.resolve([]),
    cat ? db.payment.groupBy({ by: ["studentId"], where: { organizationId: orgId, categoryId: cat.id, studentId: { in: ids }, description: { startsWith: "TI_MUAJI_" }, method: { in: ["BANK", "CARD", "ONLINE"] }, OR: yearMonths(viti) }, _sum: { paidAmount: true } }) : Promise.resolve([]),
  ]);
  const tiBank = new Map(tiPays.map(p => [p.studentId, e2c(p._sum.paidAmount ?? 0)]));
  const ngaTimi = new Map<number, number>();
  for (const p of pagesat.filter(p => p.vitiShkollor === viti)) for (const f of JSON.parse(p.ndarja) as NdarjaFemije[]) ngaTimi.set(f.studentId, (ngaTimi.get(f.studentId) ?? 0) + f.cents);
  const paid = new Map(pays.map(p => [p.studentId, e2c(p._sum.paidAmount ?? 0)]));
  const femijet: FemijeTimi[] = links.flatMap(l => {
    const s = studs.find(x => x.id === l.studentId);
    if (!s) return [];
    const cmimi = e2c(computeTiExpectedPrice(l)), pg = paid.get(s.id) ?? 0;
    return [{
      tiId: l.id, studentId: s.id, emri: `${s.firstName} ${s.lastName}`.replace(/\s+/g, " ").trim(), klasa: s.class?.name ?? null,
      prindi: l.parentName || s.parentName || "", statusi: s.status, cmimiCents: cmimi, ngaTimiCents: ngaTimi.get(s.id) ?? 0,
      paguarCents: pg, mbetetCents: Math.max(0, cmimi - pg), faza: l.stage,
      meDoreCents: Math.max(0, (tiBank.get(s.id) ?? 0) - (ngaTimi.get(s.id) ?? 0)),
    }];
  }).sort((a, b) => a.emri.localeCompare(b.emri));
  return { viti, femijet, pagesat: pagesat.map(p => ({ ...p, ndarja: JSON.parse(p.ndarja) as NdarjaFemije[] })) };
}
