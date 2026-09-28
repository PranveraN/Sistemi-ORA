"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Plus, Pencil, Trash2, X, Check,
  Users, BadgeCheck, CreditCard, Download, Upload, Loader2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import * as XLSX from "xlsx";

interface StaffMember {
  id: number;
  emri: string;
  telefoni: string | null;
  lenda: string | null;
  nrPersonal: string | null;
  nrLlogarise: string | null;
  banka: string | null;
  totalBruto: number | null;
  kontrata: string | null;
  llojiKontrates: string | null;
  cmimOres: number | null;
  oreMuaj: number | null;
  adresa: string | null;
  kodi: string | null;
  tipi: string | null;
  status: string;
  dataLindjes: string | null;
  vendlindja: string | null;
  gjinia: string | null;
  shtetesia: string | null;
  email: string | null;
  dataFillimit: string | null;
  orari: string | null;
  niveliShkollimit: string | null;
  profesioni: string | null;
  pozita: string | null;
}

const EMPTY: Omit<StaffMember, "id"> = {
  emri: "", telefoni: null, lenda: null, nrPersonal: null,
  nrLlogarise: null, banka: null, totalBruto: null,
  kontrata: null, llojiKontrates: null, cmimOres: null, oreMuaj: null,
  adresa: null, kodi: null, tipi: "Primar", status: "ACTIVE",
  dataLindjes: null, vendlindja: null, gjinia: null, shtetesia: null,
  email: null, dataFillimit: null, orari: null, niveliShkollimit: null,
  profesioni: null, pozita: null,
};

const TIPI_OPTIONS = ["", "Primar", "Sekondar", "Menaxhment"];

// Kolonat e template-it Excel të stafit — të njëjtat për shkarkimin e
// template-it bosh, eksportin e stafit ekzistues, dhe importin (kërkimi i
// kolonave është fleksibël sipas emrit të header-it, jo pozicionit).
const TEMPLATE_HEADERS = [
  "Nr", "Emri Mbiemri", "Nr.Personal", "Datlindja", "Vendlindja", "Gjinia",
  "Shtetesia", "Telefoni", "Emaili", "Data e fillimit të punës",
  "Përzgjedhja e punëdhënësit Primar/Sekondar", "Orari", "Niveli i shkollimit",
  "Profesioni", "Pozita",
];

function tipiBadge(tipi: string | null) {
  if (tipi === "Menaxhment") return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  if (tipi === "Primar") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (tipi === "Sekondar") return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300";
  return "bg-slate-100 text-slate-600";
}


