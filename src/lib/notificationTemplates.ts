// Motor i pastër (pa React, pa fetch) për gjenerimin automatik të teksteve të
// njoftimeve të pagesave — shih plani "Sistem Automatik i Njoftimeve të
// Pagesave". Çdo integrim (Shkollimi, Ushqimi, Uniforma, SMS "Me Borxh",
// përmbledhja e nxënësit) ndërton një `Obligation` nga të dhënat që AI I KA
// TASHMË në state (rreshti i tabelës) dhe thërret këto funksione — asnjë
// llogaritje financiare e re s'bëhet këtu, vetëm formatim teksti.
import { formatCurrency, formatDate } from "@/lib/utils";

export type ObligationStatus = "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE";
export type Frequency = "MONTHLY" | "SEMESTER" | "ANNUAL" | "ONE_TIME";

export interface Obligation {
  category: string;                    // "Shkollimi", "Ushqimi", "Uniforma", etj.
  frequency: Frequency;
  periodLabel: string | null;          // "Shtator 2026", "Semestri I", null për ONE_TIME
  schoolYearLabel: string | null;      // "2026–2027"
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: Date | string | null;
  paidDate: Date | string | null;
  receiptNumber: string | null;
}

export interface StudentInfo {
  firstName: string;
  lastName: string;
  className: string | null;
}

function studentLabel(s: StudentInfo): string {
  const name = `${s.firstName} ${s.lastName}`.replace(/\s+/g, " ").trim();
  return `${name}${s.className ? ` (${s.className})` : ""}`;
}

// Kategoria si emër i lakuar për fjali natyrale shqip ("pagesa e shkollimit",
// "pagesa e ushqimit", "detyrimi për uniformë") — vetëm rastet e njohura kanë
// frazë të përshtatur, çdo kategori tjetër bie mbrapsht te forma gjenitive e
// thjeshtë ("pagesa e {Kategoria}").
function categoryPhrase(category: string): string {
  const known: Record<string, string> = {
    Shkollimi: "pagesa e shkollimit",
    Ushqimi: "pagesa e ushqimit",
    Uniforma: "detyrimi për uniformë",
  };
  return known[category] ?? `pagesa e ${category}`;
}

function periodPhrase(o: Pick<Obligation, "frequency" | "periodLabel" | "schoolYearLabel">): string {
  const year = o.schoolYearLabel ? ` (viti shkollor ${o.schoolYearLabel})` : "";
  if (o.frequency === "ONE_TIME") return "";
  if (o.frequency === "ANNUAL") return o.schoolYearLabel ? ` për vitin shkollor ${o.schoolYearLabel}` : "";
  if (o.frequency === "SEMESTER") return o.periodLabel ? ` për ${o.periodLabel}${year}` : year;
  return o.periodLabel ? ` për ${o.periodLabel}${year}` : year; // MONTHLY
}

// Statusi kurrë s'nxirret nga një fushë e ngrirë (p.sh. Payment.status) —
// llogaritet nga shifrat reale, njësoj si aggregateStatus() te
// /api/category-payments (praktikë e vendosur në gjithë projektin).
export function deriveObligationStatus(
  o: Pick<Obligation, "totalAmount" | "paidAmount" | "balance" | "dueDate">
): ObligationStatus {
  if (o.totalAmount > 0 && o.paidAmount >= o.totalAmount) return "PAID";
  if (o.paidAmount > 0) return "PARTIAL";
  if (o.dueDate && new Date(o.dueDate) < new Date()) return "OVERDUE";
  return "UNPAID";
}

const SIGNATURE = "Faleminderit, Akademia Ora";

