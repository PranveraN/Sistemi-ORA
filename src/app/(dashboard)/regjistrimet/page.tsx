"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { formatDate } from "@/lib/utils";
import { Search, Eye, Clock, CheckCircle, XCircle, ClipboardList, Download, Trash2 } from "lucide-react";
import ApplicationDetailModal from "@/components/enrollment/admin/ApplicationDetailModal";
import { exportEnrollmentApplicationsExcel, type ExportableApplication } from "@/lib/enrollmentApplicationExport";

interface Row extends ExportableApplication {
  id: number;
}

const TABS = [
  { value: "PENDING", label: "Për Shqyrtim", icon: Clock },
  { value: "APPROVED", label: "Pranuar", icon: CheckCircle },
  { value: "REJECTED", label: "Refuzuar", icon: XCircle },
  { value: "ALL", label: "Të Gjitha", icon: ClipboardList },
];

const STATUS_BADGE: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  PENDING:  { label: "Për Shqyrtim", icon: Clock,       className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  APPROVED: { label: "Pranuar",      icon: CheckCircle, className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  REJECTED: { label: "Refuzuar",     icon: XCircle,     className: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function contactOf(r: Row): { name: string; phone: string } {
  if (r.primaryContact === "FATHER") return { name: r.fatherName ?? "—", phone: r.fatherPhone ?? "—" };
  if (r.primaryContact === "OTHER") return { name: r.guardianOtherName ?? "—", phone: r.guardianOtherPhone ?? "—" };
  return { name: r.motherName ?? "—", phone: r.motherPhone ?? "—" };
}

export default function RegjistrimetPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Nga njoftimi "U lirua vend" (bell-i, shih /api/notifications) — çon
  // direkt te kjo klasë, pa pasur nevojë ta kërkojë vetë stafi.
  const [classFilter, setClassFilter] = useState(() => searchParams.get("grade") ?? "");
  const [yearFilter, setYearFilter] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/enrollment/applications?status=${status}`);
    setRows(await r.json());
    setLoading(false);
  }, [status]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  async function handleDelete(r: Row) {
    if (!confirm(`T'a fshij aplikimin e ${r.firstName} ${r.lastName} (${r.referenceNumber ?? `#${r.id}`})? Ky veprim s'kthehet mbrapa. Dokumentet e bashkëngjitura fshihen gjithashtu.`)) return;
    await fetch(`/api/enrollment/applications/${r.id}`, { method: "DELETE" });
    fetchRows();
  }

  // Opsionet e filtrit — nga vetë të dhënat e ngarkuara, jo listë fikse.
  const gradeOptions = Array.from(new Set(rows.map(r => r.desiredGrade).filter((g): g is number => g != null))).sort((a, b) => a - b);
  const yearOptions = Array.from(new Set(rows.map(r => r.schoolYear).filter(Boolean))).sort();

  const filtered = rows.filter(r =>
    (!search.trim() || `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.trim().toLowerCase())) &&
    (!classFilter || String(r.desiredGrade) === classFilter) &&
    (!yearFilter || r.schoolYear === yearFilter)
  );

  return (
    <>
      <Header title="Regjistrimet" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" /> Regjistrimet
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Aplikimet e dorëzuara nga prindërit te formulari publik i regjistrimit (/apliko)</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-sm font-medium">
            {TABS.map(t => (
              <button key={t.value} onClick={() => setStatus(t.value)}
                className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${status === t.value ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="form-input text-sm py-2 w-auto" value={classFilter} onChange={e => setClassFilter(e.target.value)} disabled={!gradeOptions.length}>
              <option value="">Klasa — të gjitha</option>
              {gradeOptions.map(g => <option key={g} value={g}>Klasa {g}</option>)}
            </select>
            <select className="form-input text-sm py-2 w-auto" value={yearFilter} onChange={e => setYearFilter(e.target.value)} disabled={!yearOptions.length}>
              <option value="">Viti — të gjithë</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input className="form-input pl-9 text-sm py-2" placeholder="Kërko sipas emrit..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {(classFilter || yearFilter || search) && (
              <button
                onClick={() => { setClassFilter(""); setYearFilter(""); setSearch(""); }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
              >
                Pastro filtrat
              </button>
            )}
            <button
              onClick={() => exportEnrollmentApplicationsExcel(filtered, `Regjistrimet-${TABS.find(t => t.value === status)?.label.replace(/\s+/g, "-") ?? status}`)}
              disabled={!filtered.length}
              className="btn-secondary text-sm shrink-0"
            >
              <Download className="w-4 h-4" /> Eksporto Excel
            </button>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <p className="text-center text-slate-400 py-10 text-sm">Duke ngarkuar...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">Asnjë aplikim në këtë kategori.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="table-header">Nxënësi</th>
                    <th className="table-header">Statusi</th>
                    <th className="table-header">Klasa</th>
                    <th className="table-header">Viti</th>
                    <th className="table-header">Kontakti Kryesor</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Referenca</th>
                    <th className="table-header text-right">Veprimet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filtered.map(r => {
                    const contact = contactOf(r);
                    const badge = STATUS_BADGE[r.status];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setOpenId(r.id)}>
                        <td className="table-cell font-medium text-slate-900 dark:text-white">
                          {r.firstName} {r.lastName}
                          {r.waitlisted && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-semibold">Listë Pritjeje</span>}
                        </td>
                        <td className="table-cell">
                          {badge && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                              <badge.icon className="w-3 h-3" /> {badge.label}
                            </span>
                          )}
                        </td>
                        <td className="table-cell text-slate-500 dark:text-slate-400">{r.class?.name ?? (r.desiredGrade != null ? `Klasa ${r.desiredGrade}` : "—")}</td>
                        <td className="table-cell text-slate-500 dark:text-slate-400">{r.schoolYear}</td>
                        <td className="table-cell text-slate-500 dark:text-slate-400">{contact.name} · {contact.phone}</td>
                        <td className="table-cell text-slate-500 dark:text-slate-400">{formatDate(r.submittedAt ?? r.createdAt)}</td>
                        <td className="table-cell text-slate-400 text-xs">{r.referenceNumber ?? "—"}</td>
                        <td className="table-cell text-right">
                          <button onClick={e => { e.stopPropagation(); setOpenId(r.id); }} title="Shiko" className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(r); }} title="Fshi" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {openId && (
        <ApplicationDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={fetchRows} />
      )}
    </>
  );
}
