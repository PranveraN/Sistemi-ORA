import { Construction } from "lucide-react";

// Moduli TIMI INVEST — Raportet & eksportet (vjen në Fazën 4).
export default function Page() {
  return (
    <div className="card p-8 text-center space-y-2">
      <Construction className="w-8 h-8 mx-auto text-amber-500" />
      <h2 className="section-title">Raportet & eksportet</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">Excel për TIMI, gjendja për çdo familje (PDF), profaturat e hapura dhe auditimi. Deri atëherë: butoni Eksporto Excel te Pasqyra.</p>
      <p className="text-xs text-slate-400">Vjen në Fazën 4.</p>
    </div>
  );
}