export default function StafiPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipiFilter, setTipiFilter] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Omit<StaffMember, "id">>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tipiFilter) params.set("tipi", tipiFilter);
    fetch(`/api/staff?${params}`)
      .then(r => r.json())
      .then((data: StaffMember[]) => {
        setStaff([...data].sort((a, b) =>
          a.emri.localeCompare(b.emri, "sq", { sensitivity: "base" })
        ));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, tipiFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => { setForm(EMPTY); setModal("add"); };
  const openEdit = (m: StaffMember) => {
    setForm({
      emri: m.emri, telefoni: m.telefoni, lenda: m.lenda, nrPersonal: m.nrPersonal,
      nrLlogarise: m.nrLlogarise, banka: m.banka, totalBruto: m.totalBruto,
      kontrata: m.kontrata, llojiKontrates: m.llojiKontrates,
      cmimOres: m.cmimOres, oreMuaj: m.oreMuaj,
      adresa: m.adresa, kodi: m.kodi, tipi: m.tipi, status: m.status,
      dataLindjes: m.dataLindjes ? m.dataLindjes.slice(0, 10) : null,
      vendlindja: m.vendlindja, gjinia: m.gjinia, shtetesia: m.shtetesia,
      email: m.email,
      dataFillimit: m.dataFillimit ? m.dataFillimit.slice(0, 10) : null,
      orari: m.orari, niveliShkollimit: m.niveliShkollimit,
      profesioni: m.profesioni, pozita: m.pozita,
    });
    setEditId(m.id);
    setModal("edit");
  };

  const save = async () => {
    setSaving(true);
    if (modal === "add") {
      await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch(`/api/staff/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/staff/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  const saveAdresa = async (id: number, adresa: string) => {
    const member = staff.find(s => s.id === id);
    if (!member) return;
    setStaff(prev => prev.map(s => s.id === id ? { ...s, adresa: adresa || null } : s));
    await fetch(`/api/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...member, adresa: adresa || null }),
    });
  };

  const menaxhment = staff.filter(s => s.tipi === "Menaxhment");
  const mesimdhenes = staff.filter(s => s.tipi !== "Menaxhment");

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stafi");
    XLSX.writeFile(wb, "Template-Stafi.xlsx");
  };

  const exportExcel = () => {
    const rows = [...staff].sort((a, b) => a.emri.localeCompare(b.emri, "sq", { sensitivity: "base" }));
    const aoa = [
      TEMPLATE_HEADERS,
      ...rows.map((s, i) => [
        i + 1, s.emri, s.nrPersonal ?? "", s.dataLindjes?.slice(0, 10) ?? "", s.vendlindja ?? "",
        s.gjinia ?? "", s.shtetesia ?? "", s.telefoni ?? "", s.email ?? "",
        s.dataFillimit?.slice(0, 10) ?? "", s.tipi ?? "", s.orari ?? "",
        s.niveliShkollimit ?? "", s.profesioni ?? "", s.pozita ?? "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stafi");
    XLSX.writeFile(wb, `Stafi-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  function getCol(row: Record<string, unknown>, ...keys: string[]): string {
    const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
    for (const key of keys) {
      const v = lower[key.toLowerCase().trim()];
      if (v !== undefined && v !== null && v !== "") return String(v).trim();
    }
    return "";
  }

  function excelDateToIso(raw: string): string | null {
    if (!raw) return null;
    const asNum = parseFloat(raw);
    if (!isNaN(asNum) && asNum > 1000 && !raw.includes("-") && !raw.includes("/")) {
      const d = new Date(Math.round((asNum - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    const dmy = raw.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });

      const rows = rawRows
        .map(row => {
          const emri = getCol(row, "Emri Mbiemri", "Emri", "emri");
          if (!emri) return null;
          return {
            emri,
            nrPersonal: getCol(row, "Nr.Personal", "Nr Personal") || null,
            dataLindjes: excelDateToIso(getCol(row, "Datlindja", "Datëlindja")),
            vendlindja: getCol(row, "Vendlindja") || null,
            gjinia: getCol(row, "Gjinia") || null,
            shtetesia: getCol(row, "Shtetesia", "Shtetësia") || null,
            telefoni: getCol(row, "Telefoni") || null,
            email: getCol(row, "Emaili", "Email") || null,
            dataFillimit: excelDateToIso(getCol(row, "Data e fillimit të punës", "Data e fillimit te punes")),
            tipi: getCol(row, "Përzgjedhja e punëdhënësit Primar/Sekondar", "Perzgjedhja e punedhenesit Primar/Sekondar", "Tipi") || null,
            orari: getCol(row, "Orari") || null,
            niveliShkollimit: getCol(row, "Niveli i shkollimit") || null,
            profesioni: getCol(row, "Profesioni") || null,
            pozita: getCol(row, "Pozita") || null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length === 0) {
        setImportMsg("Asnjë rresht i vlefshëm (mungon 'Emri Mbiemri').");
        return;
      }

      const res = await fetch("/api/staff/merge-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(`U plotësuan të dhënat për ${data.updated} anëtarë ekzistues, u shtuan ${data.created} të rinj.`);
        load();
      } else {
        setImportMsg(data.error || "Importimi dështoi.");
      }
    } catch {
      setImportMsg("Gabim gjatë leximit të skedarit Excel.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <Header title="Stafi" backHref="/sekretaria" />
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Link href="/sekretaria" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex-1 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input pl-9 w-full"
                placeholder="Kërko sipas emrit, lëndës, kodit..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input w-44" value={tipiFilter} onChange={e => setTipiFilter(e.target.value)}>
              <option value="">Të gjithë tipet</option>
              {TIPI_OPTIONS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2 ml-auto flex-wrap">
              <button onClick={downloadTemplate} className="btn-secondary text-sm">
                <Download className="w-4 h-4" /> Template Excel
              </button>
              <label className={`btn-secondary text-sm cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? "Duke importuar..." : "Importo Excel"}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              </label>
              <button onClick={exportExcel} className="btn-secondary text-sm">
                <Download className="w-4 h-4" /> Eksporto Excel
              </button>
              <button onClick={openAdd} className="btn-primary">
                <Plus className="w-4 h-4" /> Shto anëtar
              </button>
            </div>
          </div>
        </div>

        {importMsg && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-center justify-between">
            {importMsg}
            <button onClick={() => setImportMsg(null)} className="text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Gjithsej", value: staff.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
            { label: "Menaxhment", value: menaxhment.length, icon: BadgeCheck, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/30" },
            { label: "Mësimdhënës", value: mesimdhenes.length, icon: Users, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/30" },
            { label: "Me kontratë", value: staff.filter(s => s.kontrata === "Po" || s.kontrata === "Nenshkruar").length, icon: CreditCard, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30" },
          ].map(s => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Management table */}
            {(tipiFilter === "" || tipiFilter === "Menaxhment") && menaxhment.length > 0 && (
              <StaffTable title="Menaxhment" rows={menaxhment} onEdit={openEdit} onDelete={setDeleteId} onAdresaChange={saveAdresa} />
            )}
            {/* Teaching staff table */}
            {(tipiFilter === "" || tipiFilter !== "Menaxhment") && mesimdhenes.length > 0 && (
              <StaffTable title="Stafi Mësimdhënës" rows={mesimdhenes} onEdit={openEdit} onDelete={setDeleteId} onAdresaChange={saveAdresa} />
            )}
            {staff.length === 0 && (
              <div className="card p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nuk ka anëtarë stafi.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {modal === "add" ? "Shto Anëtar Stafi" : "Ndrysho Anëtarin"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Emri i plotë *</label>
                <input className="input w-full" value={form.emri} onChange={e => setForm(f => ({ ...f, emri: e.target.value }))} />
              </div>
              <div>
                <label className="label">Telefoni</label>
                <input className="input w-full" value={form.telefoni ?? ""} onChange={e => setForm(f => ({ ...f, telefoni: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Lënda / Roli</label>
                <input className="input w-full" value={form.lenda ?? ""} onChange={e => setForm(f => ({ ...f, lenda: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Nr. Personal</label>
                <input className="input w-full" value={form.nrPersonal ?? ""} onChange={e => setForm(f => ({ ...f, nrPersonal: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Kodi (EM...)</label>
                <input className="input w-full" value={form.kodi ?? ""} onChange={e => setForm(f => ({ ...f, kodi: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Nr. Llogarisë</label>
                <input className="input w-full" value={form.nrLlogarise ?? ""} onChange={e => setForm(f => ({ ...f, nrLlogarise: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Banka</label>
                <input className="input w-full" value={form.banka ?? ""} onChange={e => setForm(f => ({ ...f, banka: e.target.value || null }))} />
              </div>

              {/* Të dhëna shtesë (template Excel) */}
              <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Të Dhëna Shtesë</p>
              </div>
              <div>
                <label className="label">Datëlindja</label>
                <input type="date" className="input w-full" value={form.dataLindjes ?? ""} onChange={e => setForm(f => ({ ...f, dataLindjes: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Vendlindja</label>
                <input className="input w-full" value={form.vendlindja ?? ""} onChange={e => setForm(f => ({ ...f, vendlindja: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Gjinia</label>
                <select className="input w-full" value={form.gjinia ?? ""} onChange={e => setForm(f => ({ ...f, gjinia: e.target.value || null }))}>
                  <option value="">—</option>
                  <option>Mashkull</option>
                  <option>Femër</option>
                </select>
              </div>
              <div>
                <label className="label">Shtetësia</label>
                <input className="input w-full" value={form.shtetesia ?? ""} onChange={e => setForm(f => ({ ...f, shtetesia: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Emaili</label>
                <input type="email" className="input w-full" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Data e Fillimit të Punës</label>
                <input type="date" className="input w-full" value={form.dataFillimit ?? ""} onChange={e => setForm(f => ({ ...f, dataFillimit: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Orari</label>
                <input className="input w-full" placeholder="p.sh. 08:00–13:00" value={form.orari ?? ""} onChange={e => setForm(f => ({ ...f, orari: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Niveli i Shkollimit</label>
                <input className="input w-full" value={form.niveliShkollimit ?? ""} onChange={e => setForm(f => ({ ...f, niveliShkollimit: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Profesioni</label>
                <input className="input w-full" value={form.profesioni ?? ""} onChange={e => setForm(f => ({ ...f, profesioni: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Pozita</label>
                <input className="input w-full" value={form.pozita ?? ""} onChange={e => setForm(f => ({ ...f, pozita: e.target.value || null }))} />
              </div>

              {/* Lloji i Kontratës */}
              <div className="col-span-2">
                <label className="label">Lloji i Kontratës</label>
                <div className="flex gap-2">
                  {["Orar i Plotë", "Gjysmë Orari", "Me Orë"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, llojiKontrates: f.llojiKontrates === opt ? null : opt }))}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        form.llojiKontrates === opt
                          ? "bg-primary-600 border-primary-600 text-white"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orar i Plotë — paga bruto */}
              {(!form.llojiKontrates || form.llojiKontrates === "Orar i Plotë") && (
                <div className="col-span-2">
                  <label className="label">Total Bruto (€/muaj)</label>
                  <input className="input w-full" type="number" step="0.01" placeholder="p.sh. 900"
                    value={form.totalBruto ?? ""}
                    onChange={e => setForm(f => ({ ...f, totalBruto: e.target.value ? parseFloat(e.target.value) : null }))} />
                </div>
              )}

              {/* Gjysmë Orari / Me Orë — çmim ore + numër orësh */}
              {(form.llojiKontrates === "Gjysmë Orari" || form.llojiKontrates === "Me Orë") && (
                <>
                  <div>
                    <label className="label">Çmimi i Orës (€)</label>
                    <input className="input w-full" type="number" step="0.01" placeholder="p.sh. 8.50"
                      value={form.cmimOres ?? ""}
                      onChange={e => setForm(f => {
                        const c = e.target.value ? parseFloat(e.target.value) : null;
                        const total = c && f.oreMuaj ? Math.round(c * f.oreMuaj * 100) / 100 : f.totalBruto;
                        return { ...f, cmimOres: c, totalBruto: total };
                      })} />
                  </div>
                  <div>
                    <label className="label">Orë / Muaj</label>
                    <input className="input w-full" type="number" step="1" placeholder="p.sh. 80"
                      value={form.oreMuaj ?? ""}
                      onChange={e => setForm(f => {
                        const o = e.target.value ? parseInt(e.target.value) : null;
                        const total = f.cmimOres && o ? Math.round(f.cmimOres * o * 100) / 100 : f.totalBruto;
                        return { ...f, oreMuaj: o, totalBruto: total };
                      })} />
                  </div>
                  <div className="col-span-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Total Bruto i llogaritur</span>
                    <span className="text-lg font-bold text-primary-600">
                      {form.cmimOres && form.oreMuaj
                        ? `€ ${(form.cmimOres * form.oreMuaj).toFixed(2)}`
                        : "—"}
                    </span>
                  </div>
                </>
              )}

              {/* Statusi kontratës + tipi + statusi */}
              <div>
                <label className="label">Statusi Kontratës</label>
                <select className="input w-full" value={form.kontrata ?? ""} onChange={e => setForm(f => ({ ...f, kontrata: e.target.value || null }))}>
                  <option value="">—</option>
                  <option>Po/Nënshkruar</option>
                  <option>Nuk e ka kthy</option>
                  <option>Nuk ka</option>
                  <option>Nuk eshte staf</option>
                </select>
              </div>
              <div>
                <label className="label">Tipi</label>
                <select className="input w-full" value={form.tipi ?? ""} onChange={e => setForm(f => ({ ...f, tipi: e.target.value || null }))}>
                  <option value="">—</option>
                  <option>Primar</option>
                  <option>Sekondar</option>
                  <option>Menaxhment</option>
                </select>
              </div>
              <div>
                <label className="label">Statusi</label>
                <select className="input w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Aktiv</option>
                  <option value="INACTIVE">Joaktiv</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={save} disabled={saving || !form.emri.trim()} className="btn-primary flex-1">
                {saving ? "Duke ruajtur..." : <><Check className="w-4 h-4" /> Ruaj</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Fshi anëtarin?</h3>
            <p className="text-sm text-slate-400 mb-6">Ky veprim nuk mund të kthehet.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={confirmDelete} className="btn-danger flex-1">Fshi</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

function StaffTable({ title, rows, onEdit, onDelete, onAdresaChange }: {
  title: string;
  rows: StaffMember[];
  onEdit: (m: StaffMember) => void;
  onDelete: (id: number) => void;
  onAdresaChange: (id: number, adresa: string) => void;
}) {
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);

  const startEdit = (m: StaffMember) => setEditing({ id: m.id, value: m.adresa || "" });

  const commitEdit = () => {
    if (!editing) return;
    onAdresaChange(editing.id, editing.value);
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">{title} — {rows.length}</h2>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Emri</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Nr. Personal</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Datëlindja</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Vendlindja</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Gjinia</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Shtetësia</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Data e Fillimit</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Orari</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Niveli i Shkollimit</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Profesioni</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Pozita</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Lënda / Roli</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Telefoni</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kodi</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bruto</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Adresa</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipi</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(m => (
                <tr key={m.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${m.status === "INACTIVE" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{m.emri}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{m.nrPersonal || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{m.dataLindjes ? m.dataLindjes.slice(0, 10) : "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{m.vendlindja || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.gjinia || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{m.shtetesia || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{m.dataFillimit ? m.dataFillimit.slice(0, 10) : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.orari || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{m.niveliShkollimit || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.profesioni || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.pozita || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{m.lenda || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.telefoni || "—"}</td>
                  <td className="px-4 py-3">
                    {m.kodi ? <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{m.kodi}</span> : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                    {m.totalBruto != null ? `€${m.totalBruto.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-2 py-2 min-w-[180px]">
                    {editing?.id === m.id ? (
                      <input
                        autoFocus
                        className="w-full px-2 py-1 text-sm border border-primary-400 rounded-lg outline-none bg-white dark:bg-slate-800 dark:text-white"
                        value={editing.value}
                        onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : prev)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(m)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors group"
                        title="Kliko për të edituar"
                      >
                        {m.adresa || <span className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 text-xs italic">+ shto adresë</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.tipi && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tipiBadge(m.tipi)}`}>{m.tipi}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => onEdit(m)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(m.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
