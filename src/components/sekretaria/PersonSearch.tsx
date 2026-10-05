"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Loader2, GraduationCap, UserRound } from "lucide-react";

interface StudentHit { id: number; firstName: string; lastName: string; personalNumber: string | null; status: string; class: { name: string } | null }
interface StaffHit { id: number; emri: string; lenda: string | null; status: string }

const chip = "px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/40 dark:hover:text-primary-300 transition-colors";

// Kërko nxënës (emër, nr. personal) ose staf (emër) dhe hap direkt formularin
// ekzistues të modulit me personin të parazgjedhur.
export default function PersonSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [staff, setStaff] = useState<StaffHit[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setStudents([]); setStaff([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/sekretaria/search?q=${encodeURIComponent(term)}`);
        const d = r.ok ? await r.json() : { students: [], staff: [] };
        setStudents(d.students ?? []); setStaff(d.staff ?? []);
      } catch { setStudents([]); setStaff([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const hasResults = students.length > 0 || staff.length > 0;

  return (
    <div ref={boxRef} className="relative w-full sm:w-96" onKeyDown={e => e.key === "Escape" && setOpen(false)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="form-input pl-9 pr-9 text-sm"
        placeholder="Kërko nxënës ose staf për të nxjerrë dokument…"
        aria-label="Kërko nxënës ose staf"
        aria-expanded={open && q.trim().length >= 2}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}

      {open && q.trim().length >= 2 && !loading && (
        <div className="absolute z-30 mt-1 w-full sm:w-[28rem] right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-[70vh] overflow-y-auto">
          {!hasResults && <p className="px-4 py-3 text-sm text-slate-400">Asnjë nxënës ose staf me këtë emër.</p>}
          {students.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nxënës</p>
              {students.map(s => (
                <div key={`s${s.id}`} className="px-4 py-2.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{s.firstName} {s.lastName}</p>
                    <span className="text-xs text-slate-400 truncate">{[s.class?.name, s.personalNumber].filter(Boolean).join(" · ")}{s.status !== "ACTIVE" ? " · joaktiv" : ""}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 pl-6">
                    <Link href={`/sekretaria/vertetime?type=nxenes&studentId=${s.id}`} className={chip}>Vërtetim</Link>
                    <Link href={`/sekretaria/fletkalimet?studentId=${s.id}`} className={chip}>Fletëkalim</Link>
                    <Link href={`/sekretaria/kontratat-nxenesve?studentId=${s.id}`} className={chip}>Kontrata</Link>
                    <Link href={`/sekretaria/libri-ame?studentId=${s.id}`} className={chip}>Libri Amë</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          {staff.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Staf</p>
              {staff.map(m => (
                <div key={`t${m.id}`} className="px-4 py-2.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-teal-500 shrink-0" />
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{m.emri}</p>
                    <span className="text-xs text-slate-400 truncate">{m.lenda ?? ""}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 pl-6">
                    <Link href={`/sekretaria/kontratat-mesimdhnesve?staffId=${m.id}`} className={chip}>Kontrata</Link>
                    <Link href={`/sekretaria/stafi?staffId=${m.id}`} className={chip}>Profili</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
