"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Plus, Pencil, Trash2, X, Check,
  Users, BadgeCheck, CreditCard,
} from "lucide-react";
import Header from "@/components/layout/Header";

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
  kodi: string | null;
  tipi: string | null;
  status: string;
}

const EMPTY: Omit<StaffMember, "id"> = {
  emri: "", telefoni: null, lenda: null, nrPersonal: null,
  nrLlogarise: null, banka: null, totalBruto: null,
  kontrata: null, kodi: null, tipi: "Primar", status: "ACTIVE",
};

const TIPI_OPTIONS = ["", "Primar", "Sekundar", "Menaxhment"];

function tipiBadge(tipi: string | null) {
  if (tipi === "Menaxhment") return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  if (tipi === "Primar") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (tipi === "Sekundar") return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300";
  return "bg-slate-100 text-slate-600";
}

function kontrataColor(k: string | null) {
  if (!k || k === "Nuk ka" || k === "Nuk e ka kthy" || k === "Nuk eshte staf") return "text-red-500";
  if (k === "Po" || k === "Nenshkruar") return "text-green-600 dark:text-green-400";
  return "text-slate-400";
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
    setForm({ emri: m.emri, telefoni: m.telefoni, lenda: m.lenda, nrPersonal: m.nrPersonal,
      nrLlogarise: m.nrLlogarise, banka: m.banka, totalBruto: m.totalBruto,
      kontrata: m.kontrata, kodi: m.kodi, tipi: m.tipi, status: m.status });
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

  const menaxhment = staff.filter(s => s.tipi === "Menaxhment");
  const mesimdhenes = staff.filter(s => s.tipi !== "Menaxhment");

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
            <div className="flex gap-2 ml-auto">
              <button onClick={openAdd} className="btn-primary">
                <Plus className="w-4 h-4" /> Shto anëtar
              </button>
            </div>
          </div>
        </div>

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
              <StaffTable title="Menaxhment" rows={menaxhment} onEdit={openEdit} onDelete={setDeleteId} />
            )}
            {/* Teaching staff table */}
            {(tipiFilter === "" || tipiFilter !== "Menaxhment") && mesimdhenes.length > 0 && (
              <StaffTable title="Stafi Mësimdhënës" rows={mesimdhenes} onEdit={openEdit} onDelete={setDeleteId} />
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
                <label className="label">Lënda</label>
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
              <div>
                <label className="label">Total Bruto (€)</label>
                <input className="input w-full" type="number" step="0.01" value={form.totalBruto ?? ""} onChange={e => setForm(f => ({ ...f, totalBruto: e.target.value ? parseFloat(e.target.value) : null }))} />
              </div>
              <div>
                <label className="label">Kontrata</label>
                <select className="input w-full" value={form.kontrata ?? ""} onChange={e => setForm(f => ({ ...f, kontrata: e.target.value || null }))}>
                  <option value="">—</option>
                  <option>Po</option>
                  <option>Nenshkruar</option>
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
                  <option>Sekundar</option>
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

function StaffTable({ title, rows, onEdit, onDelete }: {
  title: string;
  rows: StaffMember[];
  onEdit: (m: StaffMember) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">{title} — {rows.length}</h2>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Emri</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Lënda / Roli</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Telefoni</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kodi</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bruto</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kontrata</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipi</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(m => (
                <tr key={m.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${m.status === "INACTIVE" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{m.emri}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{m.lenda || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.telefoni || "—"}</td>
                  <td className="px-4 py-3">
                    {m.kodi ? <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{m.kodi}</span> : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                    {m.totalBruto != null ? `€${m.totalBruto.toLocaleString()}` : "—"}
                  </td>
                  <td className={`px-4 py-3 text-center text-xs font-semibold ${kontrataColor(m.kontrata)}`}>
                    {m.kontrata || "—"}
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
