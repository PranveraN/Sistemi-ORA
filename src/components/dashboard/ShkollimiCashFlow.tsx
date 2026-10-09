"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Landmark, CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CashFlow } from "@/lib/cashFlow";
import type { PhysicalCashView, ReconRow } from "@/lib/cashLedger";
import type { YearType } from "@/lib/academicYear";

// "Pasqyra financiare e shkollimit": rreshti "Pagesat e nxënësve" dhe
// "Ku janë paratë e paguara" + "Numëro arkën". Të dhënat vijnë nga
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

export default function ShkollimiCashFlow({ label, year, yearType, expected, totalStudents, cashFlow: f, lastCashCount, physical }: Props) {
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === "SUPERADMIN";
  const [countOpen, setCountOpen] = useState(false);
  const [lastCount, setLastCount] = useState<LastCashCount | null>(lastCashCount);
  useEffect(() => setLastCount(lastCashCount), [lastCashCount]);

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

      <PhysicalCashSection physical={physical} yearView={f.inCashBox} lastCount={lastCount} onCount={() => setCountOpen(true)} />

      {countOpen && (
        <CashCountModal year={year} yearType={yearType} system={physical ? physical.expectedCents / 100 : f.inCashBox}
          onClose={() => setCountOpen(false)}
          onSaved={c => setLastCount(c)} />
      )}
    </div>
  );
}

const dmy = (day: string) => day.split("-").reverse().join(".");
const eur = (c: number) => formatCurrency(c / 100);
const signed = (c: number) => `${c < 0 ? "−" : "+"} ${num(Math.abs(c) / 100)} €`;

// Arka fizike: gjendja fillestare më 31 gusht + çdo hyrje/dalje cash me datë
// reale pas saj. Poshtë: pse ndryshon nga "Mbetja sipas vitit" — rresht për rresht.
function PhysicalCashSection({ physical: p, yearView, lastCount, onCount }: {
  physical: PhysicalCashView | null; yearView: number; lastCount: LastCashCount | null; onCount: () => void;
}) {
  if (!p) return null;
  const r = p.reconciliation;
  const lastCheck = p.counts.length > 0 ? p.counts[p.counts.length - 1] : null;
  const yearViewMatches = !r || Math.round(yearView * 100) === r.yearViewCents;
  return (
    <section className="card p-4 sm:p-5 border-2 border-[#0F766E]" aria-labelledby="cf-phys">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="cf-phys" className="font-bold text-[#0F766E] dark:text-teal-300">Arka fizike – sot (sipas datës reale)</h3>
          <p className={`text-[30px] leading-tight font-extrabold mt-1 ${p.expectedCents < 0 ? "text-red-700 dark:text-red-400" : "text-[#0F766E] dark:text-teal-300"}`}>{eur(p.expectedCents)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gjendja më {dmy(p.opening.day)}: {eur(p.opening.cents)}{p.opening.assumed && " (e supozuar — s'ka numërim të asaj dite)"}
            {" · "}hyrje cash {eur(p.inCents)} · dalje cash {eur(p.outCents)} · deri më {dmy(p.asOf)}
          </p>
          {p.futureCount > 0 && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{p.futureCount} lëvizje me datë në të ardhmen s&apos;janë llogaritur ende.</p>}
        </div>
        <div className="text-right">
          <button type="button" onClick={onCount}
            className="h-9 px-3.5 rounded-lg border-2 border-[#0F766E] bg-white dark:bg-slate-900 text-sm font-bold text-[#0F766E] dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800">
            Numëro arkën
          </button>
          {lastCheck ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
              Numëruar më {dmy(lastCheck.day)}: {eur(lastCheck.countedCents)}, pritej {eur(lastCheck.expectedCents)} → {countVerdict(lastCheck.differenceCents / 100)}
              {lastCheck.lateCents !== 0 && <> · me regjistrimet e vonuara ({signed(lastCheck.lateCents)}): {countVerdict(lastCheck.differenceNowCents / 100)}</>}
            </p>
          ) : lastCount && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">Numëruar më {formatDate(lastCount.at)}: {countVerdict(lastCount.difference)}</p>
          )}
        </div>
      </div>

      {r && (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-sm space-y-2">
          <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {r.identityHolds ? <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" aria-hidden /> : <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" aria-hidden />}
            Pse arka fizike ndryshon nga mbetja e vitit {r.ay}–{r.ay + 1}
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            Mbetja sipas vitit <b>{eur(r.yearViewCents)}</b>
            {" "}{r.outsideWindow.totalCents >= 0 ? "−" : "+"} <b>{num(Math.abs(r.outsideWindow.totalCents) / 100)} €</b> (lëvizën jashtë 1 shtator – 31 gusht)
            {" "}{r.otherYear.totalCents >= 0 ? "+" : "−"} <b>{num(Math.abs(r.otherYear.totalCents) / 100)} €</b> (lëvizën këtë vit, por i caktohen tjetërkujt)
            {" "}= <b>{eur(r.physicalWindowCents)}</b> lëvizje të arkës fizike brenda vitit {r.identityHolds ? "✓" : "— nuk përputhet!"}
          </p>
          {!yearViewMatches && <p className="text-xs text-orange-700 dark:text-orange-400">Kujdes: mbetja e vitit e llogaritur këtu ({eur(r.yearViewCents)}) ndryshon nga karta më sipër ({formatCurrency(yearView)}).</p>}
          <ReconList title="Lëvizën jashtë vitit (p.sh. pagesat e verës)" rows={r.outsideWindow.rows} />
          <ReconList title="Lëvizën këtë vit, por i caktohen vitit tjetër ose s'hyjnë në Pasqyrë" rows={r.otherYear.rows} />
        </div>
      )}
    </section>
  );
}

