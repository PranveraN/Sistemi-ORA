// "Regjistro pagesë" (paneli anësor te Shkollimi/Ushqimi) — shpërndan një shumë
// të paguar nëpër këstet ekzistuese të nxënësit. S'ka logjikë të re ruajtjeje:
// prodhon VETËM thirrjet që redaktuesi ekzistues (PaymentModal → handleSave) do
// të bënte vetë — PUT /api/payments/[id] me paidAmount të rritur, ose POST për
// një pagesë të re fleksibël / "Pagesë e plotë" kur s'ka plan.
//
// Rregulli (i miratuar nga Pranvera, 20.10.2026): paratë shkojnë te kësti i parë
// i papaguar (sipas afatit), pastaj te tjetri. Shuma > borxhi s'lejohet.

export interface QpInstallment {
  id: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  discount: number;
  discountType: string | null;
  scholarship: number;
  method: string | null;
  dueDate: string;
  paidDate: string | null;
  description: string | null;
  note: string | null;
  status: string;
  month?: number | null;
  year?: number | null;
}

export type QpOp =
  | { kind: "PUT"; id: number; label: string; add: number; payload: Record<string, unknown> }
  | { kind: "POST"; label: string; add: number; payload: Record<string, unknown> };

export type QpPlanKind = "NONE" | "SINGLE" | "TWO" | "MONTHLY" | "FLEX" | "TIMI" | "LEGACY_FLEX";

const round2 = (n: number) => Math.round(n * 100) / 100;
const ymd = (iso: string) => new Date(iso).toISOString().split("T")[0];
const MONTH_LBL = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];

export function planKind(inst: QpInstallment[]): QpPlanKind {
  if (!inst.length) return "NONE";
  if (inst.some(p => p.description?.startsWith("TI_MUAJI_"))) return "TIMI";
  if (inst.some(p => p.description?.startsWith("MUAJI_"))) return "MONTHLY";
  if (inst.some(p => p.description === "FLEX_HEADER")) return "FLEX";
  if (inst.some(p => p.description?.startsWith("FLEX_"))) return "LEGACY_FLEX";
  if (inst.length >= 2 || inst.some(p => p.description === "KESTI_1" || p.description === "KESTI_2")) return "TWO";
  return "SINGLE";
}

/** Etiketa e shkurtër e një kësti: K1/K2, muaji, "Pagesa N" ose "Pagesë". */
export function installmentLabel(p: QpInstallment, idx: number, kind: QpPlanKind): string {
  if (kind === "TWO") return p.description === "KESTI_2" ? "K2" : p.description === "KESTI_1" ? "K1" : `K${idx + 1}`;
  if (kind === "MONTHLY" || kind === "TIMI") return MONTH_LBL[new Date(p.dueDate).getMonth()];
  if (p.description?.startsWith("FLEX_PAY_")) return `Pagesa ${p.description.slice(9)}`;
  return "Pagesë";
}

/** Këstet e "vërteta" (pa kokën e fleksibëlit), të renditura sipas afatit. */
export function realInstallments(inst: QpInstallment[]): QpInstallment[] {
  return inst.filter(p => p.description !== "FLEX_HEADER")
    .slice().sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || a.id - b.id);
}

export interface QpInput {
  studentId: number;
  categoryId: number;
  installments: QpInstallment[];
  amount: number;           // shuma që paguhet tani
  method: string;           // CASH | BANK
  date: string;             // YYYY-MM-DD (data e pagesës)
  note?: string | null;
  // vetëm kur s'ka plan: "Pagesë e plotë" si te redaktuesi (çmimi i kategorisë, zbritja e nxënësit)
  noPlan?: { grossAmount: number; discountPct: number; dueDate: string };
}

export interface QpResult {
  ops: QpOp[];
  debtBefore: number;
  debtAfter: number;
  methodChanges: string[]; // këste me pagesë të mëparshme me metodë tjetër (rreshti merr metodën e re)
  error?: string;
}

export function debtOf(inst: QpInstallment[], kind: QpPlanKind): number {
  if (kind === "FLEX") {
    const header = inst.find(p => p.description === "FLEX_HEADER")!;
    const paid = inst.reduce((s, p) => s + p.paidAmount, 0);
    return round2(Math.max(0, header.finalAmount - paid));
  }
  return round2(inst.reduce((s, p) => s + Math.max(0, p.finalAmount - p.paidAmount), 0));
}

