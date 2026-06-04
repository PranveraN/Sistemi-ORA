"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import {
  GraduationCap, Plus, Users, X, Save,
  Settings2, CheckCircle, Loader2, Pencil,
} from "lucide-react";

interface Class {
  id: number;
  name: string;
  level: string;
  teacher: string | null;
  _count: { students: number };
}

// Levels 1–9, each with A and B
const LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);

export default function ClassesPage() {
  const [classes,  setClasses]  = useState<Class[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", level: "", teacher: "" });
  const [saving,   setSaving]   = useState(false);

  // Setup dialog
  const [showSetup,   setShowSetup]   = useState(false);
  const [setupBusy,   setSetupBusy]   = useState(false);
  const [setupResult, setSetupResult] = useState<{ classesCreated: number; studentsReassigned: number; studentsUnassigned: number } | null>(null);

  // Edit teacher inline
  const [editId,      setEditId]      = useState<number | null>(null);
  const [editTeacher, setEditTeacher] = useState("");

  async function fetchClasses() {
    setLoading(true);
    const res = await fetch("/api/classes");
    setClasses(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchClasses(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ name: "", level: "", teacher: "" });
    fetchClasses();
  }

  async function handleSetup() {
    setSetupBusy(true);
    const res = await fetch("/api/classes/setup", { method: "POST" });
    setSetupResult(await res.json());
    setSetupBusy(false);
    fetchClasses();
  }

  async function saveTeacher(id: number) {
    await fetch(`/api/classes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher: editTeacher }),
    });
    setEditId(null);
    fetchClasses();
  }

  // Group classes by level number
  const byLevel = new Map<number, Class[]>();
  for (const cls of classes) {
    const num = parseInt(cls.name);
    if (!isNaN(num)) {
      if (!byLevel.has(num)) byLevel.set(num, []);
      byLevel.get(num)!.push(cls);
    }
  }
  // Sort within level: A before B
  byLevel.forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));

  const totalStudents = classes.reduce((s, c) => s + c._count.students, 0);

  return (
    <>
      <Header title="Klasat" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">
              {classes.length} klasa &nbsp;·&nbsp; {totalStudents} nxënës gjithsej
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSetup(true); setSetupResult(null); }}
              className="btn-secondary"
            >
              <Settings2 className="w-4 h-4" />
              Konfigurim Automatik (1A–9B)
            </button>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Shto Klasë
            </button>
          </div>
        </div>

        {/* ── Setup confirmation dialog ── */}
        {showSetup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              {!setupResult ? (
                <>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">Konfigurim Automatik i Klasave</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ky veprim do të:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-none">
                    {[
                      "Fshijë të gjitha klasat ekzistuese",
                      "Krijojë 18 klasa: 1A, 1B, 2A, 2B, ... 9A, 9B",
                      "Ri-asignojë nxënësit në klasat e duhura automatikisht",
                    ].map((t, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i+1}</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                    Nxënësit që kishin klasa të pavlefshme (p.sh. 1B, 2B kur nuk ekzistonin) do të mbeten pa klasë dhe duhen asignuar manualisht.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowSetup(false)} className="btn-secondary flex-1 justify-center">
                      <X className="w-4 h-4" />Anulo
                    </button>
                    <button onClick={handleSetup} disabled={setupBusy} className="btn-primary flex-1 justify-center">
                      {setupBusy
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Duke konfiguruar...</>
                        : <><Settings2 className="w-4 h-4" />Konfigurim</>
                      }
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center text-center gap-3 py-2">
                    <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-green-600" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">U krye me sukses!</h3>
                    <div className="grid grid-cols-3 gap-3 w-full">
                      <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                        <p className="text-2xl font-bold text-primary-600">{setupResult.classesCreated}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Klasa u krijuan</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                        <p className="text-2xl font-bold text-green-600">{setupResult.studentsReassigned}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Nxënës u asignuan</p>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                        <p className="text-2xl font-bold text-amber-500">{setupResult.studentsUnassigned}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Pa klasë</p>
                      </div>
                    </div>
                    {setupResult.studentsUnassigned > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                        {setupResult.studentsUnassigned} nxënës pa klasë — ri-importo listën ose asignoji manualisht.
                      </p>
                    )}
                  </div>
                  <button onClick={() => setShowSetup(false)} className="btn-primary w-full justify-center">
                    <CheckCircle className="w-4 h-4" />Mbyll
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Add class form ── */}
        {showForm && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Klasë e Re</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Emri <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="form-input" placeholder="p.sh. 1A, 2B" required />
              </div>
              <div>
                <label className="form-label">Niveli <span className="text-red-500">*</span></label>
                <input value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                  className="form-input" placeholder="p.sh. Klasa 1" required />
              </div>
              <div>
                <label className="form-label">Mësuesi/ja</label>
                <input value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))}
                  className="form-input" placeholder="Emri i mësuesit" />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  <X className="w-4 h-4" />Anulo
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  <Save className="w-4 h-4" />
                  {saving ? "Duke ruajtur..." : "Ruaj"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Classes grid by level ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : classes.length === 0 ? (
          <div className="card p-16 text-center">
            <GraduationCap className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 mb-4">Asnjë klasë e regjistruar</p>
            <button onClick={() => { setShowSetup(true); setSetupResult(null); }} className="btn-primary mx-auto">
              <Settings2 className="w-4 h-4" />
              Konfigurim Automatik (1A–9B)
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {LEVELS.map(lvl => {
              const lvlClasses = byLevel.get(lvl) || [];
              if (lvlClasses.length === 0) return null;
              return (
                <div key={lvl}>
                  {/* Level header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {lvl}
                    </div>
                    <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                      Klasa {lvl}
                    </h2>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <span className="text-xs text-slate-400">
                      {lvlClasses.reduce((s, c) => s + c._count.students, 0)} nxënës
                    </span>
                  </div>

                  {/* A and B cards */}
                  <div className="grid grid-cols-2 gap-4">
                    {lvlClasses.map(cls => (
                      <div key={cls.id} className="card p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-11 h-11 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-primary-600" />
                          </div>
                          <span className="text-3xl font-black text-primary-600 dark:text-primary-400">{cls.name}</span>
                        </div>

                        {/* Teacher */}
                        {editId === cls.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              value={editTeacher}
                              onChange={e => setEditTeacher(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveTeacher(cls.id); if (e.key === "Escape") setEditId(null); }}
                              className="form-input text-xs py-1 flex-1"
                              placeholder="Emri i mësuesit..."
                              autoFocus
                            />
                            <button onClick={() => saveTeacher(cls.id)} className="p-1.5 bg-green-500 text-white rounded-lg">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <p className="text-xs text-slate-400 flex-1">
                              {cls.teacher
                                ? <span className="text-slate-600 dark:text-slate-300">Mësuesi: {cls.teacher}</span>
                                : <span className="italic">Pa mësues</span>}
                            </p>
                            <button
                              onClick={() => { setEditId(cls.id); setEditTeacher(cls.teacher || ""); }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-primary-500 transition-all"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span className={`text-sm font-semibold ${cls._count.students > 0 ? "text-slate-700 dark:text-slate-200" : "text-slate-300"}`}>
                              {cls._count.students} nxënës
                            </span>
                          </div>
                          <Link
                            href={`/students?classId=${cls.id}`}
                            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline"
                          >
                            Shiko →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Any classes not in 1-9 range */}
            {classes.filter(c => isNaN(parseInt(c.name))).length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Të tjera</h2>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {classes.filter(c => isNaN(parseInt(c.name))).map(cls => (
                    <div key={cls.id} className="card p-4">
                      <span className="text-xl font-bold text-primary-600">{cls.name}</span>
                      <p className="text-xs text-slate-400 mt-1">{cls.teacher || "Pa mësues"}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-500">{cls._count.students}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
