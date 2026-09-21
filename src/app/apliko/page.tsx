import { BookOpen } from "lucide-react";
import ApplicationWizard from "@/components/enrollment/ApplicationWizard";

export const metadata = { title: "Aplikim për Regjistrim — Akademia Ora" };

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Akademia Ora</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Aplikim për Regjistrim të Nxënësit të Ri</p>
        </div>

        <ApplicationWizard />
      </div>
    </div>
  );
}
