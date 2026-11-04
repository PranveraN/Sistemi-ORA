// Plani i pagesës së ushqimit: Dymujor (parazgjedhje) ose Mujor.
//
// PARIMI: periudha dymujore mbetet NJË detyrim i vetëm (një rresht Payment, p.sh.
// Shtator/Tetor = 37 ditë × 4 € = 148 €). Për nxënësit "Mujor" ky detyrim vetëm
// ndahet në dy këste për shfaqje, vonesa dhe kujtesa — asgjë nuk ndahet në databazë.
// Kësti 1 = ditët e muajit të parë (nga kalendari) × çmimi; Kësti 2 = pjesa tjetër.
// Pagesa (paidAmount kumulativ) mbyll këstet me radhë: së pari Kësti 1, teprica te Kësti 2.

export type UshqimiPlan = "MUJOR" | "DYMUJOR";

// Ruhet te StudentTag (module "USHQIMI_PLAN", për vit shkollor) si JSON:
// { nga: { "<indeksi i periudhës>": "MUJOR" | "DYMUJOR" } } — plani vlen nga ajo
// periudhë e tutje, derisa të ndryshohet sërish.
export interface PlanState { nga: Record<string, UshqimiPlan> }

export const PLAN_MODULE = "USHQIMI_PLAN";

export function parsePlanState(label: string | null | undefined): PlanState {
  try {
    const o = JSON.parse(label ?? "");
    if (o && typeof o === "object" && o.nga && typeof o.nga === "object") {
      const nga: Record<string, UshqimiPlan> = {};
      for (const [k, v] of Object.entries(o.nga)) if (v === "MUJOR" || v === "DYMUJOR") nga[String(parseInt(k))] = v;
      return { nga };
    }
  } catch { /* bosh */ }
  return { nga: {} };
}

/** Plani që vlen për periudhën `idx` (0 = Shtator/Tetor … 4 = Maj/Qershor). */
export function planForPeriod(state: PlanState | undefined, idx: number): UshqimiPlan {
  if (!state) return "DYMUJOR";
  let best = -1, plan: UshqimiPlan = "DYMUJOR";
  for (const [k, v] of Object.entries(state.nga)) {
    const i = parseInt(k);
    if (i <= idx && i > best) { best = i; plan = v; }
  }
  return plan;
}

/** Ndryshon planin nga periudha `fromIdx` e tutje; periudhat para saj s'preken. */
export function setPlanFrom(state: PlanState | undefined, fromIdx: number, plan: UshqimiPlan): PlanState {
  const nga: Record<string, UshqimiPlan> = {};
  for (const [k, v] of Object.entries(state?.nga ?? {})) if (parseInt(k) < fromIdx) nga[k] = v;
  nga[String(fromIdx)] = plan;
  // Pastrim: heq hapat që s'ndryshojnë asgjë (p.sh. DYMUJOR që nga fillimi)
  const out: Record<string, UshqimiPlan> = {};
  let prev: UshqimiPlan = "DYMUJOR";
  for (const k of Object.keys(nga).map(Number).sort((a, b) => a - b)) {
    if (nga[k] !== prev) { out[String(k)] = nga[k]; prev = nga[k]; }
  }
  return { nga: out };
}

export function isMujorAnywhere(state: PlanState | undefined): boolean {
  return !!state && Object.values(state.nga).includes("MUJOR");
}

// ── Shujtat: Mëngjes + Drekë (parazgjedhje) / Vetëm mëngjes / Vetëm drekë ──
// Ruhet si plani: StudentTag (module "USHQIMI_SHUJTA"), { nga: { "<periudha>": Shujta } },
// vlen nga ajo periudhë e tutje. Çmimi/ditë i secilës zgjidhet te Kalkulatori.
export type Shujta = "TE_DYJA" | "MENGJES" | "DREKE";
export const SHUJTA_MODULE = "USHQIMI_SHUJTA";
export const SHUJTA_LABEL: Record<Shujta, string> = { TE_DYJA: "Mëngjes + Drekë", MENGJES: "Vetëm mëngjes", DREKE: "Vetëm drekë" };
export interface ShujtaState { nga: Record<string, Shujta> }
const isShujta = (v: unknown): v is Shujta => v === "TE_DYJA" || v === "MENGJES" || v === "DREKE";

export function parseShujtaState(label: string | null | undefined): ShujtaState {
  try {
    const o = JSON.parse(label ?? "");
    if (o && typeof o === "object" && o.nga && typeof o.nga === "object") {
      const nga: Record<string, Shujta> = {};
      for (const [k, v] of Object.entries(o.nga)) if (isShujta(v)) nga[String(parseInt(k))] = v;
      return { nga };
    }
  } catch { /* bosh */ }
  return { nga: {} };
}

export function shujtaForPeriod(state: ShujtaState | undefined, idx: number): Shujta {
  if (!state) return "TE_DYJA";
  let best = -1, v: Shujta = "TE_DYJA";
  for (const [k, s] of Object.entries(state.nga)) {
    const i = parseInt(k);
    if (i <= idx && i > best) { best = i; v = s; }
  }
  return v;
}

