import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { BookOpen, LogOut } from "lucide-react";
import TeacherRequestsClient from "@/components/material-requests/TeacherRequestsClient";

export default async function TeacherHomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const name = session.user?.name ?? "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">Akademia Ora</p>
              <p className="text-xs text-slate-400 leading-tight">Kërkesa për Material Didaktik</p>
            </div>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600">
              <LogOut className="w-4 h-4" />
              Dil
            </button>
          </form>
        </div>

        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mirë se erdhe, {name}!</h1>
        </div>

        <TeacherRequestsClient />
      </div>
    </div>
  );
}