function ReconList({ title, rows }: { title: string; rows: ReconRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-lg bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
      <summary className="cursor-pointer px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{title} — {rows.length} rreshta</summary>
      <ul className="max-h-64 overflow-auto divide-y divide-slate-100 dark:divide-slate-700 text-[13px]">
        {rows.map(x => (
          <li key={x.key} className="px-3 py-1.5 flex justify-between gap-3">
            <span className="text-slate-600 dark:text-slate-300">{dmy(x.day)} · {x.label} <span className="text-slate-400">— {x.reason}</span></span>
            <span className={`font-semibold whitespace-nowrap ${x.cents < 0 ? "text-red-700 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>{signed(x.cents)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function countVerdict(diff: number): string {
  if (Math.abs(diff) < 0.005) return "Përputhet ✓";
  return diff < 0 ? `Mungojnë ${num(-diff)} €` : `Tepër ${num(diff)} €`;
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

interface CountRow { id: number; createdAt: string; countedAmount: number; systemAmount: number; difference: number; userName: string | null; basis?: string | null }

function CashCountModal({ year, yearType, system, onClose, onSaved }: {
  year: number; yearType: YearType; system: number; onClose: () => void; onSaved: (c: LastCashCount) => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CountRow | null>(null);
  const [history, setHistory] = useState<CountRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch(`/api/dashboard/cash-count?year=${year}&yearType=${yearType}`).then(r => (r.ok ? r.json() : [])).then(setHistory).catch(() => {});
  }, [year, yearType]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // pranon "13513.52", "13513,52" dhe "13.513,52"
    const v = value.trim().replace(/\s|€/g, "");
    const counted = parseFloat(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
    if (!Number.isFinite(counted) || counted < 0) { setError("Shkruani shumën e numëruar (€)."); inputRef.current?.focus(); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/dashboard/cash-count", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counted, year, yearType }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ruajtja dështoi."); return; }
      setResult(d);
      setHistory(h => [d, ...h]);
      onSaved({ at: d.createdAt, counted: d.countedAmount, system: d.systemAmount, difference: d.difference, userName: d.userName });
    } catch {
      setError("Gabim rrjeti — provo përsëri.");
    } finally {
      setSaving(false);
    }
  }

  const ok = result && Math.abs(result.difference) < 0.005;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cc-title" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 id="cc-title" className="font-bold text-slate-900 dark:text-white">Numëro arkën</h3>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          <div>
            <label htmlFor="cc-amount" className="form-label">Sa para ke në arkë? (€)</label>
            <input id="cc-amount" ref={inputRef} inputMode="decimal" value={value} onChange={e => { setValue(e.target.value); setResult(null); }}
              className="form-input text-lg" placeholder="0,00" autoComplete="off" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Arka fizike sipas sistemit: {formatCurrency(system)}</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {result && (
            <p role="status" className={`rounded-xl px-4 py-3 font-bold ${ok ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300" : "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"}`}>
              {countVerdict(result.difference)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Mbyll</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Ruaj numërimin
            </button>
          </div>
        </form>
        {history.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Numërimet e mëparshme</p>
            <ul className="max-h-48 overflow-auto divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {history.map(h => (
                <li key={h.id} className="py-2 flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatDate(h.createdAt)} · {formatCurrency(h.countedAmount)}
                    {h.userName && <span className="text-slate-400"> · {h.userName}</span>}
                    {h.basis !== "DATA_REALE" && <span className="block text-[11px] text-slate-400">krahasuar me Pasqyrën e vitit (logjika e vjetër)</span>}
                  </span>
                  <span className={`font-semibold whitespace-nowrap ${Math.abs(h.difference) < 0.005 ? "text-green-700 dark:text-green-400" : "text-orange-700 dark:text-orange-400"}`}>{countVerdict(h.difference)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
