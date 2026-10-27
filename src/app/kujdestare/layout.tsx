import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { DoorOpen, LogOut } from "lucide-react";
import { kujdestarja } from "@/lib/lirimiAuth";

// Portali i kujdestares — krejt i veçantë nga paneli i stafit (si portali i mësimdhënësve).
export default async function KujdestareLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const k = await kujdestarja();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center p-4">
      <div className="w-full max-w-[860px]">
        <div className="flex items-center justify-between py-5">
          <Link href="/kujdestare" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <DoorOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">Akademia Ora</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                Kujdestaria{k ? ` · ${k.klasa}` : ""}
              </p>
            </div>
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600">
              <LogOut className="w-4 h-4" /> Dil
            </button>
          </form>
        </div>
        {k ? children : (
          <div className="card p-6 text-center text-slate-600">
            Kjo faqe është vetëm për kujdestaret e klasave. Nëse jeni kujdestare, kërkoni nga administrata t&apos;jua caktojë klasën.
          </div>
        )}
      </div>
    </div>
  );
}
