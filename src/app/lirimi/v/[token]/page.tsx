import { DoorOpen } from "lucide-react";
import LirimiVendim from "@/components/lirimi/LirimiVendim";

export const metadata = { title: "Kërkesë për Lirim — Akademia Ora" };

// Faqe publike: kujdestari (nga Stafi, pa llogari) aprovon/refuzon me linkun nga SMS-ja.
export default async function LirimiVendimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="w-full max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-2xl mb-2">
            <DoorOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Akademia Ora — Kërkesë për lirim</h1>
        </div>
        <LirimiVendim token={token} />
      </div>
    </div>
  );
}
