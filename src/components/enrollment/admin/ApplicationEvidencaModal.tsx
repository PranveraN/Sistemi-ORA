"use client";

import { useEffect, useState } from "react";
import { X, Plus, Printer, ClipboardList } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import EvidencaForm, { type EvidencaConfig } from "@/components/evidenca/EvidencaForm";
import { RATING_SCALE, specifyKey } from "@/lib/evidencaConfig";

interface EvidencaRecord { id: number; answers: string; createdAt: string; author: { name: string } }
interface EvidencaItemDef { id: number; label: string; type: string; options: string[] | null; hasSpecify: boolean; categoryId: number | null; order: number }
interface EvidCategoryLite { id: number; label: string; order: number }

// I njëjti model si EvidencaTab.tsx (student), por për një APLIKIM PARA se
// të bëhet nxënës real — shih ApplicationEvidenca në schema.prisma. Kur
// aplikimi pranohet, këto rreshta migrohen te StudentEvidenca (approve/route.ts).
export default function ApplicationEvidencaModal({ applicationId, applicantName, onClose }: {
  applicationId: number; applicantName: string; onClose: () => void;
}) {
  const [config, setConfig] = useState<EvidencaConfig | null>(null);
  const [items, setItems] = useState<EvidencaItemDef[]>([]);
  const [categories, setCategories] = useState<EvidCategoryLite[]>([]);
  const [records, setRecords] = useState<EvidencaRecord[] | null>(null);
  const [filling, setFilling] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/evidenca/config").then(r => r.json()).then(setConfig);
    fetch("/api/evidenca-items?includeInactive=1").then(r => r.json()).then(setItems);
    fetch("/api/evidenca-categories?includeInactive=1").then(r => r.json()).then(setCategories);
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadRecords() {
    fetch(`/api/enrollment/applications/${applicationId}/evidenca`).then(r => r.json()).then(setRecords);
  }

  function setAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/enrollment/applications/${applicationId}/evidenca`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }),
    });
    setSaving(false);
    setAnswers({});
    setFilling(false);
    loadRecords();
  }

  function computeDisplay(rec: EvidencaRecord) {
    const ans: Record<string, string> = JSON.parse(rec.answers);
    const skills = [...categories]
      .sort((a, b) => a.order - b.order)
      .map(category => ({
        category,
        rows: items
          .filter(i => i.type === "RATING" && i.categoryId === category.id && ans[String(i.id)] !== undefined)
          .sort((a, b) => a.order - b.order)
          .map(i => ({ item: i, value: ans[String(i.id)] })),
      }))
      .filter(c => c.rows.length > 0);
    const general = items
      .filter(i => i.type !== "RATING" && ans[String(i.id)] !== undefined)
      .sort((a, b) => a.order - b.order)
      .map(i => ({ item: i, value: ans[String(i.id)], specify: i.hasSpecify ? ans[specifyKey(i.id)] : undefined }));
    let sum = 0, max = 0;
    for (const cat of skills) for (const row of cat.rows) { sum += Number(row.value); max += 5; }
    const percent = max > 0 ? Math.round((sum / max) * 100) : 0;
    return { skills, general, sum, max, percent };
  }

  function displayAnswer(item: EvidencaItemDef, value: string): string {
    if (item.type === "YES_NO") return value === "PO" ? "Po" : "Jo";
    return value;
  }

  function handlePrint(rec: EvidencaRecord) {
    const { skills, general, sum, max, percent } = computeDisplay(rec);
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
<title>Evidenca — ${applicantName}</title>
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
  <div class="title">Evidenca e Aplikimit — ${applicantName}</div>
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-4.5 h-4.5 text-primary-500" /> Evidenca — {applicantName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Testi i evidencës për aplikuesin (para vendimit Prano/Refuzo)</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {filling ? (
          config ? (
            <>
              <div className="p-5">
                <EvidencaForm config={config} answers={answers} setAnswer={setAnswer} />
              </div>
              <div className="flex gap-2 p-5 pt-0">
                <button onClick={() => { setFilling(false); setAnswers({}); }} className="btn-secondary">Anulo</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Duke ruajtur..." : "Ruaj Evidencën"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
          )
        ) : (
          <div className="p-5 space-y-4">
            <button onClick={() => setFilling(true)} className="btn-primary w-full justify-center">
              <Plus className="w-4 h-4" /> Plotëso Evidencë të Re
            </button>

            {!records ? (
              <p className="text-sm text-slate-400 text-center py-6">Duke ngarkuar...</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Asnjë evidencë ende për këtë aplikim.</p>
            ) : (
              records.map(rec => {
                const { skills, general, sum, max, percent } = computeDisplay(rec);
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
                                      {r.value}% <span className="font-normal text-primary-500/80 dark:text-primary-400/80">{RATING_SCALE.find(s => s.value === r.value)?.label}</span>
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
        )}
      </div>
    </div>
  );
}