export function buildQuickPay(inp: QpInput): QpResult {
  const kind = planKind(inp.installments);
  const amt = round2(inp.amount);
  const empty = (error: string, debt = 0): QpResult => ({ ops: [], debtBefore: debt, debtAfter: debt, methodChanges: [], error });

  if (!(amt > 0)) return empty("Shkruani një shumë më të madhe se 0.");
  if (!inp.method) return empty("Zgjidhni metodën (Cash ose Bankë).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.date)) return empty("Data s'është e vlefshme.");
  if (kind === "TIMI") return empty("Ky nxënës paguan përmes TIMI Invest — regjistroje te dritarja TIMI (\"Modifiko këstet\").");
  if (kind === "LEGACY_FLEX") return empty("Ky plan fleksibël i vjetër hapet vetëm te \"Modifiko këstet\".");

  if (kind === "NONE") {
    if (!inp.noPlan || !(inp.noPlan.grossAmount > 0)) return empty("Ky nxënës s'ka plan pagese — përdor \"Modifiko këstet\" për ta krijuar.");
    const pct = inp.noPlan.discountPct > 0 ? inp.noPlan.discountPct : 0;
    const final = round2(Math.max(0, inp.noPlan.grossAmount - inp.noPlan.grossAmount * pct / 100));
    if (amt > final + 0.001) return empty(`Shuma kalon borxhin (${final.toFixed(2)} €).`, final);
    const [y, m] = inp.noPlan.dueDate.split("-").map(Number);
    return {
      ops: [{
        kind: "POST", label: "Pagesë e plotë", add: amt, payload: {
          studentId: inp.studentId, categoryId: inp.categoryId,
          amount: inp.noPlan.grossAmount, discount: pct, discountType: pct > 0 ? "percentage" : "fixed", scholarship: 0,
          paidAmount: amt, method: inp.method, dueDate: inp.noPlan.dueDate, paidDate: inp.date,
          description: null, note: inp.note || null, month: m, year: y,
        },
      }],
      debtBefore: final, debtAfter: round2(final - amt), methodChanges: [],
    };
  }

  const debtBefore = debtOf(inp.installments, kind);
  if (debtBefore <= 0) return empty("S'ka borxh për këtë periudhë.", 0);
  if (amt > debtBefore + 0.001) return empty(`Shuma kalon borxhin (${debtBefore.toFixed(2)} €).`, debtBefore);

  if (kind === "FLEX") {
    // Si te redaktuesi: çdo pagesë fleksibël = rresht i ri "FLEX_PAY_N" (amount = paid, pa zbritje)
    const n = inp.installments.reduce((mx, p) => {
      const k = p.description?.startsWith("FLEX_PAY_") ? parseInt(p.description.slice(9)) : 0;
      return Math.max(mx, Number.isFinite(k) ? k : 0);
    }, 0) + 1;
    const [y, m] = inp.date.split("-").map(Number);
    return {
      ops: [{
        kind: "POST", label: `Pagesa ${n}`, add: amt, payload: {
          studentId: inp.studentId, categoryId: inp.categoryId,
          amount: amt, discount: 0, discountType: "fixed", scholarship: 0, paidAmount: amt,
          method: inp.method, dueDate: inp.date, paidDate: inp.date, description: `FLEX_PAY_${n}`,
          month: m, year: y,
        },
      }],
      debtBefore, debtAfter: round2(debtBefore - amt), methodChanges: [],
    };
  }

  // SINGLE / TWO / MONTHLY: mbush këstet me radhë sipas afatit
  const rows = realInstallments(inp.installments);
  let left = amt;
  const ops: QpOp[] = [];
  const methodChanges: string[] = [];
  rows.forEach((p, idx) => {
    if (left <= 0.0001) return;
    const rem = round2(p.finalAmount - p.paidAmount);
    if (rem <= 0) return;
    const take = round2(Math.min(rem, left));
    left = round2(left - take);
    const label = installmentLabel(p, idx, kind);
    if (p.paidAmount > 0 && p.method && p.method !== inp.method) methodChanges.push(label);
    ops.push({
      kind: "PUT", id: p.id, label, add: take, payload: {
        amount: p.amount, discount: p.discount, discountType: p.discountType, scholarship: p.scholarship,
        // kur kësti mbyllet plotësisht, paguar = shuma finale e saktë (pa mbetje centësh nga rrumbullakimi)
        paidAmount: take >= rem ? p.finalAmount : round2(p.paidAmount + take), method: inp.method,
        dueDate: ymd(p.dueDate), paidDate: inp.date, description: p.description, note: p.note,
        ...(p.month != null ? { month: p.month } : {}), ...(p.year != null ? { year: p.year } : {}),
      },
    });
  });
  return { ops, debtBefore, debtAfter: round2(debtBefore - amt), methodChanges };
}

/** Kësti i radhës: sa mbetet te kësti i parë i papaguar (për butonin e shpejtë). */
export function nextInstallmentDue(inst: QpInstallment[]): number {
  const kind = planKind(inst);
  if (kind === "FLEX" || kind === "NONE") return 0;
  const p = realInstallments(inst).find(x => x.finalAmount - x.paidAmount > 0.001);
  return p ? round2(p.finalAmount - p.paidAmount) : 0;
}
