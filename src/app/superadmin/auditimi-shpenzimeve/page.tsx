"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import type { ExpenseAudit } from "@/lib/expenseAudit";

// Auditimi i shpenzimeve të Shkollimit (Faza 1) — vetëm lexim. Rezultati
// përdoret për vendimet para migrimit (asgjë s'ndryshohet nga kjo faqe).

const eur = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export default function ExpenseAuditPage() {
  const [a, setA] = useState<ExpenseAudit | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/superadmin/expense-audit").then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Gabim"); setA(d); })
      .catch(e => setError(e instanceof Error ? e.message : "Gabim"));
  }, []);

  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (!a) return <p className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Duke analizuar të dhënat…</p>;

  const certain = a.crossDuplicates.filter(d => d.level === "i sigurt");
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 min-h-screen">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Auditimi i shpenzimeve të Shkollimit — Faza 1</h1>
          <p className="text-slate-500 mt-1">Vetëm lexim · asnjë e dhënë nuk u ndryshua · gjeneruar {new Date(a.generatedAt).toLocaleString("sq-AL")}</p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-secondary text-sm print:hidden"><Printer className="w-4 h-4" /> Printo / ruaj PDF</button>
      </header>

      <section className="grid sm:grid-cols-2 gap-3">
        {[a.bookA, a.bookB].map(b => (
          <div key={b.label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="font-bold">{b.label}</p>
            <p className="text-2xl font-extrabold mt-1">{eur(b.total.total)}</p>
            <p className="text-slate-500">{b.total.count} shpenzime · Cash {eur(b.total.cash)} · Bankë {eur(b.total.bank)} · Pa paguar {eur(b.total.unpaid)}</p>
          </div>
        ))}
      </section>

      <Summary title="1. Përmbledhja e gjetjeve" items={[
        `Libri A (moduli "Shpenzimet"): ${a.bookA.total.count} shpenzime, ${eur(a.bookA.total.total)}.`,
        `Libri B (skeda te Shkollimi): ${a.bookB.total.count} shpenzime, ${eur(a.bookB.total.total)}.`,
        `Dyfishime mes librave: ${certain.length} të sigurta, ${a.crossDuplicates.length - certain.length} të mundshme (data + shuma e njëjtë).`,
        `Dyfishime brenda librit A: ${a.insideDuplicates.length} grupe.`,
        `Shpenzime për t'u kontrolluar si ushqim: ${a.foodCandidates.length}.`,
        `Dorëzime: skeda "Dorëzim parash" ${a.handovers.tab.reduce((s, x) => s + x.count, 0)} rreshta; faqja "Dorëzimet" ${a.handovers.page.reduce((s, x) => s + x.count, 0)} rreshta; të përbashkëta ${a.handovers.overlap.length}.`,
      ]} />

      <YearTable title="2. Libri A — moduli &quot;Shpenzimet&quot;, sipas viteve akademike" rows={a.bookA.years} />
      <MonthTable title="2a. Libri A — sipas muajve" rows={a.bookA.months} />
      <YearTable title="3. Libri B — skeda &quot;Shpenzime&quot; te Shkollimi, sipas viteve akademike" rows={a.bookB.years} />
      <MonthTable title="3a. Libri B — sipas muajve" rows={a.bookB.months} />
      <Table title="3b. Libri B — të gjitha rreshtat" head={["ID", "Data", "Përshkrimi", "Marrësi", "Metoda", "Shuma"]}
        rows={a.bookB.rows.map(r => [r.id, dmy(r.day), r.description ?? "—", r.supplier ?? "—", r.method ?? "pa metodë", eur(r.amount)])} empty="Skeda s'ka shpenzime." />

      <Table title="4. Dyfishime mes dy librave (data + shuma e njëjtë)" head={["Niveli", "Data", "Shuma", "A: ID · përshkrimi", "B: ID · përshkrimi"]}
        rows={a.crossDuplicates.map(d => [d.level, dmy(d.day), eur(d.amount), `#${d.A.id} · ${d.A.description ?? "—"} (${d.A.category ?? "—"})`, `#${d.B.id} · ${d.B.description ?? "—"}`])}
        empty="Asnjë dyfishim mes dy librave." note="Nuk bashkohet asgjë pa miratimin tuaj." />
      <Table title="5. Dyfishime brenda modulit &quot;Shpenzimet&quot; (data + shuma + përshkrim + kategori e njëjtë)" head={["Data", "Shuma", "Përshkrimi", "Kategoria", "ID-të"]}
        rows={a.insideDuplicates.map(d => [dmy(d.day), eur(d.amount), d.description ?? "—", d.category ?? "—", d.ids.join(", ")])} empty="Asnjë." />
      <Table title="6. Shpenzime që mund të jenë ushqim (sipas fjalëve kyçe — kontrollojini me sy)" head={["ID", "Data", "Përshkrimi", "Kategoria", "Furnitori", "Shuma"]}
        rows={a.foodCandidates.map(r => [r.id, dmy(r.day), r.description ?? "—", r.category ?? "—", r.supplier ?? "—", eur(r.amount)])} empty="Asnjë." />
      <Table title="6a. Kategoritë e modulit &quot;Shpenzimet&quot;" head={["Kategoria", "Shpenzime", "Totali"]}
        rows={a.categories.map(c => [c.name, c.count, eur(c.total)])} empty="Asnjë kategori." />

      <section className="space-y-2">
        <h2 className="text-lg font-bold">7. Përputhja e fushave (Libri B → Libri A)</h2>
        <Table head={["Skeda (Expense)", "Moduli (Shpenzim)", "Çka bëhet"]} rows={[
          ["date", "data", "kopjohet"], ["amount", "shuma", "kopjohet"], ["description", "pershkrim", "kopjohet"],
          ["recipient", "marres", "kopjohet"], ["method (CASH/BANK, bosh)", "metoda", "kopjohet; bosh → CASH (si në llogaritjen aktuale të arkës)"],
          ["reference", "referenca", "kopjohet"], ["— (s'ka)", "kategoria", "kategoria \"Shpenzime të Shkollimit (nga skeda)\" — ose një që zgjidhni ju"],
          ["— (gjithmonë i paguar)", "paguar", "Po"], ["— (s'ka)", "lloji (Zyrë/Bankë)", "Zyrë"], ["— (s'ka)", "dokumenti, nr. faturës, nr. fiskal, biznesi", "bosh"],
          ["id", "—", "rreshti i vjetër shënohet \"i migruar\" me lidhje te rreshti i ri (s'fshihet)"],
        ]} />
      </section>

      <Table title="8. Dorëzimet — skeda &quot;Dorëzim parash&quot; (sipas kategorisë)" head={["Kategoria", "Rreshta", "Totali", "E para", "E fundit"]}
        rows={a.handovers.tab.map(h => [h.category, h.count, eur(h.total), dmy(h.first), dmy(h.last)])} empty="Asnjë." />
      <Table title="8a. Dorëzimet — faqja &quot;Dorëzimet&quot; (sipas kategorisë)" head={["Kategoria", "Rreshta", "Totali", "E para", "E fundit"]}
        rows={a.handovers.page.map(h => [h.category, h.count, eur(h.total), dmy(h.first), dmy(h.last)])} empty="Faqja &quot;Dorëzimet&quot; s'ka asnjë rresht." />
      <Table title="8b. Dorëzime që duken në të dyja (data + shuma)" head={["Data", "Shuma", "Skeda", "Faqja"]}
        rows={a.handovers.overlap.map(o => [dmy(o.day), eur(o.amount), `${o.tab?.category} · ${o.tab?.recipient ?? "—"}`, `${o.page.category} · ${o.page.recipient ?? "—"}`])} empty="Asnjë." />

      <Table title="9. Investimet (sipas vitit akademik, llojit dhe metodës)" head={["Viti", "Lloji", "Metoda", "Rreshta", "Totali"]}
        rows={a.investime.map(i => [i.year, i.tipi, i.metoda, i.count, eur(i.total)])} empty="Asnjë investim." />
      <Table title="10. Të hyrat tjera (sipas vitit, kategorisë dhe metodës)" head={["Viti", "Kategoria", "Metoda", "Rreshta", "Totali"]}
        rows={a.hyrat.map(h => [h.year, h.kategoria, h.metoda, h.count, eur(h.total)])} empty="Asnjë." />
      <Table title="11. Shpenzime/dorëzime të kategorive të tjera (Ushqimi etj. — s'preken)" head={["Kategoria", "Lloji", "Rreshta", "Totali"]}
        rows={a.otherCategoryExpenses.map(o => [o.category, o.type === "HANDOVER" ? "Dorëzim" : "Shpenzim", o.count, eur(o.total)])} empty="Asnjë." />
      <Table title="12. Lejet e roleve (për vendimin D)" head={["Roli", "Përdorues aktivë", "Shpenzimet", "Shkollimi"]}
        rows={a.roleAccess.map(r => [r.role, r.users, r.shpenzime ? "Po" : "Jo", r.shkollimi ? "Po" : "Jo"])}
        note="Super Admin ka gjithmonë qasje. Nëse një rol ka vetëm njërën nga këto, duhet vendosur për lejen e veçantë." />
    </div>
  );
}

