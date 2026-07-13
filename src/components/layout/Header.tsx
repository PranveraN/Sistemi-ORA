"use client";

import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import {
  Moon, Sun, LogOut, Bell, ChevronLeft, Settings, User,
  AlertTriangle, Clock, CheckCircle, CreditCard, X, ChevronRight, Menu,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSidebar } from "@/components/layout/SidebarContext";

/* ── helpers ─────────────────────────────────────────────── */
function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    ADMIN: "Administrator",
    FINANCE: "Financë",
    SECRETARY: "Sekretari",
  };
  return map[role] || role;
}

function getRoleColor(role: string) {
  const map: Record<string, string> = {
    ADMIN: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    FINANCE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    SECRETARY: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return map[role] || "bg-slate-100 text-slate-600";
}

function getAvatarColor(name?: string | null) {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
  ];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "tani";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)} ditë`;
}

function dueDateLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "Skadon — e kaluar";
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Skadon sot";
  if (days === 1) return "Skadon nesër";
  return `Skadon në ${days} ditë`;
}

/* ── types ───────────────────────────────────────────────── */
type Notif = {
  id: string;
  type: "reminder" | "task" | "overdue" | "paid";
  title: string;
  body: string;
  dueDate: string | null;
  urgent: boolean;
  category: string;
};

type NotifData = {
  notifications: Notif[];
  counts: { reminders: number; overdue: number; urgentTasks: number; recentPayments: number; total: number };
};

const TYPE_CONFIG = {
  reminder: { icon: Clock,         color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/20"   },
  task:     { icon: AlertTriangle,  color: "text-red-500",    bg: "bg-red-50 dark:bg-red-900/20"       },
  overdue:  { icon: CreditCard,     color: "text-red-500",    bg: "bg-red-50 dark:bg-red-900/20"       },
  paid:     { icon: CheckCircle,    color: "text-emerald-500",bg: "bg-emerald-50 dark:bg-emerald-900/20"},
};

/* ═══════════════════════════════════════════════════════════
   NOTIFICATION PANEL
═══════════════════════════════════════════════════════════ */
function NotifPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<NotifData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("notif_seen");
    if (saved) setSeenIds(new Set(JSON.parse(saved)));
  }, []);

  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    setTimeout(() => document.addEventListener("mousedown", handle), 0);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  function markAllRead() {
    if (!data) return;
    const ids = data.notifications.map(n => n.id);
    const next = new Set([...seenIds, ...ids]);
    setSeenIds(next);
    localStorage.setItem("notif_seen", JSON.stringify([...next]));
  }

  const unseen = data?.notifications.filter(n => !seenIds.has(n.id)) ?? [];

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[380px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          <span className="font-semibold text-sm text-slate-800 dark:text-white">Njoftimet</span>
          {unseen.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">{unseen.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unseen.length > 0 && (
            <button onClick={markAllRead} className="text-xs text-blue-500 hover:text-blue-600 font-medium">
              Shëno të gjitha
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Summary chips */}
      {data && (
        <div className="flex gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          {data.counts.overdue > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full font-medium">
              <CreditCard className="w-3 h-3" /> {data.counts.overdue} të vonuara
            </span>
          )}
          {data.counts.reminders > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full font-medium">
              <Clock className="w-3 h-3" /> {data.counts.reminders} kujtues
            </span>
          )}
          {data.counts.urgentTasks > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">
              <AlertTriangle className="w-3 h-3" /> {data.counts.urgentTasks} urgjente
            </span>
          )}
          {data.counts.total === 0 && data.counts.recentPayments === 0 && (
            <span className="text-xs text-slate-400">Asnjë njoftim aktiv</span>
          )}
        </div>
      )}

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
            <p className="text-sm font-medium text-slate-500">Gjithçka është në rregull!</p>
            <p className="text-xs text-slate-400">Nuk ka njoftime të reja</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.notifications.map(n => {
              const cfg = TYPE_CONFIG[n.type];
              const Icon = cfg.icon;
              const isNew = !seenIds.has(n.id);
              return (
                <div key={n.id} className={`flex gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isNew ? "bg-blue-50/40 dark:bg-blue-900/10" : ""}`}>
                  <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-snug ${isNew ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                        {n.title}
                      </p>
                      {isNew && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                    </div>
                    {n.body && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{n.body}</p>}
                    <p className={`text-xs mt-1 font-medium ${n.urgent && n.type !== "paid" ? "text-red-500" : "text-slate-400"}`}>
                      {n.type === "paid" ? timeAgo(n.dueDate) : dueDateLabel(n.dueDate)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3">
        <Link
          href="/admin/fletorja"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 font-medium"
        >
          Shiko të gjitha te Fletorja <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROFILE MENU
═══════════════════════════════════════════════════════════ */
function ProfileMenu({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const menuRef = useRef<HTMLDivElement>(null);
  const userRole = (session?.user as { role?: string })?.role || "";
  const name = session?.user?.name;
  const email = session?.user?.email;
  const initials = getInitials(name);
  const avatarGradient = getAvatarColor(name);
  const roleLabel = getRoleLabel(userRole);
  const roleColor = getRoleColor(userRole);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    setTimeout(() => document.addEventListener("mousedown", handle), 0);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const loginTime = new Date().toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
  const loginDate = new Date().toLocaleDateString("sq-AL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in"
    >
      {/* Profile hero */}
      <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center shadow-md flex-shrink-0`}>
            <span className="text-white font-bold text-base">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Session info */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Aktiv — {loginDate}, {loginTime}</span>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-2">
        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-5 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
            <Settings className="w-4 h-4 text-slate-500 group-hover:text-blue-500" />
          </div>
          <div>
            <p className="font-medium text-xs">Cilësimet</p>
            <p className="text-xs text-slate-400">Shkolla, kategorite, klasat</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
        </Link>

        <Link
          href="/admin/fletorja"
          onClick={onClose}
          className="flex items-center gap-3 px-5 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-violet-50 dark:group-hover:bg-violet-900/30 transition-colors">
            <User className="w-4 h-4 text-slate-500 group-hover:text-violet-500" />
          </div>
          <div>
            <p className="font-medium text-xs">Fletorja e Adminit</p>
            <p className="text-xs text-slate-400">Shënime, detyra, kujtuese</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
        </Link>
      </div>

      {/* Divider + sign out */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group font-medium"
        >
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
          Dilni nga sistemi
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════════════════ */
export default function Header({ title, backHref }: { title?: string; backHref?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { toggle: toggleSidebar } = useSidebar();
  const [dark, setDark] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [, setSeenIds] = useState<Set<string>>(new Set());

  useEffect(() => { setCanGoBack(window.history.length > 1); }, []);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  // Load seen IDs and fetch count
  const fetchCount = useCallback(async () => {
    try {
      const saved = localStorage.getItem("notif_seen");
      const seen = saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
      setSeenIds(seen);
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const d: NotifData = await r.json();
      const unseen = d.notifications.filter(n => !seen.has(n.id)).length;
      setNotifCount(unseen);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle("dark");
    setDark(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  const userRole = (session?.user as { role?: string })?.role || "";
  const name = session?.user?.name;
  const initials = getInitials(name);
  const avatarGradient = getAvatarColor(name);

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      {/* Left */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          aria-label="Hap menynë"
        >
          <Menu className="w-5 h-5" />
        </button>
        {(backHref || canGoBack) && (
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {title && <h1 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h1>}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Dark mode */}
        <button
          onClick={toggleDark}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotif(v => !v); setShowProfile(false); }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors relative ${showNotif ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          >
            <Bell className="w-4 h-4" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>
          {showNotif && (
            <NotifPanel onClose={() => { setShowNotif(false); fetchCount(); }} />
          )}
        </div>

        {/* Profile button */}
        <div className="relative">
          <button
            onClick={() => { setShowProfile(v => !v); setShowNotif(false); }}
            className={`flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl transition-colors ${showProfile ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          >
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
              <span className="text-white font-bold text-xs">{initials}</span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{name}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{getRoleLabel(userRole)}</p>
            </div>
          </button>
          {showProfile && (
            <ProfileMenu onClose={() => setShowProfile(false)} />
          )}
        </div>
      </div>
    </header>
  );
}
