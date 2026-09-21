"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Plus, History as HistoryIcon, Printer, X } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import EvidencaForm, { type EvidencaConfig } from "@/components/evidenca/EvidencaForm";
import { RATING_SCALE, specifyKey } from "@/lib/evidencaConfig";

interface StudentRow {
  id: number; firstName: string; lastName: string;
  class: { name: string; level: string } | null;
}
interface EvidencaRecord {
  id: number; answers: string; createdAt: string;
  author: { name: string };
}
interface EvidencaItemDef { id: number; label: string; type: string; options: string[] | null; hasSpecify: boolean; categoryId: number | null; order: number }
interface EvidCategoryLite { id: number; label: string; order: number }
interface RecentRow { student: StudentRow; count: number; lastDate: string }

// Skeda "Evidenca" brenda faqes Regjistrimet — vlerësimi pedagogjik (tabelë
// aftësish me notë) + pyetësori shëndetësor/logjistik i takimit me nxënësin
// e sapopranuar. Kërkohet nxënësi (jo aplikimi), sepse evidenca lidhet me
// vetë Student-in, jo me EnrollmentApplication.
export default function EvidencaTab({ initialQuery = "" }: { initialQuery?: string }) {
  const [search, setSearch] = useState(initialQuery);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [counts, setCounts] = useState<Record<number, { count: number; lastDate: string }>>({});
  const [config, setConfig] = useState<EvidencaConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const [recent, setRecent] = useState<RecentRow[] | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const [formStudent, setFormStudent] = useState<StudentRow | null>(null);
  const [historyStudent, setHistoryStudent] = useState<StudentRow | null>(null);

  useEffect(() => { fetch("/api/evidenca/config").then(r => r.json()).then(setConfig); }, []);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    const r = await fetch("/api/evidenca/recent");
    setRecent(await r.json());
    setLoadingRecent(false);
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    const r = await fetch(`/api/students?search=${encodeURIComponent(q)}&limit=20`);
    const d = await r.json();
    setStudents(d.students);
    setLoading(false);
    if (d.students.length > 0) {
      const ids = d.students.map((s: StudentRow) => s.id).join(",");
      const c = await fetch(`/api/evidenca/counts?ids=${ids}`).then(res => res.json());
      setCounts(c);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (search.trim()) runSearch(search.trim()); else { setStudents([]); setCounts({}); } }, 300);
    return () => clearTimeout(t);
  }, [search, runSearch]);

  function refreshCounts(studentId: number) {
    fetch(`/api/evidenca/counts?ids=${studentId}`).then(r => r.json()).then(c => setCounts(prev => ({ ...prev, ...c })));
    loadRecent();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">Vlerësimi pedagogjik dhe pyetësori shëndetësor/logjistik i takimit me nxënësin e sapopranuar</p>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input className="form-input pl-9" placeholder="Kërko nxënësin sipas emrit..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {!search.trim() && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Nxënës me Evidencë të Krijuar</p>
          <div className="card overflow-hidden">
            {loadingRecent ? (
              <p className="text-center text-slate-400 py-10 text-sm">Duke ngarkuar...</p>
            ) : !recent || recent.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">Ende s&apos;ka asnjë evidencë të krijuar — kërkoni një nxënës më sipër për ta plotësuar për herë të parë.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {recent.map(({ student: s, count, lastDate }) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-slate-400">
                        {s.class ? `${s.class.name} (${s.class.level})` : "Pa klasë"} · {count} evidenc{count > 1 ? "a" : "ë"} — e fundit {formatDate(lastDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setHistoryStudent(s)} className="btn-secondary text-sm">
                        <HistoryIcon className="w-4 h-4" /> Historia
                      </button>
                      <button onClick={() => setFormStudent(s)} className="btn-primary text-sm">
                        <Plus className="w-4 h-4" /> Shto Evidencë
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {search.trim() && (
        <div className="card overflow-hidden">
          {loading ? (
            <p className="text-center text-slate-400 py-10 text-sm">Duke kërkuar...</p>
          ) : students.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">Asnjë nxënës i gjetur.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {students.map(s => {
                const c = counts[s.id];
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-slate-400">
                        {s.class ? `${s.class.name} (${s.class.level})` : "Pa klasë"} ·{" "}
                        {c ? `${c.count} evidenc${c.count > 1 ? "a" : "ë"} — e fundit ${formatDate(c.lastDate)}` : "S'ka evidencë ende"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c && (
                        <button onClick={() => setHistoryStudent(s)} className="btn-secondary text-sm">
                          <HistoryIcon className="w-4 h-4" /> Historia
                        </button>
                      )}
                      <button onClick={() => setFormStudent(s)} className="btn-primary text-sm">
                        <Plus className="w-4 h-4" /> Shto Evidencë
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {formStudent && config && (
        <EvidencaFillModal
          student={formStudent}
          config={config}
          onClose={() => setFormStudent(null)}
          onSaved={() => { refreshCounts(formStudent.id); setFormStudent(null); }}
        />
      )}

      {historyStudent && (
        <EvidencaHistoryModal student={historyStudent} onClose={() => setHistoryStudent(null)} />
      )}
    </div>
  );
}

function EvidencaFillModal({ student, config, onClose, onSaved }: {
  student: StudentRow; config: EvidencaConfig; onClose: () => void; onSaved: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function setAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/students/${student.id}/evidenca`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">Evidencë e Re — {student.firstName} {student.lastName}</h3>
        </div>
        <div className="p-5">
          <EvidencaForm config={config} answers={answers} setAnswer={setAnswer} />
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary">Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? "Duke ruajtur..." : "Ruaj Evidencën"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DisplayRow { item: EvidencaItemDef; value: string; specify?: string }
interface DisplayCategory { category: EvidCategoryLite; rows: DisplayRow[] }
interface RecordDisplay { skills: DisplayCategory[]; general: DisplayRow[]; sum: number; max: number; percent: number }

function computeDisplay(rec: EvidencaRecord, items: EvidencaItemDef[], categories: EvidCategoryLite[]): RecordDisplay {
  const answers: Record<string, string> = JSON.parse(rec.answers);

  const skills = [...categories]
    .sort((a, b) => a.order - b.order)
    .map(category => ({
      category,
      rows: items
        .filter(i => i.type === "RATING" && i.categoryId === category.id && answers[String(i.id)] !== undefined)
        .sort((a, b) => a.order - b.order)
        .map(i => ({ item: i, value: answers[String(i.id)] })),
    }))
    .filter(c => c.rows.length > 0);

  const general = items
    .filter(i => i.type !== "RATING" && answers[String(i.id)] !== undefined)
    .sort((a, b) => a.order - b.order)
    .map(i => ({ item: i, value: answers[String(i.id)], specify: i.hasSpecify ? answers[specifyKey(i.id)] : undefined }));

  let sum = 0, max = 0;
  for (const cat of skills) for (const row of cat.rows) { sum += Number(row.value); max += 5; }
  const percent = max > 0 ? Math.round((sum / max) * 100) : 0;

  return { skills, general, sum, max, percent };
}

function displayAnswer(item: EvidencaItemDef, value: string): string {
  if (item.type === "YES_NO") return value === "PO" ? "Po" : "Jo";
  return value;
}

function EvidencaHistoryModal({ student, onClose }: { student: StudentRow; onClose: () => void }) {
  const [records, setRecords] = useState<EvidencaRecord[] | null>(null);
  const [items, setItems] = useState<EvidencaItemDef[]>([]);
  const [categories, setCategories] = useState<EvidCategoryLite[]>([]);

  useEffect(() => {
    fetch(`/api/students/${student.id}/evidenca`).then(r => r.json()).then(setRecords);
    fetch("/api/evidenca-items?includeInactive=1").then(r => r.json()).then(setItems);
    fetch("/api/evidenca-categories?includeInactive=1").then(r => r.json()).then(setCategories);
  }, [student.id]);

  function handlePrint(rec: EvidencaRecord) {
    const { skills, general, sum, max, percent } = computeDisplay(rec, items, categories);

    const skillsHTML = skills.map(({ category, rows }) => `
      <div class="cat-block">
        <div class="cat-title">${category.label}</div>
        <table>
          ${rows.map(r => `<tr><td class="q">${r.item.label}</td><td class="val">${r.value}%</td><td class="lbl">${RATING_SCALE.find(s => s.value === r.value)?.label ?? ""}</td></tr>`).join("")}
        </table>
      </div>`).join("");

    const generalHTML = general.length > 0 ? `
      <div class="section-title">Pyetësori Shëndetësor &amp; Logjistik</div>
      <table class="general">
        ${general.map(r => `<tr><td class="q">${r.item.label}</td><td class="a">${displayAnswer(r.item, r.value)}${r.specify ? ` (${r.specify})` : ""}</td></tr>`).join("")}
      </table>` : "";

    const totalHTML = max > 0 ? `
      <div class="total-box"><span>Rezultati Total i Vlerësimit</span><strong>${sum} / ${max} &middot; ${percent}%</strong></div>` : "";

    const win = window.open("", "_blank", "width=820,height=1200");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Evidenca — ${student.firstName} ${student.lastName}</title>
<style>
@page { size: A4 portrait; margin: 14mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; }
.header { border-bottom:3px solid #7c3aed; padding-bottom:10px; margin-bottom:16px; }
.school { font-size:10px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:.06em; }
.title { font-size:16px; font-weight:800; color:#1e293b; margin-top:2px; }
.meta { font-size:9.5px; color:#64748b; margin-top:4px; }
.cat-block { margin-bottom:10px; }
.cat-title { font-size:10.5px; font-weight:800; color:#334155; background:#f1f5f9; padding:4px 8px; border-radius:4px 4px 0 0; }
table { width:100%; border-collapse:collapse; font-size:10px; }
.cat-block table { border:1px solid #e2e8f0; border-top:none; }
td { padding:4px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
tr:last-child td { border-bottom:none; }
.q { width:60%; color:#1e293b; }
.val { width:15%; font-weight:800; color:#7c3aed; text-align:center; }
.lbl { width:25%; color:#64748b; }
.section-title { font-size:11px; font-weight:800; color:#334155; margin:14px 0 6px; text-transform:uppercase; letter-spacing:.04em; }
table.general { border:1px solid #e2e8f0; }
table.general .q { width:65%; }
table.general .a { width:35%; font-weight:700; text-align:right; }
.total-box { display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding:8px 12px; background:#f5f3ff; border:1px solid #ddd6fe; border-radius:6px; font-size:11px; font-weight:700; color:#5b21b6; }
</style></head><body>
<div class="header">
  <div class="school">Akademia Ora</div>
  <div class="title">Evidenca e Regjistrimit — ${student.firstName} ${student.lastName}</div>
  <div class="meta">Plotësoi: ${rec.author.name} &bull; ${formatDateTime(rec.createdAt)}</div>
</div>
${skillsHTML}
${totalHTML}
${generalHTML}
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h3 className="font-bold text-slate-900 dark:text-white">Historia e Evidencave — {student.firstName} {student.lastName}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!records ? (
            <p className="text-sm text-slate-400 text-center py-6">Duke ngarkuar...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Asnjë evidencë ende.</p>
          ) : (
            records.map(rec => {
              const { skills, general, sum, max, percent } = computeDisplay(rec, items, categories);
              return (
                <div key={rec.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(rec.createdAt)} — <span className="font-medium text-slate-700 dark:text-slate-200">{rec.author.name}</span>
                    </p>
                    <button onClick={() => handlePrint(rec)} title="Printo / Shkarko PDF" className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 shrink-0">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    {skills.length > 0 && (
                      <div className="space-y-3">
                        {skills.map(({ category, rows }) => (
                          <div key={category.id}>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{category.label}</p>
                            <div className="rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                              {rows.map(r => (
                                <div key={r.item.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm bg-white dark:bg-slate-800/40">
                                  <span className="text-slate-600 dark:text-slate-300">{r.item.label}</span>
                                  <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                    {r.value}%
                                    <span className="font-normal text-primary-500/80 dark:text-primary-400/80">{RATING_SCALE.find(s => s.value === r.value)?.label}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {max > 0 && (
                          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary-50/60 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/40">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rezultati Total</span>
                            <span className="text-sm font-bold text-primary-700 dark:text-primary-300">{sum} / {max} · {percent}%</span>
                          </div>
                        )}
                      </div>
                    )}

                    {general.length > 0 && (
                      <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-3">
                        {general.map(r => (
                          <div key={r.item.id} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-slate-500 dark:text-slate-400">{r.item.label}</span>
                            <span className="text-slate-800 dark:text-slate-100 font-medium text-right">
                              {displayAnswer(r.item, r.value)}{r.specify ? ` (${r.specify})` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