export function setShujtaFrom(state: ShujtaState | undefined, fromIdx: number, shujta: Shujta): ShujtaState {
  const nga: Record<string, Shujta> = {};
  for (const [k, v] of Object.entries(state?.nga ?? {})) if (parseInt(k) < fromIdx) nga[k] = v;
  nga[String(fromIdx)] = shujta;
  const out: Record<string, Shujta> = {};
  let prev: Shujta = "TE_DYJA";
  for (const k of Object.keys(nga).map(Number).sort((a, b) => a - b)) {
    if (nga[k] !== prev) { out[String(k)] = nga[k]; prev = nga[k]; }
  }
  return { nga: out };
}

/** Prapashtesa e përshkrimit të periudhës, p.sh. " · vetëm drekë" (bosh për të dyja). */
export function shujtaSuffix(s: Shujta): string {
  return s === "MENGJES" ? " · vetëm mëngjes" : s === "DREKE" ? " · vetëm drekë" : "";
}

export type KestStatus = "PAGUAR" | "PJESERISHT" | "PA_PAGUAR" | "ME_VONESE";

export interface Kest {
  muaji: number;      // 1–12
  vit: number;        // viti kalendarik
  dite: number;
  shuma: number;
  afati: Date;        // dita e fundit e muajit (fundi i ditës)
  paguar: number;
  statusi: KestStatus;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.005;

/** Dita e fundit e muajit, ora 23:59:59 — afati "kalon" vetëm të nesërmen. */
export function fundiIMuajit(vit: number, muaji: number): Date {
  return new Date(vit, muaji, 0, 23, 59, 59);
}

export function kesteMujore(input: {
  months: [number, number];
  calYear: number;                 // viti kalendarik i periudhës (të dy muajt janë në të njëjtin vit)
  split: [number, number] | null;  // ditët e kalendarit për secilin muaj; null → ndarje përgjysmë
  days: number;                    // ditët e periudhës (mund të jenë ndryshuar me dorë)
  finalAmount: number;
  paidAmount: number;
  today?: Date;
}): Kest[] {
  const today = input.today ?? new Date();
  const days = Math.max(0, input.days);
  const price = days > 0 ? input.finalAmount / days : 0;
  // Muaji i parë merr ditët e veta të kalendarit (jo më shumë se ditët e periudhës);
  // ditët që mungojnë (ndërprerje, fillim i vonë) i hiqen muajit të dytë.
  const d1 = input.split ? Math.min(input.split[0], days) : Math.ceil(days / 2);
  const d2 = days - d1;
  const s1 = r2(Math.min(input.finalAmount, d1 * price));
  const s2 = r2(input.finalAmount - s1);
  let mbetur = Math.max(0, input.paidAmount);
  const out: Kest[] = [];
  for (const [i, dite, shuma] of [[0, d1, s1], [1, d2, s2]] as const) {
    const muaji = input.months[i];
    const paguar = r2(i === 1 ? mbetur : Math.min(mbetur, shuma));
    mbetur = r2(mbetur - paguar);
    const afati = fundiIMuajit(input.calYear, muaji);
    const statusi: KestStatus =
      shuma - paguar <= EPS ? "PAGUAR"
      : afati < today ? "ME_VONESE"
      : paguar > EPS ? "PJESERISHT"
      : "PA_PAGUAR";
    out.push({ muaji, vit: input.calYear, dite, shuma, afati, paguar, statusi });
  }
  return out;
}

/** Afati që ruhet te periudha: afati i këstit të parë të papaguar (ose i të fundit). */
export function afatiAktual(keste: Kest[]): Date {
  const k = keste.find(x => x.statusi !== "PAGUAR") ?? keste[keste.length - 1];
  return k.afati;
}

export function kaVonese(keste: Kest[]): boolean {
  return keste.some(k => k.statusi === "ME_VONESE");
}

/** Cilat këste i mbuloi një pagesë e re (nga `paidBefore` te `paidAfter`) — për kuponin. */
export function kesteTeMbuluara(keste: Kest[], paidBefore: number, paidAfter: number): { muaji: number; vit: number; shuma: number; plotesisht: boolean }[] {
  const out: { muaji: number; vit: number; shuma: number; plotesisht: boolean }[] = [];
  let start = 0;
  keste.forEach((k, i) => {
    const end = i === keste.length - 1 ? Infinity : start + k.shuma;
    const a = Math.max(start, paidBefore), b = Math.min(end, paidAfter);
    if (b - a > EPS) out.push({ muaji: k.muaji, vit: k.vit, shuma: r2(b - a), plotesisht: paidAfter >= start + k.shuma - EPS });
    start = start + k.shuma;
  });
  return out;
}

/** Indeksi i periudhës së parë që s'ka filluar ende (5 = të gjitha kanë filluar). */
export function periudhaEParePaFilluar(bucketsMonths: number[][], academicYear: number, today = new Date()): number {
  for (let i = 0; i < bucketsMonths.length; i++) {
    const m = bucketsMonths[i][0];
    const y = m >= 9 ? academicYear : academicYear + 1;
    if (new Date(y, m - 1, 1) > today) return i;
  }
  return bucketsMonths.length;
}
