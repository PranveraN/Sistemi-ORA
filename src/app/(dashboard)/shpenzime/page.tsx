"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Edit, X, Save, Settings, TrendingDown, Calendar, BarChart3, Download, Upload, Loader2 } from "lucide-react";
import { MONTHS } from "@/lib/utils";
import * as XLSX from "xlsx";

interface Kategori {
  id: number;
  emri: string;
  ngjyra: string | null;
  ikona: string | null;
  _count?: { shpenzime: number };
}

interface Shpenzim {
  id: number;
  shuma: number;
  pershkrim: string | null;
  marres: string | null;
  data: string;
  metoda: string | null;
  referenca: string | null;
  docType: string;
  lloji: string;
  paguar: boolean;
  nrFature: string | null;
  emriBiznesit: string | null;
  nrFiskal: string | null;
  kategori: Kategori;
}

interface Sipartner {
  id?: number;
  emri: string;
  nrFiskal: string | null;
  adresa?: string | null;
  telefoni?: string | null;
  email?: string | null;
}

const NGJYRAT = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#64748b"];

export default function ShpenzimePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 0 = të gjitha muajt
  const [year, setYear] = useState(now.getFullYear());
  const [kategorite, setKategorite] = useState<Kategori[]>([]);
  const [shpenzime, setShpenzime] = useState<Shpenzim[]>([]);
  const [totalShuma, setTotalShuma] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"shpenzime" | "raport" | "raport-zb" | "kategorite">("shpenzime");
  const [llojiFilter, setLlojiFilter] = useState<"" | "ZYRE" | "BANKE">("");

  // Raport vjetor
  type RaportKat = { id: number; emri: string; ngjyra: string | null; ikona: string | null; muajt: Record<number, number>; total: number };
  const [raport, setRaport] = useState<{ kategorite: RaportKat[]; totalPerMuaj: Record<number, number>; totalVjetor: number } | null>(null);
  const [raportLoading, setRaportLoading] = useState(false);
  const [raportYear, setRaportYear] = useState(now.getFullYear());
  const RAPORT_YEARS = [2023, 2024, 2025, 2026];

  // Raport Z/B
  type ZBRow = { kategoria: string; ngjyra: string | null; zyre: Record<number, number>; banke: Record<number, number>; totalZ: number; totalB: number };
  const [zbYear, setZbYear] = useState(now.getFullYear());
  const [zbData, setZbData] = useState<ZBRow[]>([]);
  const [zbLoading, setZbLoading] = useState(false);
  const ZB_YEARS = [2026, 2027, 2028];
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [importMonth, setImportMonth] = useState<string>(""); // "" = të gjithë muajt
  const fileRef = useRef<HTMLInputElement>(null);


  // Modal shtim shpenzimi
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    kategoriId: "", shuma: "", pershkrim: "", marres: "",
    data: now.toISOString().split("T")[0], metoda: "CASH", referenca: "", docType: "KUPON", lloji: "ZYRE", paguar: true,
    nrFature: "", emriBiznesit: "", nrFiskal: "",
  });
  const [sipartnerSuggestions, setSipartnerSuggestions] = useState<Sipartner[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [partnerMsg, setPartnerMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal Sipartner
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partners, setPartners] = useState<Sipartner[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [editPartnerId, setEditPartnerId] = useState<number | null>(null);
  const [partnerForm, setPartnerForm] = useState({ emri: "", nrFiskal: "", adresa: "", telefoni: "", email: "" });
  const [savingPartner, setSavingPartner] = useState(false);
  const [partnerTab, setPartnerTab] = useState<"shto" | "lista" | "import">("shto");
  const partnerImportRef = useRef<HTMLInputElement>(null);
  const [partnerImportMsg, setPartnerImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [importingP, setImportingP] = useState(false);

  async function fetchPartners() {
    setPartnerLoading(true);
    const res = await fetch("/api/sipartner");
    if (res.ok) setPartners(await res.json());
    setPartnerLoading(false);
  }

  function openPartnerModal() {
    setPartnerForm({ emri: "", nrFiskal: "", adresa: "", telefoni: "", email: "" });
    setEditPartnerId(null);
    setPartnerTab("shto");
    setPartnerImportMsg(null);
    fetchPartners();
    setShowPartnerModal(true);
  }

  function openEditPartner(p: Sipartner) {
    setPartnerForm({ emri: p.emri, nrFiskal: p.nrFiskal || "", adresa: p.adresa || "", telefoni: p.telefoni || "", email: p.email || "" });
    setEditPartnerId(p.id ?? null);
    setPartnerTab("shto");
  }

  async function handleSavePartner() {
    if (!partnerForm.emri) return;
    setSavingPartner(true);
    await fetch("/api/sipartner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...partnerForm, id: editPartnerId }),
    });
    setSavingPartner(false);
    setPartnerForm({ emri: "", nrFiskal: "", adresa: "", telefoni: "", email: "" });
    setEditPartnerId(null);
    fetchPartners();
    setPartnerTab("lista");
  }

  async function handleDeletePartner(id: number) {
    if (!confirm("Fshi këtë partner?")) return;
    await fetch(`/api/sipartner?id=${id}`, { method: "DELETE" });
    fetchPartners();
  }

  async function handlePartnerFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingP(true);
    setPartnerImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/sipartner/import", { method: "POST", body: fd });
      const data = await res.json();
      setPartnerImportMsg({ text: data.message || data.error, ok: res.ok });
      if (res.ok) fetchPartners();
    } catch {
      setPartnerImportMsg({ text: "Gabim rrjeti.", ok: false });
    } finally {
      setImportingP(false);
      if (partnerImportRef.current) partnerImportRef.current.value = "";
    }
  }

  // Modal kategorive
  const [showKatModal, setShowKatModal] = useState(false);
  const [editKatId, setEditKatId] = useState<number | null>(null);
  const [katForm, setKatForm] = useState({ emri: "", ngjyra: NGJYRAT[0], ikona: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [shRes, katRes] = await Promise.all([
        fetch(`/api/shpenzime?${month ? `month=${month}&` : ""}year=${year}&limit=500`),
        fetch("/api/shpenzime/kategorite"),
      ]);
      if (shRes.status === 401 || katRes.status === 401) {
        window.location.href = "/login"; return;
      }
      const [shData, katData] = await Promise.all([shRes.json(), katRes.json()]);
      setShpenzime(shData.shpenzime || []);
      setTotalShuma(shData.totalShuma || 0);
      setKategorite(katData || []);
    } catch {
      // Gabim rrjeti — sesioni mund të ketë skaduar
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const _first = useRef(true);
  useEffect(() => {
    const delay = _first.current ? 0 : 300;
    _first.current = false;
    const t = setTimeout(fetchData, delay);
    return () => clearTimeout(t);
  }, [fetchData]);

  function openNew() {
    setEditId(null);
    setForm({ kategoriId: kategorite[0]?.id ? String(kategorite[0].id) : "", shuma: "", pershkrim: "", marres: "", data: now.toISOString().split("T")[0], metoda: "CASH", referenca: "", docType: "KUPON", lloji: "ZYRE", paguar: true, nrFature: "", emriBiznesit: "", nrFiskal: "" });
    setSipartnerSuggestions([]);
    setShowSuggestions(false);
    setShowModal(true);
  }

  function openEdit(s: Shpenzim) {
    setEditId(s.id);
    setForm({
      kategoriId: String(s.kategori.id), shuma: String(s.shuma),
      pershkrim: s.pershkrim || "", marres: s.marres || "",
      data: new Date(s.data).toISOString().split("T")[0],
      metoda: s.metoda || "CASH", referenca: s.referenca || "",
      docType: s.docType || "KUPON", lloji: s.lloji || "ZYRE", paguar: s.paguar,
      nrFature: s.nrFature || "", emriBiznesit: s.emriBiznesit || "", nrFiskal: s.nrFiskal || "",
    });
    setSipartnerSuggestions([]);
    setShowSuggestions(false);
    setShowModal(true);
  }

  async function fetchSipartner(q: string) {
    if (!q || q.length < 2) { setSipartnerSuggestions([]); setShowSuggestions(false); return; }
    const res = await fetch(`/api/sipartner?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data: Sipartner[] = await res.json();
      setSipartnerSuggestions(data);
      setShowSuggestions(data.length > 0);
    }
  }

  function selectSipartner(sp: Sipartner) {
    setForm(f => ({ ...f, emriBiznesit: sp.emri, nrFiskal: sp.nrFiskal || f.nrFiskal }));
    setSipartnerSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSave() {
    if (!form.kategoriId || !form.shuma) return;
    setSaving(true);
    const url = editId ? `/api/shpenzime/${editId}` : "/api/shpenzime";
    const method = editId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    setShowModal(false);
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm("Fshi këtë shpenzim?")) return;
    await fetch(`/api/shpenzime/${id}`, { method: "DELETE" });
    fetchData();
  }

  /* ── Bulk selection ── */
  const [selectedSh, setSelectedSh] = useState<Set<number>>(new Set());
  const [showBulkKat, setShowBulkKat] = useState(false);

  function toggleSelectSh(id: number) {
    setSelectedSh(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedSh(selectedSh.size === shpenzimeFiltruara.length
      ? new Set()
      : new Set(shpenzimeFiltruara.map(s => s.id)));
  }
  async function bulkDelete() {
    if (!confirm(`Fshi ${selectedSh.size} shpenzime të zgjedhura?`)) return;
    await Promise.all([...selectedSh].map(id => fetch(`/api/shpenzime/${id}`, { method: "DELETE" })));
    setSelectedSh(new Set());
    fetchData();
  }
  async function bulkPatch(patch: Record<string, unknown>) {
    await Promise.all([...selectedSh].map(id =>
      fetch(`/api/shpenzime/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    ));
    setSelectedSh(new Set());
    setShowBulkKat(false);
    fetchData();
  }

  function openNewKat() {
    setEditKatId(null);
    setKatForm({ emri: "", ngjyra: NGJYRAT[0], ikona: "" });
    setShowKatModal(true);
  }

  function openEditKat(k: Kategori) {
    setEditKatId(k.id);
    setKatForm({ emri: k.emri, ngjyra: k.ngjyra || NGJYRAT[0], ikona: k.ikona || "" });
    setShowKatModal(true);
  }

  async function handleSaveKategori() {
    if (!katForm.emri) return;
    setSaving(true);
    if (editKatId) {
      await fetch(`/api/shpenzime/kategorite?id=${editKatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(katForm),
      });
    } else {
      await fetch("/api/shpenzime/kategorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(katForm),
      });
    }
    setSaving(false);
    setShowKatModal(false);
    fetchData();
  }

  const fetchRaport = useCallback(async () => {
    setRaportLoading(true);
    try {
      const res = await fetch(`/api/shpenzime/raport?year=${raportYear}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      const data = await res.json();
      setRaport(data);
    } catch {
      // Gabim rrjeti
    } finally {
      setRaportLoading(false);
    }
  }, [raportYear]);

  useEffect(() => {
    if (tab === "raport") fetchRaport();
  }, [tab, fetchRaport]);

  const fetchZB = useCallback(async () => {
    setZbLoading(true);
    try {
      const res = await fetch(`/api/shpenzime?year=${zbYear}&limit=2000`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      const data = await res.json();
      const rows: ZBRow[] = [];
      const katMap = new Map<string, ZBRow>();

      for (const s of (data.shpenzime || [])) {
        const key = s.kategori.emri;
        if (!katMap.has(key)) {
          const r: ZBRow = { kategoria: key, ngjyra: s.kategori.ngjyra, zyre: {}, banke: {}, totalZ: 0, totalB: 0 };
          katMap.set(key, r);
          rows.push(r);
        }
        const r = katMap.get(key)!;
        const month = new Date(s.data).getMonth() + 1;
        if (s.lloji === "BANKE") {
          r.banke[month] = (r.banke[month] ?? 0) + s.shuma;
          r.totalB += s.shuma;
        } else {
          r.zyre[month] = (r.zyre[month] ?? 0) + s.shuma;
          r.totalZ += s.shuma;
        }
      }
      setZbData(rows.filter(r => r.totalZ + r.totalB > 0).sort((a, b) => a.kategoria.localeCompare(b.kategoria, "sq")));
    } catch {
      // Gabim rrjeti
    } finally {
      setZbLoading(false);
    }
  }, [zbYear]);

  useEffect(() => {
    if (tab === "raport-zb") fetchZB();
  }, [tab, fetchZB]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("year", String(raportYear));
      if (importMonth) fd.append("month", importMonth);
      const res = await fetch("/api/shpenzime/import", { method: "POST", body: fd });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const data = await res.json();
      setImportMsg({ text: data.message || data.error, ok: res.ok });
      if (res.ok) fetchRaport();
    } catch {
      setImportMsg({ text: "Gabim rrjeti — kontrollo lidhjen.", ok: false });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function downloadFatureTemplate() {
    const headers = [["Data", "Kategoria", "Nr. Fiskal", "Nr. i Faturës", "Emri Biznesit", "Shuma (€)", "Metoda", "Lloji", "Përshkrimi"]];
    const example = [
      ["15/04/2026", "Pagat", "811234567", "F-2026-001", "Kompania ABC", "1500", "CASH", "ZYRE", "Pagat Prill"],
      ["15/04/2026", "Qiraja", "", "F-2026-002", "Pronari XY", "2000", "BANK", "BANKE", "Qiraja Prill"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faturat");
    XLSX.writeFile(wb, "Template-Faturat-Shpenzime.xlsx");
  }

  function exportFatureExcel() {
    const fatura = shpenzime.filter(s => s.docType === "FATURE");
    if (fatura.length === 0) {
      alert("Nuk ka shpenzime të llojit Faturë për periudhën e zgjedhur.");
      return;
    }
    const headers = ["Data", "Emërtimi", "Kategoria", "Nr. Fiskal", "Nr. i Faturës", "Shuma (€)"];
    const rows = fatura.map(s => [
      new Date(s.data).toLocaleDateString("sq-AL"),
      s.emriBiznesit || s.pershkrim || "—",
      s.kategori?.emri || "—",
      s.nrFiskal || "—",
      s.nrFature || "—",
      s.shuma,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 13 }, { wch: 30 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    const muajiLabel = month === 0 ? "gjitha" : `${month}-${year}`;
    XLSX.utils.book_append_sheet(wb, ws, "Faturat");
    XLSX.writeFile(wb, `Faturat-${muajiLabel}.xlsx`);
  }

  function exportRaportExcel() {
    if (!raport) return;
    const headers = ["Kategoria", ...MONTHS, "Total"];
    const rows = raport.kategorite.map(k => [
      k.emri,
      ...Array.from({ length: 12 }, (_, i) => k.muajt[i + 1] || 0),
      k.total,
    ]);
    rows.push(["TOTALI", ...Array.from({ length: 12 }, (_, i) => raport.totalPerMuaj[i + 1] || 0), raport.totalVjetor]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 30 }, ...Array(13).fill({ wch: 12 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Shpenzime ${raportYear}`);
    XLSX.writeFile(wb, `Shpenzime-${raportYear}.xlsx`);
  }

  async function handleDeleteKat(id: number) {
    if (!confirm("Fshi këtë kategori dhe të gjitha shpenzimet e saj?")) return;
    await fetch(`/api/shpenzime/kategorite?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  function downloadPartnerTemplate() {
    const headers = [["EMRI", "NR. FISKAL", "ADRESA", "TELEFONI", "EMAIL"]];
    const example = [["Kompania ABC sh.p.k.", "811234567", "Rr. Nënë Tereza 5, Prishtinë", "044123456", "info@abc.com"]];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Partneret");
    XLSX.writeFile(wb, "Template-Partneret-Biznesit.xlsx");
  }

  // Filtrim sipas llojit (Zyre/Banke)
  const shpenzimeFiltruara = llojiFilter ? shpenzime.filter(s => s.lloji === llojiFilter) : shpenzime;

  const totalZyre   = shpenzime.filter(s => s.lloji === "ZYRE" || !s.lloji).reduce((sum, s) => sum + s.shuma, 0);
  const totalBanke  = shpenzime.filter(s => s.lloji === "BANKE").reduce((sum, s) => sum + s.shuma, 0);
  const totalBorxh  = shpenzime.filter(s => s.paguar === false).reduce((sum, s) => sum + s.shuma, 0);

  // Grupim sipas kategorisë për summary
  const byCat = kategorite.map(k => ({
    ...k,
    total: shpenzime.filter(s => s.kategori.id === k.id).reduce((sum, s) => sum + s.shuma, 0),
    count: shpenzime.filter(s => s.kategori.id === k.id).length,
  })).filter(k => k.total > 0).sort((a, b) => b.total - a.total);

  return (
    <>
      <Header title="Shpenzimet" backHref="/dashboard" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36">
            <option value={0}>Të gjitha</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-24">
            {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Filtri Zyre / Banke */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-xs font-semibold">
            {([["", "Të gjitha"], ["ZYRE", "🏢 Zyre"], ["BANKE", "🏦 Bankë"]] as [string, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setLlojiFilter(val as "" | "ZYRE" | "BANKE")}
                className={`px-3 py-1.5 transition-colors ${llojiFilter === val
                  ? val === "ZYRE" ? "bg-amber-500 text-white" : val === "BANKE" ? "bg-blue-600 text-white" : "bg-slate-700 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 ml-auto flex-wrap">
            <button onClick={() => setTab("shpenzime")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "shpenzime" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              Shpenzimet
            </button>
            <button onClick={() => setTab("raport")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "raport" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Raport Vjetor
            </button>
            <button onClick={() => setTab("raport-zb")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "raport-zb" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              🏢🏦 Raport Z/B
            </button>
            <button onClick={() => setTab("kategorite")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "kategorite" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              <Settings className="w-3.5 h-3.5" /> Kategoritë
            </button>
          </div>

        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="text-xs text-slate-400 mb-1">{month === 0 ? `Totali ${year}` : `${MONTHS[month - 1]} ${year}`}</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalShuma)}</p>
          </div>
          <div className="card p-4 border-l-2 border-amber-400">
            <p className="text-xs text-slate-400 mb-1">🏢 Shpenzime Zyre</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalZyre)}</p>
          </div>
          <div className="card p-4 border-l-2 border-blue-500">
            <p className="text-xs text-slate-400 mb-1">🏦 Shpenzime Bankë</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalBanke)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400 mb-1">Nr. Shpenzimeve</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{shpenzimeFiltruara.length}</p>
          </div>
          {totalBorxh > 0 && (
            <div className="card p-4 border-l-2 border-orange-400">
              <p className="text-xs text-slate-400 mb-1">⏳ Borxh Shpenzimesh</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalBorxh)}</p>
            </div>
          )}
        </div>


        {tab === "shpenzime" && (
          <>
            {/* Category breakdown */}
            {byCat.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Sipas kategorisë</p>
                <div className="flex flex-wrap gap-2">
                  {byCat.map(k => (
                    <div key={k.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: k.ngjyra || "#64748b" }} />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{k.emri}</span>
                      <span className="text-red-600 dark:text-red-400 font-semibold">{formatCurrency(k.total)}</span>
                      <span className="text-slate-400 text-xs">({k.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Lista e Shpenzimeve</h3>
                <div className="flex items-center gap-2">
                  <button onClick={exportFatureExcel} className="btn-secondary text-sm" title="Exporto vetëm faturat e rregullta si Excel">
                    <Download className="w-4 h-4" /> Faturat Excel
                  </button>
                  <button onClick={openPartnerModal} className="btn-secondary text-sm">
                    <Plus className="w-4 h-4" /> Regjistro Partner
                  </button>
                  <button onClick={openNew} className="btn-primary text-sm">
                    <Plus className="w-4 h-4" /> Shto Shpenzim
                  </button>
                </div>
              </div>

              {/* Bulk actions toolbar */}
              {selectedSh.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800">
                  <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 mr-1">
                    {selectedSh.size} të zgjedhura
                  </span>

                  {/* Kategoria */}
                  <div className="relative">
                    <button onClick={() => setShowBulkKat(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary-400 transition-colors">
                      Kategoria ▾
                    </button>
                    {showBulkKat && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl min-w-[200px] max-h-64 overflow-y-auto">
                        {kategorite.map(k => (
                          <button key={k.id} onMouseDown={() => bulkPatch({ kategoriId: k.id })}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: k.ngjyra || "#64748b" }} />
                            {k.ikona && <span>{k.ikona}</span>}
                            {k.emri}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lloji */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs font-semibold">
                    <button onClick={() => bulkPatch({ lloji: "ZYRE" })}
                      className="px-2.5 py-1 bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors">
                      🏢 Zyrë
                    </button>
                    <button onClick={() => bulkPatch({ lloji: "BANKE" })}
                      className="px-2.5 py-1 bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-l border-slate-200 dark:border-slate-600 transition-colors">
                      🏦 Bankë
                    </button>
                  </div>

                  {/* Statusi */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs font-semibold">
                    <button onClick={() => bulkPatch({ paguar: true })}
                      className="px-2.5 py-1 bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                      ✓ Paguar
                    </button>
                    <button onClick={() => bulkPatch({ paguar: false })}
                      className="px-2.5 py-1 bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 border-l border-slate-200 dark:border-slate-600 transition-colors">
                      ⏳ Borxh
                    </button>
                  </div>

                  {/* Fshi */}
                  <button onClick={bulkDelete}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors ml-auto">
                    <Trash2 className="w-3 h-3" /> Fshi
                  </button>

                  <button onClick={() => setSelectedSh(new Set())}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header w-8">
                        <input type="checkbox"
                          className="rounded accent-primary-600 cursor-pointer"
                          checked={shpenzimeFiltruara.length > 0 && selectedSh.size === shpenzimeFiltruara.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="table-header">Data</th>
                      <th className="table-header">Kategoria</th>
                      <th className="table-header">Përshkrimi</th>
                      <th className="table-header">Marrësi</th>
                      <th className="table-header">Lloji</th>
                      <th className="table-header">Dokumenti</th>
                      <th className="table-header">Metoda</th>
                      <th className="table-header text-right">Shuma</th>
                      <th className="table-header w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {loading ? (
                      <tr><td colSpan={10} className="table-cell text-center py-10 text-slate-400">Duke ngarkuar...</td></tr>
                    ) : shpenzimeFiltruara.length === 0 ? (
                      <tr><td colSpan={10} className="table-cell text-center py-10 text-slate-400">Nuk ka shpenzime për këtë periudhë</td></tr>
                    ) : shpenzimeFiltruara.map(s => (
                      <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selectedSh.has(s.id) ? "bg-primary-50/60 dark:bg-primary-900/10" : ""}`}>
                        <td className="table-cell w-8">
                          <input type="checkbox"
                            className="rounded accent-primary-600 cursor-pointer"
                            checked={selectedSh.has(s.id)}
                            onChange={() => toggleSelectSh(s.id)}
                          />
                        </td>
                        <td className="table-cell text-slate-500 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(s.data).toLocaleDateString("sq-AL")}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: s.kategori.ngjyra || "#64748b" }}>
                            {s.kategori.ikona && <span>{s.kategori.ikona}</span>}
                            {s.kategori.emri}
                          </span>
                        </td>
                        <td className="table-cell text-slate-700 dark:text-slate-300">{s.pershkrim || "—"}</td>
                        <td className="table-cell text-slate-500">{s.marres || "—"}</td>
                        <td className="table-cell">
                          {s.lloji === "BANKE" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">🏦 Bankë</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">🏢 Zyre</span>
                          )}
                        </td>
                        <td className="table-cell">
                          {s.docType === "KUPON" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">🧾 Kupon</span>
                          )}
                          {s.docType === "FATURE" && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">📄 Faturë</span>
                              {s.emriBiznesit && <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{s.emriBiznesit}</p>}
                              {s.nrFiskal && <p className="text-[10px] text-slate-400">Fiskal: {s.nrFiskal}</p>}
                              {s.nrFature && <p className="text-[10px] text-slate-400">Nr: {s.nrFature}</p>}
                            </div>
                          )}
                          {(!s.docType || s.docType === "TJETER") && <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="table-cell text-slate-400 text-xs">{s.metoda || "—"}</td>
                        <td className="table-cell text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`font-semibold ${s.paguar === false ? "text-orange-500 dark:text-orange-400" : "text-red-600 dark:text-red-400"}`}>
                              {formatCurrency(s.shuma)}
                            </span>
                            {s.paguar === false && (
                              <span className="text-[10px] font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full">⏳ E papaguar</span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {shpenzime.length > 0 && (
                    <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={6} className="table-cell font-semibold text-slate-700 dark:text-slate-200">TOTALI</td>
                        <td colSpan={2} className="table-cell text-right font-bold text-red-600 dark:text-red-400 text-base">{formatCurrency(totalShuma)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "raport" && (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary-500" />
                  Raport Vjetor
                </h3>
                <div className="flex gap-1">
                  {RAPORT_YEARS.map(y => (
                    <button
                      key={y}
                      onClick={() => setRaportYear(y)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        raportYear === y
                          ? "bg-primary-600 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <select
                    value={importMonth}
                    onChange={e => setImportMonth(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    title="Zgjidh muajin ose të gjithë"
                  >
                    <option value="">Të gjithë muajt</option>
                    {MONTHS.map((m, i) => (
                      <option key={i + 1} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                  <label className={`btn-secondary text-xs cursor-pointer flex items-center gap-1.5 ${importing ? "opacity-60 pointer-events-none" : ""}`}>
                    <Upload className="w-3.5 h-3.5" />
                    {importing ? "Duke importuar..." : `Importo ${raportYear}`}
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                  </label>
                  <button onClick={downloadFatureTemplate} className="btn-secondary text-xs flex items-center gap-1.5" title="Shkarko template Excel për import me Nr. Fiskal dhe Nr. Faturës">
                    <Download className="w-3.5 h-3.5" /> Template Fatura
                  </button>
                </div>
                <button onClick={exportRaportExcel} disabled={!raport || raportLoading} className="btn-secondary text-xs flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Exporto Excel
                </button>
              </div>
            </div>
            {importMsg && (
              <div className={`mx-4 mb-3 p-3 rounded-xl text-sm font-medium flex items-center justify-between ${importMsg.ok ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200"}`}>
                <span>{importMsg.text}</span>
                <button onClick={() => setImportMsg(null)}><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className="overflow-x-auto">
              {raportLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm">Duke ngarkuar raportin...</div>
              ) : !raport || raport.kategorite.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Nuk ka shpenzime për vitin {raportYear}</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800 min-w-[160px]">Kategoria</th>
                      {MONTHS.map((m, i) => (
                        <th key={i} className="px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 text-right min-w-[80px] whitespace-nowrap">{m}</th>
                      ))}
                      <th className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-right min-w-[90px] bg-slate-100 dark:bg-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {raport.kategorite.map(k => (
                      <tr key={k.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: k.ngjyra || "#64748b" }} />
                          <span>{k.ikona}</span>
                          {k.emri}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const val = k.muajt[i + 1];
                          return (
                            <td key={i} className={`px-2 py-2 text-right ${val ? "text-red-600 dark:text-red-400 font-medium" : "text-slate-200 dark:text-slate-700"}`}>
                              {val ? formatCurrency(val) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800/50">
                          {formatCurrency(k.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-amber-50 dark:bg-amber-900/20 border-t-2 border-amber-200 dark:border-amber-800">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white sticky left-0 bg-amber-50 dark:bg-amber-900/20">TOTALI</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const val = raport.totalPerMuaj[i + 1];
                        return (
                          <td key={i} className={`px-2 py-2.5 text-right font-bold ${val ? "text-red-700 dark:text-red-400" : "text-slate-300 dark:text-slate-600"}`}>
                            {val ? formatCurrency(val) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-bold text-red-700 dark:text-red-400 text-sm bg-amber-100 dark:bg-amber-900/30">
                        {formatCurrency(raport.totalVjetor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "raport-zb" && (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">🏢🏦 Raport Zyre / Bankë</h3>
                <div className="flex gap-1">
                  {ZB_YEARS.map(y => (
                    <button key={y} onClick={() => setZbYear(y)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${zbYear === y ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {zbLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
              ) : zbData.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Nuk ka të dhëna për vitin {zbYear}</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800 min-w-[160px]">Kategoria</th>
                      {MONTHS.map((m, i) => (
                        <th key={i} colSpan={2} className="px-1 py-2 font-semibold text-slate-500 text-center border-l border-slate-200 dark:border-slate-700">{m}</th>
                      ))}
                      <th className="px-2 py-2 font-bold text-amber-700 dark:text-amber-400 text-right bg-amber-50 dark:bg-amber-900/20 min-w-[80px]">🏢 Total</th>
                      <th className="px-2 py-2 font-bold text-blue-700 dark:text-blue-400 text-right bg-blue-50 dark:bg-blue-900/20 min-w-[80px]">🏦 Total</th>
                      <th className="px-2 py-2 font-bold text-slate-700 dark:text-slate-200 text-right bg-slate-100 dark:bg-slate-700 min-w-[90px]">Grand Total</th>
                    </tr>
                    <tr className="border-t border-slate-200 dark:border-slate-700">
                      <th className="sticky left-0 bg-slate-50 dark:bg-slate-800 px-3 py-1"></th>
                      {MONTHS.map((_, i) => (
                        <React.Fragment key={i}>
                          <th className="px-1 py-1 text-amber-600 dark:text-amber-400 font-medium text-center border-l border-slate-200 dark:border-slate-700">Z</th>
                          <th className="px-1 py-1 text-blue-600 dark:text-blue-400 font-medium text-center">B</th>
                        </React.Fragment>
                      ))}
                      <th className="bg-amber-50 dark:bg-amber-900/20"></th>
                      <th className="bg-blue-50 dark:bg-blue-900/20"></th>
                      <th className="bg-slate-100 dark:bg-slate-700"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {zbData.map(r => (
                      <tr key={r.kategoria} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.ngjyra || "#64748b" }} />
                          {r.kategoria}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const z = r.zyre[i + 1];
                          const b = r.banke[i + 1];
                          return (
                            <React.Fragment key={i}>
                              <td className={`px-1 py-2 text-right border-l border-slate-100 dark:border-slate-700/50 ${z ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-200 dark:text-slate-700"}`}>
                                {z ? formatCurrency(z) : "—"}
                              </td>
                              <td className={`px-1 py-2 text-right ${b ? "text-blue-600 dark:text-blue-400 font-medium" : "text-slate-200 dark:text-slate-700"}`}>
                                {b ? formatCurrency(b) : "—"}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10">{formatCurrency(r.totalZ)}</td>
                        <td className="px-2 py-2 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10">{formatCurrency(r.totalB)}</td>
                        <td className="px-2 py-2 text-right font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800/50">{formatCurrency(r.totalZ + r.totalB)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-amber-50 dark:bg-amber-900/20 border-t-2 border-amber-200 dark:border-amber-800">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white sticky left-0 bg-amber-50 dark:bg-amber-900/20">TOTALI</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const z = zbData.reduce((s, r) => s + (r.zyre[i + 1] ?? 0), 0);
                        const b = zbData.reduce((s, r) => s + (r.banke[i + 1] ?? 0), 0);
                        return (
                          <React.Fragment key={i}>
                            <td className={`px-1 py-2.5 text-right font-bold border-l border-amber-200 dark:border-amber-700 ${z ? "text-amber-700 dark:text-amber-400" : "text-slate-300"}`}>
                              {z ? formatCurrency(z) : "—"}
                            </td>
                            <td className={`px-1 py-2.5 text-right font-bold ${b ? "text-blue-700 dark:text-blue-400" : "text-slate-300"}`}>
                              {b ? formatCurrency(b) : "—"}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="px-2 py-2.5 text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30">
                        {formatCurrency(zbData.reduce((s, r) => s + r.totalZ, 0))}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
                        {formatCurrency(zbData.reduce((s, r) => s + r.totalB, 0))}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold text-red-700 dark:text-red-400 text-sm bg-amber-100 dark:bg-amber-900/30">
                        {formatCurrency(zbData.reduce((s, r) => s + r.totalZ + r.totalB, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "kategorite" && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Kategoritë e Shpenzimeve</h3>
              <button onClick={openNewKat} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> Shto Kategori
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {kategorite.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm">Nuk ka kategori — shto një të re</p>
              ) : kategorite.map(k => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: k.ngjyra || "#64748b" }} />
                  <span className="text-lg">{k.ikona}</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">{k.emri}</p>
                    <p className="text-xs text-slate-400">{k._count?.shpenzime ?? 0} shpenzime</p>
                  </div>
                  <button onClick={() => openEditKat(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteKat(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal — Shto/Modifiko Shpenzim */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                {editId ? "Modifiko Shpenzimin" : "Shto Shpenzim të Ri"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">

              {/* 1. Kategoria + Shuma */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Kategoria <span className="text-red-500">*</span></label>
                  <select value={form.kategoriId} onChange={e => setForm(f => ({ ...f, kategoriId: e.target.value }))} className="form-input">
                    <option value="">— Zgjidh —</option>
                    {kategorite.map(k => <option key={k.id} value={k.id}>{k.ikona} {k.emri}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Shuma (€) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.shuma} onChange={e => setForm(f => ({ ...f, shuma: e.target.value }))} className="form-input" placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>

              {/* 2. Data + Metoda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Data</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Metoda</label>
                  <select value={form.metoda} onChange={e => setForm(f => ({ ...f, metoda: e.target.value }))} className="form-input">
                    <option value="CASH">💵 Cash</option>
                    <option value="BANK">🏦 Bankë</option>
                    <option value="CARD">💳 Kartelë</option>
                    <option value="ONLINE">🌐 Online</option>
                  </select>
                </div>
              </div>

              {/* 3. Përshkrimi */}
              <div>
                <label className="form-label">Përshkrimi</label>
                <input type="text" value={form.pershkrim} onChange={e => setForm(f => ({ ...f, pershkrim: e.target.value }))} className="form-input" placeholder="Shënime opsionale..." />
              </div>

              {/* 4. Klasifikimi: Lloji + Dokumenti */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-700 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-1">Klasifikimi</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Lloji</label>
                    <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
                      {[
                        { val: "ZYRE",  label: "🏢 Zyrë" },
                        { val: "BANKE", label: "🏦 Bankë" },
                      ].map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setForm(f => ({ ...f, lloji: opt.val }))}
                          className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${form.lloji === opt.val
                            ? opt.val === "ZYRE" ? "bg-amber-500 text-white" : "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Dokumenti</label>
                    <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
                      {[
                        { val: "KUPON",  label: "🧾 Kupon" },
                        { val: "FATURE", label: "📄 Faturë" },
                        { val: "TJETER", label: "— Tj." },
                      ].map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setForm(f => ({ ...f, docType: opt.val }))}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${form.docType === opt.val ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Fusha shtesë vetëm për Faturë të Rregullt */}
              {form.docType === "FATURE" && (
                <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-1">Të dhënat e Faturës</p>

                  {/* Statusi */}
                  <div>
                    <label className="form-label">Statusi i Pagesës</label>
                    <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
                      <button type="button" onClick={() => setForm(f => ({ ...f, paguar: true }))}
                        className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${form.paguar ? "bg-emerald-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                        ✓ E paguar
                      </button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, paguar: false }))}
                        className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${!form.paguar ? "bg-orange-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                        ⏳ E papaguar
                      </button>
                    </div>
                    {!form.paguar && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Kjo faturë do të figurojë si borxh deri sa të shënohet e paguar.</p>
                    )}
                  </div>

                  {/* Emri i Biznesit me autocomplete */}
                  <div className="relative">
                    <label className="form-label">Emri i Biznesit / Furnitorit</label>
                    <input
                      type="text"
                      value={form.emriBiznesit}
                      onChange={e => { setForm(f => ({ ...f, emriBiznesit: e.target.value })); fetchSipartner(e.target.value); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      onFocus={() => { if (form.emriBiznesit.length >= 2) fetchSipartner(form.emriBiznesit); }}
                      className="form-input"
                      placeholder="Emri i furnitorit..."
                      autoComplete="off"
                    />
                    {showSuggestions && sipartnerSuggestions.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {sipartnerSuggestions.map((sp, i) => (
                          <li key={i}>
                            <button type="button" onMouseDown={() => selectSipartner(sp)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{sp.emri}</p>
                              {sp.nrFiskal && <p className="text-xs text-slate-400">Nr. Fiskal: {sp.nrFiskal}</p>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Nr. Fiskal</label>
                      <input type="text" value={form.nrFiskal} onChange={e => setForm(f => ({ ...f, nrFiskal: e.target.value }))} className="form-input" placeholder="811234567" />
                    </div>
                    <div>
                      <label className="form-label">Nr. i Faturës</label>
                      <input type="text" value={form.nrFature} onChange={e => setForm(f => ({ ...f, nrFature: e.target.value }))} className="form-input" placeholder="F-2026-001" />
                    </div>
                  </div>

                  {partnerMsg && (
                    <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium ${partnerMsg.ok ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>
                      <span>{partnerMsg.text}</span>
                      <button onClick={() => setPartnerMsg(null)} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              )}

              {/* 6. Marrësi + Referenca (sekondare) */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-700">
                <div className="pt-2">
                  <label className="form-label">Marrësi</label>
                  <input type="text" value={form.marres} onChange={e => setForm(f => ({ ...f, marres: e.target.value }))} className="form-input" placeholder="Emri i marrësit" />
                </div>
                <div className="pt-2">
                  <label className="form-label">Referenca</label>
                  <input type="text" value={form.referenca} onChange={e => setForm(f => ({ ...f, referenca: e.target.value }))} className="form-input" placeholder="Nr. ref., etj." />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center"><X className="w-4 h-4" /> Anulo</button>
              <button onClick={handleSave} disabled={saving || !form.kategoriId || !form.shuma} className="btn-primary flex-1 justify-center">
                {saving ? "Duke ruajtur..." : <><Save className="w-4 h-4" /> Ruaj</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Partnerët e Biznesit */}
      {showPartnerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPartnerModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Partnerët e Biznesit</h3>
              <button onClick={() => setShowPartnerModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-700 px-5 shrink-0">
              {([["shto", editPartnerId ? "✏️ Modifiko" : "➕ Shto Partner"], ["lista", `📋 Lista (${partners.length})`], ["import", "📥 Import Excel"]] as [typeof partnerTab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setPartnerTab(key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${partnerTab === key ? "border-primary-600 text-primary-700 dark:text-primary-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* ── TAB: SHTO / MODIFIKO ── */}
              {partnerTab === "shto" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Emri i Biznesit <span className="text-red-500">*</span></label>
                      <input type="text" value={partnerForm.emri} onChange={e => setPartnerForm(f => ({ ...f, emri: e.target.value }))} className="form-input" placeholder="Kompania ABC sh.p.k." />
                    </div>
                    <div>
                      <label className="form-label">Nr. Fiskal</label>
                      <input type="text" value={partnerForm.nrFiskal} onChange={e => setPartnerForm(f => ({ ...f, nrFiskal: e.target.value }))} className="form-input" placeholder="811234567" />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Adresa</label>
                    <input type="text" value={partnerForm.adresa} onChange={e => setPartnerForm(f => ({ ...f, adresa: e.target.value }))} className="form-input" placeholder="Rr. Nënë Tereza 5, Prishtinë" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Telefoni</label>
                      <input type="text" value={partnerForm.telefoni} onChange={e => setPartnerForm(f => ({ ...f, telefoni: e.target.value }))} className="form-input" placeholder="044 123 456" />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input type="email" value={partnerForm.email} onChange={e => setPartnerForm(f => ({ ...f, email: e.target.value }))} className="form-input" placeholder="info@kompania.com" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    {editPartnerId && (
                      <button onClick={() => { setEditPartnerId(null); setPartnerForm({ emri: "", nrFiskal: "", adresa: "", telefoni: "", email: "" }); }} className="btn-secondary flex-1 justify-center">
                        <X className="w-4 h-4" /> Anulo modifikimin
                      </button>
                    )}
                    <button onClick={handleSavePartner} disabled={savingPartner || !partnerForm.emri} className="btn-primary flex-1 justify-center">
                      {savingPartner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {savingPartner ? "Duke ruajtur..." : editPartnerId ? "Ruaj ndryshimet" : "Regjistro Partnerin"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── TAB: LISTA ── */}
              {partnerTab === "lista" && (
                <div>
                  {partnerLoading ? (
                    <div className="py-12 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                  ) : partners.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">Nuk ka partnerë të regjistruar</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                          <th className="table-header">Emri</th>
                          <th className="table-header">Nr. Fiskal</th>
                          <th className="table-header">Telefoni</th>
                          <th className="table-header w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {partners.map((p) => (
                          <tr key={(p as { id?: number }).id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="table-cell font-medium text-slate-800 dark:text-slate-200">
                              {p.emri}
                              {(p as { adresa?: string }).adresa && <p className="text-xs text-slate-400">{(p as { adresa?: string }).adresa}</p>}
                            </td>
                            <td className="table-cell text-slate-500 font-mono text-xs">{p.nrFiskal || "—"}</td>
                            <td className="table-cell text-slate-500 text-xs">{(p as { telefoni?: string }).telefoni || "—"}</td>
                            <td className="table-cell">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => { openEditPartner(p); setPartnerTab("shto"); }} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary-600 transition-colors" title="Modifiko">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeletePartner((p as { id?: number }).id ?? 0)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 transition-colors" title="Fshi">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── TAB: IMPORT ── */}
              {partnerTab === "import" && (
                <div className="space-y-5">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-2">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Formati i Excel-it</p>
                    <p className="text-xs text-slate-500">Skedari duhet të ketë kolonat e mëposhtme (rreshti i parë = header):</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full border-collapse">
                        <thead><tr className="bg-slate-200 dark:bg-slate-700">
                          {["EMRI *", "NR. FISKAL", "ADRESA", "TELEFONI", "EMAIL"].map(h => (
                            <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody><tr className="bg-white dark:bg-slate-800">
                          {["Kompania ABC sh.p.k.", "811234567", "Rr. ..., Prishtinë", "044 123 456", "info@abc.com"].map((v, i) => (
                            <td key={i} className="px-2 py-1.5 text-slate-500 border-t border-slate-100 dark:border-slate-700">{v}</td>
                          ))}
                        </tr></tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-400">* Nëse biznesi ekziston, të dhënat e tij përditësohen.</p>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={downloadPartnerTemplate} className="btn-secondary flex-1 justify-center">
                      <Download className="w-4 h-4" /> Shkarko Template Excel
                    </button>
                    <label className={`btn-primary flex-1 justify-center cursor-pointer ${importingP ? "opacity-60 pointer-events-none" : ""}`}>
                      <Upload className="w-4 h-4" />
                      {importingP ? "Duke importuar..." : "Importo nga Excel"}
                      <input ref={partnerImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handlePartnerFileImport} />
                    </label>
                  </div>

                  {partnerImportMsg && (
                    <div className={`flex items-center justify-between p-3 rounded-xl text-sm font-medium ${partnerImportMsg.ok ? "bg-green-50 dark:bg-green-900/20 text-green-700 border border-green-200" : "bg-red-50 dark:bg-red-900/20 text-red-700 border border-red-200"}`}>
                      <span>{partnerImportMsg.text}</span>
                      <button onClick={() => setPartnerImportMsg(null)}><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal — Shto Kategori */}
      {showKatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowKatModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white">{editKatId ? "Modifiko Kategorinë" : "Shto Kategori të Re"}</h3>
              <button onClick={() => setShowKatModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Emri <span className="text-red-500">*</span></label>
                <input type="text" value={katForm.emri} onChange={e => setKatForm(f => ({ ...f, emri: e.target.value }))} className="form-input" placeholder="p.sh. Qira, Paga, Komunal..." />
              </div>
              <div>
                <label className="form-label">Ikona (emoji)</label>
                <input type="text" value={katForm.ikona} onChange={e => setKatForm(f => ({ ...f, ikona: e.target.value }))} className="form-input" placeholder="🏠 💰 💡" />
              </div>
              <div>
                <label className="form-label">Ngjyra</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {NGJYRAT.map(n => (
                    <button key={n} onClick={() => setKatForm(f => ({ ...f, ngjyra: n }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${katForm.ngjyra === n ? "border-slate-800 dark:border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: n }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowKatModal(false)} className="btn-secondary flex-1 justify-center">Anulo</button>
              <button onClick={handleSaveKategori} disabled={saving || !katForm.emri} className="btn-primary flex-1 justify-center">
                {saving ? "Duke ruajtur..." : editKatId ? "Ruaj Ndryshimet" : "Shto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
