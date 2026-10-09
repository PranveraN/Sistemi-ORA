import type { PrismaClient } from "@prisma/client";
import { dayKey } from "@/lib/audit/cashEffect";

// ── Arka fizike: një logjikë e vetme, sipas DATËS REALE të lëvizjes së parasë ──
//
// Çdo lëvizje ka dy gjëra krejt të ndara:
//   • `day`           — kur lëvizi paraja realisht (përcakton arkën fizike);
//   • `attributedAY`  — cilit vit shkollor i caktohet (p.sh. pagesa e Koprani-t
//                       për 2027–28) — vetëm për Pasqyrën e vitit, KURRË për arkën.
// Efektet:  boxCents (+ hyn në arkë / − del) · bankCents (+ hyn në bankë / − del).
//   pagesë cash +arkë · pagesë me bankë +bankë · dorëzim te një person −arkë ·
//   depozitë arkë→bankë −arkë +bankë · tërheqje bankë→arkë +arkë −bankë ·
//   shpenzim cash −arkë · shpenzim me bankë −bankë.
// Gjendja fillestare = një numërim i arkës (data + shuma + kur u regjistrua).
// Lëvizjet me datë para numërimit, por të regjistruara PAS tij (retroaktive),
// s'e ndryshojnë historinë në heshtje: dalin veç si "regjistrime të vonuara".
// Shumat në cent.

export type LedgerSource = "PAGESE" | "HYRA" | "SHPENZIM" | "SHPENZIM_PAGESE" | "SHPENZIM_VJETER" | "DOREZIM" | "INVESTIM" | "TRANSFER";

export interface LedgerMovement {
  key: string;
  source: LedgerSource;
  id: number;
  day: string;              // "YYYY-MM-DD" (ora e Kosovës) — data reale e lëvizjes
  recordedAt: number;       // ms — kur u regjistrua në sistem
  boxCents: number;
  bankCents: number;
  attributedAY: number | null; // viti shkollor (viti fillestar) sipas Pasqyrës së vitit
  inYearView: boolean;      // a e përfshin Pasqyra e vitit (p.sh. jo pagesat e pakonfirmuara)
  label: string;
  flags?: string[];         // p.sh. "PA_METODE", "PA_DATE_PAGESE", "DATA_E_REGJISTRIMIT"
}

export interface Opening { day: string; cents: number; recordedAt: number }

/** Viti shkollor (viti fillestar) i një dite: shtator–dhjetor → ai vit; janar–gusht → viti i kaluar. */
export function academicYearOfDay(day: string): number {
  const [y, m] = day.split("-").map(Number);
  return m >= 9 ? y : y - 1;
}
export function academicYearOf(month: number | null, year: number | null): number | null {
  if (month == null || year == null) return null;
  return month >= 9 ? year : year - 1;
}
export const ayWindow = (ay: number) => ({ from: `${ay}-09-01`, to: `${ay + 1}-08-31` });

export interface PhysicalBalance {
  openingCents: number;
  inCents: number;
  outCents: number;
  lateCents: number;
  late: LedgerMovement[];
  closingCents: number;     // gjendja e arkës fizike sipas regjistrimeve
  bankDeltaCents: number;   // ndryshimi në bankë në të njëjtën periudhë
  byDay: { day: string; inCents: number; outCents: number; balanceCents: number }[];
  futureCount: number;      // lëvizje me datë pas `upTo` (s'llogariten ende)
}

