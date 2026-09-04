"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, FileText,
  GraduationCap, BarChart3, Settings, BookOpen,
  ChevronLeft, ChevronRight, UtensilsCrossed,
  Shirt, BookMarked, NotebookPen, ClipboardList, Wallet, TrendingUp, Scale, Home, Archive, Building2, History, Package, Boxes, Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useSidebar } from "@/components/layout/SidebarContext";

type Role = "ADMIN" | "FINANCE" | "SECRETARY";

const navSections = [
  {
    label: null,
    roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[],
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard",  roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[] },
      { href: "/students",  icon: Users,           label: "Nxënësit",   roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[] },
      { href: "/families",  icon: Home,            label: "Familjet",   roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[] },
    ],
  },
  {
    label: "Financat",
    roles: ["ADMIN", "FINANCE"] as Role[],
    items: [
      { href: "/shkollimi", icon: GraduationCap,   label: "Shkollimi",  roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/ushqimi",   icon: UtensilsCrossed, label: "Ushqimi",    roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/uniforma",  icon: Shirt,           label: "Uniforma",   roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/librat",    icon: BookOpen,        label: "Librat Angl.", roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/eshkollori",icon: BookMarked,      label: "Eshkollori", roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/invoices",  icon: FileText,        label: "Faturat",    roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/shpenzime", icon: Wallet,          label: "Shpenzimet", roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/hyrat",     icon: TrendingUp,     label: "Të Hyrat",   roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/bilanci",    icon: Scale,          label: "Bilanci",      roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/investime",  icon: Building2,      label: "Investimet",   roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/kerkesat",   icon: Package,        label: "Kërkesat",     roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/materiale",  icon: Boxes,          label: "Katalogu i Materialeve", roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/materiale/porosite", icon: Truck,  label: "Porositë e Materialeve", roles: ["ADMIN", "FINANCE"] as Role[] },
    ],
  },
  {
    label: "Administrata",
    roles: ["ADMIN", "SECRETARY"] as Role[],
    items: [
      { href: "/sekretaria", icon: ClipboardList, label: "Administrata", roles: ["ADMIN", "SECRETARY"] as Role[] },
    ],
  },
  {
    label: "Tjetër",
    roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[],
    items: [
      { href: "/arkiva",   icon: Archive,        label: "Arkiva",    roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[] },
      { href: "/fletorja", icon: NotebookPen,    label: "Fletorja",  roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[] },
      { href: "/classes",  icon: GraduationCap,  label: "Klasat",    roles: ["ADMIN", "FINANCE", "SECRETARY"] as Role[] },
      { href: "/reports",  icon: BarChart3,      label: "Raportet",  roles: ["ADMIN", "FINANCE"] as Role[] },
      { href: "/historiku", icon: History,       label: "Historiku", roles: ["ADMIN"] as Role[] },
      { href: "/settings", icon: Settings,       label: "Cilësimet", roles: ["ADMIN"] as Role[] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const role = ((session?.user as { role?: string } | undefined)?.role ?? "ADMIN") as Role;
  const { mobileOpen, close } = useSidebar();

  // Numri i dukshëm te "Kërkesat" — kërkesa në pritje + aprovuara e padërguara,
  // që stafi ta shohë menjëherë pa hapur faqen (plotëson popup-in periodik).
  const [requestBadge, setRequestBadge] = useState(0);
  useEffect(() => {
    if (role !== "ADMIN" && role !== "FINANCE") return;
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/material-requests/reminder-counts");
        if (!res.ok || cancelled) return;
        const d = await res.json();
        setRequestBadge((d.pending ?? 0) + (d.approvedUnsent ?? 0));
      } catch { /* provohet përsëri në ciklin tjetër */ }
    }
    check();
    const t = setInterval(check, 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [role]);

  return (
    <>
      {/* Overlay — vetëm celular, kur sirtari është i hapur */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={close}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 ease-in-out",
          "md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "w-60",
          collapsed && "md:w-16"
        )}
      >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-slate-200 dark:border-slate-700",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex-shrink-0 w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">Akademia Ora</p>
            <p className="text-xs text-slate-400 leading-tight">Sistemi</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="space-y-1 px-2">
          {navSections.map((section, si) => {
            if (!section.roles.includes(role)) return null;
            const visibleItems = section.items.filter(item => item.roles.includes(role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={si}>
                {section.label && !collapsed && (
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 pt-4 pb-1">
                    {section.label}
                  </p>
                )}
                {section.label && collapsed && si > 0 && (
                  <div className="my-2 mx-3 border-t border-slate-100 dark:border-slate-700" />
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const badge = item.href === "/kerkesat" ? requestBadge : 0;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={close}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                            isActive
                              ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
                            collapsed && "justify-center px-2"
                          )}
                          title={collapsed ? `${item.label}${badge > 0 ? ` (${badge})` : ""}` : undefined}
                        >
                          <span className="relative flex-shrink-0">
                            <item.icon className="w-[18px] h-[18px]" />
                            {badge > 0 && collapsed && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                            )}
                          </span>
                          {!collapsed && <span>{item.label}</span>}
                          {badge > 0 && !collapsed ? (
                            <span className="ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                              {badge > 9 ? "9+" : badge}
                            </span>
                          ) : isActive && !collapsed && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-500 dark:bg-accent-400" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Collapse button — vetëm desktop, s'ka kuptim në sirtarin celular */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-sm transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
      </aside>
    </>
  );
}
