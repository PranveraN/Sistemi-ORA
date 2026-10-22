import { Construction } from "lucide-react";

// Moduli TIMI INVEST — Historiku i ndryshimeve (vjen në Fazën 2).
export default function Page() {
  return (
    <div className="card p-8 text-center space-y-2">
      <Construction className="w-8 h-8 mx-auto text-amber-500" />
      <h2 className="section-title">Historiku i ndryshimeve</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">Kush, kur, çka ndryshoi dhe pse: çmimet, zbritjet, fazat, stornot dhe rikthimet.</p>
      <p className="text-xs text-slate-400">Vjen në Fazën 2.</p>
    </div>
  );
}
