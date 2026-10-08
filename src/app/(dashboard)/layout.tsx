import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import MaterialRequestReminder from "@/components/layout/MaterialRequestReminder";
import AppFooter from "@/components/layout/AppFooter";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <SidebarProvider>
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
          <AppFooter />
        </div>
        <MaterialRequestReminder />
      </SidebarProvider>
    </SessionProvider>
  );
}
