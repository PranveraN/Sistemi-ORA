import type { PrismaClient } from "@prisma/client";
import { getAcademicMonths, getDateRange } from "@/lib/academicYear";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";
import { paymentChannel } from "@/lib/cashFlow";

// Shifrat e Shkollimit për një vit akademik, të llogaritura në tri mënyra — për
// rregullin e barazimit (R08). Asnjë formulë ekzistuese s'ndryshohet: dy të parat
// riprodhojnë saktë kartat ekzistuese, e treta është përkufizimi i Pranverës
// (2026-10-08) për të ardhmen, i ndarë sipas statusit.
//
//  A. "Borxhe Shkollimi" (karta lart, /api/dashboard): kushdo me rreshta (edhe të
//     larguarit) + aktivët TANI pa plan pagese (çmimi standard / TIMI Invest); borxhi
//     për nxënës = max(0, detyrimi − çdo pagesë, edhe e pakonfirmuar); mbipagesat
//     s'zbriten. (Deri 2026-10-08 karta u vinte borxh edhe të larguarve pa plan.)
//  B. "Borxhi i mbetur" (Pasqyra, shkollimiOverview): vetëm statusi ACTIVE tani;
//     Totali i pritur − Paguar (vetëm i konfirmuar), për të gjithë bashkë.
//  C. Përkufizimi i ri: për çdo nxënës (min 0), vetëm pagesa të KONFIRMUARA,
//     përfshirë të larguarit — "Borxh nga aktivët" + "Borxh nga të larguarit";
//     mbipagesat veçmas si "Kredi/mbipagesa".
// Të gjitha shumat në cent.

export interface TuitionFigures {
  year: number;
  dashboardDebtCents: number;      // A
  dashboardPaidCents: number;      // karta "Të hyra": i konfirmuar, të gjithë me rreshta
  overviewExpectedCents: number;   // B — Totali i pritur
  overviewPaidCents: number;       // B — Paguar (i konfirmuar, aktivët)
  overviewRemainingCents: number;  // B — Borxhi i mbetur
  overviewChannels: { cashCents: number; bankCents: number; noMethodCents: number };
  target: {                        // C
    debtActiveCents: number;
    debtDepartedCents: number;
    creditCents: number;
    studentsActiveWithDebt: number;
    studentsDepartedWithDebt: number;
    studentsWithCredit: number;
  };
  /** Nxënës aktivë pa asnjë rresht Shkollimi dhe pa TIMI Invest (për R10). */
  activeWithoutObligation: { id: number; name: string; className: string | null }[];
}

const c = (v: number) => Math.round(v * 100);

export async function computeTuitionFigures(db: PrismaClient, orgId: number, year: number): Promise<TuitionFigures | null> {
  const cat = await db.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } });
  if (!cat) return null;
  const months = getAcademicMonths(year);
  const { start, end } = getDateRange(year, "academic");

  const [rows, students, ti] = await Promise.all([
    db.payment.findMany({
      where: { organizationId: orgId, categoryId: cat.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })) },
      select: { studentId: true, finalAmount: true, paidAmount: true, confirmed: true, description: true, method: true },
    }),
    db.student.findMany({
      where: { organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, status: true, discountPct: true, enrollDate: true, inactiveDate: true, class: { select: { name: true } } },
    }),
    db.timiInvestStudent.findMany({ where: { active: true, studentId: { not: null } }, select: { studentId: true, regularPrice: true, discountPct: true, manualDiscAmt: true } }),
  ]);

  const byStudent = new Map<number, typeof rows>();
  for (const r of rows) { const a = byStudent.get(r.studentId) ?? []; a.push(r); byStudent.set(r.studentId, a); }
  const tiById = new Map(ti.map(t => [t.studentId as number, t]));
  const defaultPrice = (discountPct: number | null) => Math.round(cat.defaultAmount * (1 - (discountPct ?? 0) / 100));
  const studentById = new Map(students.map(s => [s.id, s]));

  // A — "Borxhe Shkollimi" (si /api/dashboard)
  let aDebt = 0, aPaid = 0;
  for (const [, rs] of byStudent) {
    aDebt += aggregatePaymentTotals(rs).balance;
    aPaid += rs.filter(r => r.confirmed).reduce((s, r) => s + r.paidAmount, 0);
  }
  for (const [sid, t] of tiById) if (!byStudent.has(sid) && studentById.get(sid)?.status === "ACTIVE") aDebt += computeTiExpectedPrice(t);
  for (const s of students) {
    const inPeriod = (!s.enrollDate || s.enrollDate <= end) && (s.inactiveDate == null || s.inactiveDate >= start);
    if (!inPeriod || s.status !== "ACTIVE" || byStudent.has(s.id) || tiById.has(s.id)) continue;
    aDebt += defaultPrice(s.discountPct);
  }

  // B — Pasqyra (vetëm ACTIVE) dhe C — përkufizimi i ri (edhe të larguarit)
  let bExpected = 0, bPaid = 0, cash = 0, bank = 0, noMethod = 0;
  const target = { debtActiveCents: 0, debtDepartedCents: 0, creditCents: 0, studentsActiveWithDebt: 0, studentsDepartedWithDebt: 0, studentsWithCredit: 0 };
  const activeWithoutObligation: TuitionFigures["activeWithoutObligation"] = [];
  const population = new Set<number>([...students.filter(s => s.status === "ACTIVE").map(s => s.id), ...byStudent.keys()]);
  for (const sid of population) {
    const s = studentById.get(sid);
    const active = s?.status === "ACTIVE";
    const rs = byStudent.get(sid) ?? [];
    const t = tiById.get(sid);
    const confirmedPaid = rs.filter(r => r.confirmed).reduce((sum, r) => sum + r.paidAmount, 0);
    let expected: number;
    if (rs.length > 0) expected = aggregatePaymentTotals(rs).finalAmount;
    else if (t) expected = computeTiExpectedPrice(t);
    else if (active) { expected = defaultPrice(s?.discountPct ?? 0); activeWithoutObligation.push({ id: sid, name: `${s?.firstName ?? ""} ${s?.lastName ?? ""}`.trim(), className: s?.class?.name ?? null }); }
    else expected = 0;

    if (active) {
      bExpected += expected;
      bPaid += confirmedPaid;
      for (const r of rs) {
        if (!r.confirmed || r.paidAmount <= 0) continue;
        const ch = paymentChannel(r.method);
        if (ch === "cash") cash += c(r.paidAmount); else if (ch === "banke") bank += c(r.paidAmount); else noMethod += c(r.paidAmount);
      }
    }
    const debt = Math.max(0, c(expected) - c(confirmedPaid));
    const credit = Math.max(0, c(confirmedPaid) - c(expected));
    if (debt > 0) {
      if (active) { target.debtActiveCents += debt; target.studentsActiveWithDebt++; }
      else { target.debtDepartedCents += debt; target.studentsDepartedWithDebt++; }
    }
    if (credit > 0) { target.creditCents += credit; target.studentsWithCredit++; }
  }

  return {
    year,
    dashboardDebtCents: c(aDebt),
    dashboardPaidCents: c(aPaid),
    overviewExpectedCents: c(bExpected),
    overviewPaidCents: c(bPaid),
    overviewRemainingCents: Math.max(0, c(bExpected) - c(bPaid)),
    overviewChannels: { cashCents: cash, bankCents: bank, noMethodCents: noMethod },
    target,
    activeWithoutObligation,
  };
}
