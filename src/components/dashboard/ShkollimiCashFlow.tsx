"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Landmark, AlertTriangle, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CashFlow } from "@/lib/cashFlow";
import type { PhysicalCashView } from "@/lib/cashLedger";
import PhysicalCashDialog from "./PhysicalCashDialog";
import type { YearType } from "@/lib/academicYear";

// "Pasqyra financiare e shkollimit": rreshti "Pagesat e nxënësve" dhe
// "Ku janë paratë e paguara". Arka fizike (+ "Numëro arkën") vetëm për Super Admin,
// te dritarja që hapet nga ikona e vogël në kokë (PhysicalCashDialog). Të dhënat vijnë nga
// /api/dashboard/shkollimi-financiare (llogaritur në server, në cent).
// Dy shifra krejt të ndara: "Mbetja sipas vitit" (çdo rresht te viti i vet
// shkollor) dhe "Arka fizike" (sipas datës reale — src/lib/cashLedger.ts);
// diferenca mes tyre shpjegohet rresht për rresht.

const C = { cash: "#0F766E", bank: "#1D4ED8", handed: "#7C3AED", spent: "#C2410C", invest: "#A16207" };
const num = (v: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export interface LastCashCount { at: string; counted: number; system: number; difference: number; userName: string | null }

interface Props {
  label: string;
  year: number;
  yearType: YearType;
  expected: number;
  totalStudents: number;
  cashFlow: CashFlow;
  lastCashCount: LastCashCount | null;
  physical: PhysicalCashView | null;
}

export default function ShkollimiCashFlow({ label, year, yearType, expected, totalStudents, cashFlow: f, physical }: Props) {
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === "SUPERADMIN";
  const [cashOpen, setCashOpen] = useState(false);

  // Lidhjet hapin faqen e Shkollimit me filtrin përkatës (viti vetëm për vitin akademik)
  const href = (q: string) => `/shkollimi?${q}${yearType === "academic" ? `${q ? "&" : ""}year=${year}` : ""}`;
  const debt = Math.max(0, Math.round((expected - f.paid) * 100) / 100);
  const pct = (v: number) => (expected > 0 ? Math.round((v / expected) * 100) : 0);
  const share = (v: number, of: number) => (of > 0 ? `${Math.max(0, (v / of) * 100)}%` : "0%");
  const segTotal = f.bank + f.handedOver + f.expensesCash + f.investmentsCash + Math.max(0, f.inCashBox);
  // Sa më shumë dalje cash janë regjistruar sesa hyrje cash (kur "Në arkë" del negative)
  const cashIn = f.cash + f.otherCash;
  const cashOut = f.handedOver + f.expensesCash + f.investmentsCash;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shrink-0">
          <Landmark className="w-5 h-5 text-white" aria-hidden />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Pasqyra financiare e shkollimit – {label}</h2>
        {/* Arka fizike — vetëm Super Admin (për të tjerët as butoni, as të dhënat) */}
        {isSuperAdmin && physical && (
          <button type="button" onClick={() => setCashOpen(true)} aria-label="Arka"
            className="ml-auto w-[30px] h-[30px] flex items-center justify-center rounded-md text-[#a3aeab] hover:text-[#6b7a76] dark:hover:text-slate-300 transition-colors">
            <Banknote size={15} aria-hidden />
          </button>
        )}
      </div>

      {f.noMethod.count > 0 && (
        <Link href={href("metoda=NONE")}
          className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            <b>{f.noMethod.count} pagesa pa metodë ({num(f.noMethod.amount)} €)</b> – klasifikoji që bilanci të jetë i saktë
            <span className="font-semibold whitespace-nowrap"> → Shiko pagesat</span>
          </span>
        </Link>
      )}

      {/* Rreshti 1 — Pagesat e nxënësve */}
      <section className="card p-4 sm:p-5" aria-labelledby="cf-pay">
        <h3 id="cf-pay" className="font-bold text-slate-800 dark:text-slate-100 mb-3">Pagesat e nxënësve</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CardLink href={href("")}>
            <p className="text-sm text-slate-600 dark:text-slate-300">Totali i pritur</p>
            <p className="text-[26px] leading-tight font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(expected)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{totalStudents} nxënës</p>
          </CardLink>
          <CardLink href={href("")}>
            <div className="flex justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">Paguar</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{pct(f.paid)}% e totalit</p>
            </div>
            <p className="text-[26px] leading-tight font-extrabold text-green-700 dark:text-green-400 mt-1">{formatCurrency(f.paid)}</p>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 mt-2.5" role="img"
              aria-label={`Cash ${formatCurrency(f.cash)}, Bankë ${formatCurrency(f.bank)}`}>
              <span style={{ width: share(f.cash, f.paid), background: C.cash }} />
              <span style={{ width: share(f.bank, f.paid), background: C.bank }} />
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><Dot color={C.cash} /> Cash <b className="text-slate-900 dark:text-white">{formatCurrency(f.cash)}</b></span>
              <span className="flex items-center gap-1.5"><Dot color={C.bank} /> Bankë <b className="text-slate-900 dark:text-white">{formatCurrency(f.bank)}</b></span>
            </div>
            {f.compensation > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" title="E paguar me marrëveshje/kompensim — s'hyjnë para as në arkë, as në bankë">
                + Kompensim <b className="text-slate-900 dark:text-white">{formatCurrency(f.compensation)}</b>
              </p>
            )}
          </CardLink>
          <CardLink href={href("borxhi=DEBT")}>
            <p className="text-sm text-slate-600 dark:text-slate-300">Borxhi i mbetur</p>
            <p className="text-[26px] leading-tight font-extrabold text-red-700 dark:text-red-400 mt-1">{formatCurrency(debt)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{pct(debt)}% e totalit</p>
          </CardLink>
        </div>
      </section>

      {/* Rreshti 2 — Ku janë paratë e paguara */}
      <section className="card p-4 sm:p-5" aria-labelledby="cf-where">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3">
          <h3 id="cf-where" className="font-bold text-slate-800 dark:text-slate-100">Ku janë paratë e paguara</h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">Gjithsej {formatCurrency(f.total)}</span>
        </div>
        {/* Nga vijnë: pagesat e nxënësve + të hyrat tjera cash (kategoria SHKOLLIMI) */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-slate-600 dark:text-slate-300">
          <span>Pagesat e nxënësve <b className="text-slate-900 dark:text-white">{formatCurrency(f.paid)}</b></span>
          <Link href="/hyrat" className="hover:underline">+ Të hyra tjera cash <b className="text-slate-900 dark:text-white">{formatCurrency(f.otherCash)}</b></Link>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 gap-px" role="img"
          aria-label={`Në bankë ${formatCurrency(f.bank)}, Dorëzuar ${formatCurrency(f.handedOver)}, Shpenzuar nga arka ${formatCurrency(f.expensesCash)}, Investime nga arka ${formatCurrency(f.investmentsCash)}, Në arkë ${formatCurrency(f.inCashBox)}`}>
          <span style={{ width: share(f.bank, segTotal), background: C.bank }} />
          <span style={{ width: share(f.handedOver, segTotal), background: C.handed }} />
          <span style={{ width: share(f.expensesCash, segTotal), background: C.spent }} />
          <span style={{ width: share(f.investmentsCash, segTotal), background: C.invest }} />
          <span style={{ width: share(Math.max(0, f.inCashBox), segTotal), background: C.cash }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3 mt-3">
          <CardLink href={href("metoda=BANKE")}>
            <Legend color={C.bank} label="Në bankë" />
            <p className="text-[22px] leading-tight font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(f.bank)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hyrë direkt në llogari</p>
          </CardLink>
          <CardLink href={href("tab=handover")}>
            <Legend color={C.handed} label="Dorëzuar" />
            <p className="text-[22px] leading-tight font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(f.handedOver)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{f.handedOverPct}% e cash-it pas shpenzimeve</p>
          </CardLink>
          <CardLink href={href("tab=expense")}>
            <Legend color={C.spent} label="Shpenzuar nga arka" />
            <p className="text-[22px] leading-tight font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(f.expensesCash)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Shpenzime të paguara cash</p>
          </CardLink>
          <CardLink href="/investime">
            <Legend color={C.invest} label="Investime nga arka" />
            <p className="text-[22px] leading-tight font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(f.investmentsCash)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Investime të paguara cash</p>
          </CardLink>
          {/* Mbetja sipas vitit shkollor — jo arka fizike (ajo është më poshtë) */}
          <CardLink href={href("metoda=CASH")}>
            <Legend color={C.cash} label="Mbetja sipas vitit" />
            <p className={`text-[22px] leading-tight font-extrabold mt-1 ${f.inCashBox < 0 ? "text-red-700 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>{formatCurrency(f.inCashBox)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cash i vitit {label} pa daljet e tij</p>
          </CardLink>
        </div>

        {f.inCashBox < 0 && (
          <div role="note" className="mt-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-900 dark:text-red-200 space-y-1.5">
            <p className="flex items-start gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              Mbetja e vitit del negative: janë regjistruar {formatCurrency(cashOut - cashIn)} më shumë dalje cash sesa hyrje cash.
            </p>
            <p className="text-[13px]">Hyrje cash: {formatCurrency(cashIn)} (pagesat cash + të hyrat tjera cash) · Dalje cash: {formatCurrency(cashOut)} (dorëzime + shpenzime cash + investime cash).</p>
            <p className="text-[13px]">Para që hynë cash por s&apos;janë regjistruar si të tilla — zakonisht: pagesa cash të shënuara si Bankë ose pa metodë, pagesa nga nxënës të larguar ose të pakonfirmuara, ose dorëzime që përfshijnë para të vitit të kaluar.</p>
            {isSuperAdmin && <Link href="/superadmin/auditimi-shpenzimeve#arka" className="inline-block text-[13px] font-bold underline">Shiko diagnostikimin me shifra →</Link>}
          </div>
        )}

      </section>

      {cashOpen && isSuperAdmin && physical && (
        <PhysicalCashDialog physical={physical} year={year} yearType={yearType} onClose={() => setCashOpen(false)} />
      )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden />;
}

function Legend({ color, label, strong }: { color: string; label: string; strong?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-sm ${strong ? "font-bold text-[#0F766E] dark:text-teal-300" : "text-slate-600 dark:text-slate-300"}`}>
      <Dot color={color} /> {label}
    </p>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
      {children}
    </Link>
  );
}