function Summary({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <ul className="list-disc pl-5 space-y-1">{items.map(i => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

function YearTable({ title, rows }: { title: string; rows: { year: string; count: number; total: number; cash: number; bank: number; unpaid: number }[] }) {
  return <Table title={title} head={["Viti", "Shpenzime", "Totali", "Cash (i paguar)", "Bankë (i paguar)", "Pa paguar"]}
    rows={rows.map(r => [r.year, r.count, eur(r.total), eur(r.cash), eur(r.bank), eur(r.unpaid)])} empty="Asnjë shpenzim." />;
}
function MonthTable({ title, rows }: { title: string; rows: { month: string; count: number; total: number; cash: number; bank: number; unpaid: number }[] }) {
  return <Table title={title} head={["Muaji", "Shpenzime", "Totali", "Cash (i paguar)", "Bankë (i paguar)", "Pa paguar"]}
    rows={rows.map(r => [`${r.month.slice(5, 7)}/${r.month.slice(0, 4)}`, r.count, eur(r.total), eur(r.cash), eur(r.bank), eur(r.unpaid)])} empty="Asnjë shpenzim." collapsible />;
}

function Table({ title, head, rows, empty, note, collapsible }: { title?: string; head: string[]; rows: (string | number)[][]; empty?: string; note?: string; collapsible?: boolean }) {
  const body = (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">{head.map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.length === 0 ? <tr><td colSpan={head.length} className="px-3 py-4 text-slate-500">{empty ?? "—"}</td></tr>
            : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5 align-top">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
  return (
    <section className="space-y-2">
      {title && <h2 className="text-lg font-bold" dangerouslySetInnerHTML={{ __html: `${title} <span class="text-slate-500 font-normal text-sm">(${rows.length})</span>` }} />}
      {note && <p className="text-xs text-slate-500">{note}</p>}
      {collapsible && rows.length > 12 ? <details><summary className="cursor-pointer text-primary-700 text-sm">Shfaq të gjithë muajt</summary><div className="mt-2">{body}</div></details> : body}
    </section>
  );
}