/** Gjendja e arkës fizike nga numërimi fillestar deri më `upTo` (përfshirë). Funksion i pastër. */
export function physicalBalance(movs: LedgerMovement[], opening: Opening, upTo: string): PhysicalBalance {
  const out: PhysicalBalance = { openingCents: opening.cents, inCents: 0, outCents: 0, lateCents: 0, late: [], closingCents: opening.cents, bankDeltaCents: 0, byDay: [], futureCount: 0 };
  const days = new Map<string, { inCents: number; outCents: number }>();
  for (const m of movs) {
    if (m.day > upTo) { out.futureCount++; continue; }
    const regular = m.day > opening.day;
    const late = !regular && m.recordedAt > opening.recordedAt;
    if (!regular && !late) continue; // pjesë e gjendjes fillestare (numëruar)
    if (late) { out.late.push(m); out.lateCents += m.boxCents; }
    if (m.boxCents > 0) out.inCents += m.boxCents; else out.outCents -= m.boxCents;
    out.bankDeltaCents += m.bankCents;
    const d = days.get(regular ? m.day : opening.day) ?? { inCents: 0, outCents: 0 };
    if (m.boxCents > 0) d.inCents += m.boxCents; else d.outCents -= m.boxCents;
    days.set(regular ? m.day : opening.day, d);
  }
  out.closingCents = opening.cents + out.inCents - out.outCents;
  let bal = opening.cents;
  for (const [day, d] of [...days.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    bal += d.inCents - d.outCents;
    out.byDay.push({ day, ...d, balanceCents: bal });
  }
  return out;
}

export interface YearReconciliation {
  ay: number;
  yearViewCents: number;          // "Në arkë" sipas Pasqyrës së vitit (atribuimi)
  physicalWindowCents: number;    // ndryshimi i arkës fizike brenda vitit (1 shtator – 31 gusht)
  attributedOutsideWindow: LedgerMovement[]; // i caktohen vitit, por lëvizën jashtë tij (p.sh. pagesat e verës)
  inWindowOtherYear: LedgerMovement[];       // lëvizën brenda vitit, por i caktohen tjetërkujt (p.sh. Koprani 2027–28)
  identityHolds: boolean;         // physicalWindow = yearView − attributedOutside + inWindowOther
}

/**
 * Shpjegon diferencën mes "Në arkë" të Pasqyrës së vitit dhe arkës fizike:
 * çdo lëvizje që kalon mes viteve renditet veç. Funksion i pastër.
 */
export function reconcileYearView(movs: LedgerMovement[], ay: number): YearReconciliation {
  const w = ayWindow(ay);
  const inWindow = (m: LedgerMovement) => m.day >= w.from && m.day <= w.to;
  const attributed = (m: LedgerMovement) => m.inYearView && m.attributedAY === ay;
  let yearView = 0, physical = 0;
  const attributedOutsideWindow: LedgerMovement[] = [], inWindowOtherYear: LedgerMovement[] = [];
  for (const m of movs) {
    if (attributed(m)) yearView += m.boxCents;
    if (inWindow(m)) physical += m.boxCents;
    if (m.boxCents === 0) continue;
    if (attributed(m) && !inWindow(m)) attributedOutsideWindow.push(m);
    if (inWindow(m) && !attributed(m)) inWindowOtherYear.push(m);
  }
  const sum = (a: LedgerMovement[]) => a.reduce((s, m) => s + m.boxCents, 0);
  return {
    ay, yearViewCents: yearView, physicalWindowCents: physical, attributedOutsideWindow, inWindowOtherYear,
    identityHolds: physical === yearView - sum(attributedOutsideWindow) + sum(inWindowOtherYear),
  };
}

// ── Leximi nga databaza (vetëm lexim) — arka e Shkollimit ──

const cents = (v: unknown) => Math.round((Number(v) || 0) * 100);
const isCash = (m: string | null | undefined) => !m || m === "CASH";
const isBankMethod = (m: string | null | undefined) => m === "BANK" || m === "CARD" || m === "ONLINE";

type Db = Pick<PrismaClient, "paymentCategory" | "payment" | "hyra" | "shpenzim" | "shpenzimPagese" | "shpenzimKategori" | "expense" | "investim" | "cashTransfer">;

/**
 * Të gjitha lëvizjet e parave të arkës së Shkollimit, nga gjendja aktuale e
 * rreshtave (data reale e secilit). Përdoret për rindërtimin historik dhe për
 * rakordimin me Pasqyrën e vitit. (Pas aktivizimit të gjurmës së auditimit,
 * ndryshimet e sakta pas një numërimi i jep src/lib/audit/cashClosing.ts.)
 */
export async function loadShkollimiMovements(db: Db, orgId = 1): Promise<LedgerMovement[]> {
  const cat = await db.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } });
  if (!cat) return [];
  const food = new Set((await db.shpenzimKategori.findMany({ where: { fusha: "USHQIMI" }, select: { id: true } })).map(k => k.id));
  const [pays, hyrat, shp, shpPag, exps, inv, transfers] = await Promise.all([
    db.payment.findMany({
      where: { organizationId: orgId, categoryId: cat.id, paidAmount: { gt: 0 } },
      select: { id: true, paidAmount: true, method: true, paidDate: true, createdAt: true, updatedAt: true, month: true, year: true, confirmed: true, receiptNumber: true,
        student: { select: { firstName: true, lastName: true, status: true } } },
    }),
    db.hyra.findMany({ where: { kategoria: "SHKOLLIMI" } }),
    db.shpenzim.findMany({ where: { deletedAt: null, paguar: true, mePagesa: false } }),
    db.shpenzimPagese.findMany({ where: { shpenzim: { deletedAt: null } } }),
    db.expense.findMany({ where: { categoryId: cat.id, OR: [{ type: "HANDOVER" }, { type: "EXPENSE", migratedToShpenzimId: null }] } }),
    db.investim.findMany({}),
    db.cashTransfer.findMany({ where: { organizationId: orgId, box: `CAT:${cat.id}` } }),
  ]);
  const out: LedgerMovement[] = [];

  for (const p of pays) {
    const flags: string[] = [];
    const when = p.paidDate ?? p.updatedAt;
    if (!p.paidDate) flags.push("PA_DATE_PAGESE");
    if (!p.method) flags.push("PA_METODE");
    const c = cents(p.paidAmount);
    out.push({
      key: `P${p.id}`, source: "PAGESE", id: p.id, day: dayKey(when)!, recordedAt: p.createdAt.getTime(),
      boxCents: p.method === "CASH" ? c : 0, bankCents: isBankMethod(p.method) ? c : 0,
      attributedAY: academicYearOf(p.month, p.year),
      inYearView: p.confirmed && p.student.status === "ACTIVE",
      label: `${p.student.firstName} ${p.student.lastName}`.replace(/\s+/g, " ") + (p.receiptNumber ? ` · ${p.receiptNumber}` : ""),
      flags,
    });
  }
  for (const h of hyrat) {
    const c = cents(h.shuma);
    out.push({
      key: `H${h.id}`, source: "HYRA", id: h.id, day: dayKey(h.createdAt)!, recordedAt: h.createdAt.getTime(),
      boxCents: h.metoda === "CASH" ? c : 0, bankCents: isBankMethod(h.metoda) ? c : 0,
      attributedAY: academicYearOf(h.muaj, h.vit), inYearView: true, label: h.paguesit, flags: ["DATA_E_REGJISTRIMIT"],
    });
  }
  for (const s of shp) {
    if (food.has(s.kategoriId)) continue;
    const c = cents(s.shuma), d = dayKey(s.data)!;
    out.push({
      key: `S${s.id}`, source: "SHPENZIM", id: s.id, day: d, recordedAt: s.createdAt.getTime(),
      boxCents: isCash(s.metoda) ? -c : 0, bankCents: isCash(s.metoda) ? 0 : -c,
      attributedAY: academicYearOfDay(d), inYearView: true, label: s.pershkrim ?? s.emriBiznesit ?? `Shpenzim #${s.id}`,
    });
  }
  for (const p of shpPag) {
    if (food.has(p.kategoriId)) continue;
    const d = dayKey(p.data)!;
    out.push({
      key: `SP${p.id}`, source: "SHPENZIM_PAGESE", id: p.id, day: d, recordedAt: p.createdAt.getTime(),
      boxCents: isCash(p.metoda) ? -p.shumaCents : 0, bankCents: isCash(p.metoda) ? 0 : -p.shumaCents,
      attributedAY: academicYearOfDay(d), inYearView: true, label: `Pagesë e faturës #${p.shpenzimId}`,
    });
  }
  for (const e of exps) {
    const c = cents(e.amount), d = dayKey(e.date)!;
    if (e.type === "HANDOVER") {
      out.push({
        key: `D${e.id}`, source: "DOREZIM", id: e.id, day: d, recordedAt: e.createdAt.getTime(), boxCents: -c, bankCents: 0,
        // si Pasqyra: muaji/viti i shkruar nëse ka, përndryshe data
        attributedAY: e.month != null ? academicYearOf(e.month, e.year) : academicYearOfDay(d),
        inYearView: true, label: `Dorëzim — ${e.recipient ?? ""}`.trim(),
      });
    } else if (isCash(e.method)) {
      out.push({
        key: `E${e.id}`, source: "SHPENZIM_VJETER", id: e.id, day: d, recordedAt: e.createdAt.getTime(), boxCents: -c, bankCents: 0,
        attributedAY: academicYearOfDay(d), inYearView: true, label: e.description ?? `Shpenzim (skeda) #${e.id}`,
      });
    }
  }
  for (const i of inv) {
    const c = cents(i.vlera), d = dayKey(i.data)!;
    out.push({
      key: `I${i.id}`, source: "INVESTIM", id: i.id, day: d, recordedAt: i.createdAt.getTime(),
      boxCents: i.metoda === "CASH" ? -c : 0, bankCents: i.metoda === "CASH" ? 0 : -c,
      attributedAY: academicYearOfDay(d), inYearView: true, label: i.pershkrim ?? `Investim #${i.id}`,
    });
  }
  for (const t of transfers) {
    const sign = t.direction === "BOX_TO_BANK" ? -1 : 1;
    const d = dayKey(t.date)!;
    out.push({
      key: `T${t.id}`, source: "TRANSFER", id: t.id, day: d, recordedAt: t.createdAt.getTime(),
      boxCents: sign * t.amountCents, bankCents: -sign * t.amountCents,
      // transferi s'është e hyrë as shpenzim: s'hyn në Pasqyrën e vitit (vetëm në arkën fizike)
      attributedAY: null, inYearView: false, label: t.direction === "BOX_TO_BANK" ? "Depozitë në bankë" : "Tërheqje nga banka",
    });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.recordedAt - b.recordedAt);
}
