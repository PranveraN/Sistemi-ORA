import { DoorOpen } from "lucide-react";
import LirimiPrindi from "@/components/lirimi/LirimiPrindi";

export const metadata = { title: "Kërkesë për Lirim — Akademia Ora" };

// Faqe publike (si /apliko): prindi kërkon lirimin e fëmijës më herët nga shkolla.
export default function LirimiPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3">
            <DoorOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Akademia Ora</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Kërkesë për lirimin e fëmijës nga shkolla</p>
        </div>

        <LirimiPrindi />
      </div>
    </div>
  );
}
