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
        {/* Në printim: pa menynë anësore/fundin, dhe faqja rrjedh lirshëm (jo e prerë në një ekran) */}
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white">
          <div className="flex flex-1 min-h-0 overflow-hidden print:block print:overflow-visible">
            <div className="contents print:hidden"><Sidebar /></div>
            <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
              <main className="flex-1 overflow-y-auto print:overflow-visible">
                {children}
              </main>
            </div>
          </div>
          <div className="contents print:hidden"><AppFooter /></div>
        </div>
        <MaterialRequestReminder />
      </SidebarProvider>
    </SessionProvider>
  );
}