// A/B/C/D/F/G/H — dispeçer i vetëm sipas frequency + status, jo 8 stringje
// të kopjuara. `forceConfirmation` lejon template H (konfirmim) edhe kur
// status=PAID, vetëm kur kërkohet shprehimisht (asnjëherë automatikisht).
export function buildObligationMessage(
  student: StudentInfo,
  o: Obligation,
  opts?: { forceConfirmation?: boolean }
): string | null {
  const status = deriveObligationStatus(o);
  const who = studentLabel(student);
  const period = periodPhrase(o);
  const catPhrase = categoryPhrase(o.category);

  // H. Konfirmim i pagesës — vetëm kur kërkohet shprehimisht.
  if (status === "PAID") {
    if (!opts?.forceConfirmation) return null;
    const dateStr = o.paidDate ? ` më ${formatDate(o.paidDate)}` : "";
    const invoiceStr = o.receiptNumber ? ` (Fatura nr. ${o.receiptNumber})` : "";
    return `Përshëndetje, I nderuar prind, Ju konfirmojmë se ${catPhrase} për ${who}${period}, në vlerë ${formatCurrency(o.totalAmount)}, është kryer me sukses${dateStr}${invoiceStr}. ${SIGNATURE}`;
  }

  // F. Pagesë e vonuar — kujtesë, jo gjuhë agresive.
  if (status === "OVERDUE") {
    const dueStr = o.dueDate ? `, me afat ${formatDate(o.dueDate)},` : "";
    return `Përshëndetje, I nderuar prind, Ju kujtojmë se ${catPhrase} për ${who}${period}${dueStr} është ende e papaguar. Shuma e mbetur është ${formatCurrency(o.balance)}. Ju lutem na kontaktoni për të rregulluar pagesën. Faleminderit për mirëkuptimin, Akademia Ora`;
  }

  // G. Pagesë e pjesshme.
  if (status === "PARTIAL") {
    return `Përshëndetje, I nderuar prind, Ju informojmë se ${catPhrase} për ${who}${period} është regjistruar pjesërisht. Nga ${formatCurrency(o.totalAmount)} janë paguar ${formatCurrency(o.paidAmount)}, dhe mbetet pa u paguar ${formatCurrency(o.balance)}. ${SIGNATURE}`;
  }

  // A/B/C/D. Pagesë mujore/semestrale/vjetore/uniformë — ende në afat, POR
  // ende PA U PAGUAR — duhet thënë shprehimisht, jo vetëm "është regjistruar"
  // (frazë e mëparshme që lexohej sikur pagesa ishte tashmë kryer).
  const dueStr = o.dueDate ? ` Afati i pagesës është ${formatDate(o.dueDate)}.` : "";
  return `Përshëndetje, I nderuar prind, Ju informojmë se ${catPhrase} për ${who}${period}, në vlerë ${formatCurrency(o.totalAmount)}, mbetet ende e papaguar.${dueStr} ${SIGNATURE}`;
}

// I. Gjenerim i faturës — vetëm nëse ekziston numër i regjistruar; asnjëherë
// s'shfaq "undefined"/tekst të gabuar kur mungon.
export function buildInvoiceMessage(student: StudentInfo, o: Obligation): string | null {
  if (!o.receiptNumber) return null;
  const who = studentLabel(student);
  const period = periodPhrase(o);
  return `Përshëndetje, I nderuar prind, Për ${who} është lëshuar fatura nr. ${o.receiptNumber}, ${categoryPhrase(o.category)}${period}, në vlerë ${formatCurrency(o.totalAmount)}. ${SIGNATURE}`;
}

// J. Përmbledhje e të gjitha detyrimeve — vetëm rreshtat me borxh (balance>0);
// nëse asnjë kategori s'ka borxh, kthen konfirmim të shkurtër në vend të
// një njoftimi bosh.
export function buildSummaryMessage(student: StudentInfo, obligations: Obligation[]): string {
  const who = studentLabel(student);
  const withDebt = obligations.filter(o => o.balance > 0);
  if (!withDebt.length) {
    return `Përshëndetje, I nderuar prind, Ju informojmë se ${who} s'ka asnjë detyrim të papaguar aktualisht. ${SIGNATURE}`;
  }
  const lines = withDebt.map(o => `${o.category}: ${formatCurrency(o.balance)}`).join(" · ");
  const total = withDebt.reduce((sum, o) => sum + o.balance, 0);
  return `Përshëndetje, I nderuar prind, Përmbledhje e detyrimeve për ${who}: ${lines}. Gjithsej mbetet pa u paguar: ${formatCurrency(total)}. ${SIGNATURE}`;
}
