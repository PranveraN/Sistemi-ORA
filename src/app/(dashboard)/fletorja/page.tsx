"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  LayoutDashboard, StickyNote, CheckSquare, Calendar, Bell,
  Plus, X, Pin, Archive, Trash2, ChevronLeft, ChevronRight,
  Search, Clock, AlertCircle, CheckCircle, Circle, Users,
  CreditCard, BookOpen, FileText, Zap, Activity,
  Flag, User, Edit2, Check, ChevronDown,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
interface AdminNote {
  id: number; title: string | null; content: string;
  color: string; tags: string | null; pinned: boolean; archived: boolean;
  createdAt: string; updatedAt: string;
}
interface AdminTask {
  id: number; title: string; description: string | null;
  priority: string; dueDate: string | null; assignedTo: string | null;
  status: string; createdAt: string;
}
interface AdminEvent {
  id: number; title: string; description: string | null;
  date: string; endDate: string | null; type: string; color: string; allDay: boolean;
}
interface AdminReminder {
  id: number; title: string; type: string; dueDate: string;
  done: boolean; description: string | null;
}
interface StatsData {
  stats: { activeTasks: number; todayReminders: number; overdueReminders: number; activeStudents: number; totalDebt: number };
  studentsWithDebt: Array<{ id: number; firstName: string; lastName: string; parentPhone: string; class: { name: string } | null; totalDebt: number }>;
  recentPayments: Array<{ id: number; paidAmount: number; paidDate: string; student: { firstName: string; lastName: string }; category: { name: string } }>;
  upcomingEvents: AdminEvent[];
  upcomingReminders: AdminReminder[];
  recentNotes: AdminNote[];
  upcomingTasks: AdminTask[];
  auditLogs: Array<{ id: number; action: string; entity: string; details: string | null; createdAt: string; user: { name: string } }>;
}

type Tab = "overview" | "notes" | "tasks" | "calendar" | "reminders";

/* ─── Helpers ────────────────────────────────────────────── */
const NOTE_COLORS: { key: string; bg: string; border: string; dot: string }[] = [
  { key: "slate",  bg: "bg-slate-50 dark:bg-slate-800",   border: "border-slate-200 dark:border-slate-700",   dot: "bg-slate-400"  },
  { key: "blue",   bg: "bg-blue-50 dark:bg-blue-900/20",  border: "border-blue-200 dark:border-blue-800",     dot: "bg-blue-500"   },
  { key: "yellow", bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-200 dark:border-yellow-800", dot: "bg-yellow-400" },
  { key: "green",  bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800",  dot: "bg-green-500"  },
  { key: "red",    bg: "bg-red-50 dark:bg-red-900/20",    border: "border-red-200 dark:border-red-800",       dot: "bg-red-500"    },
  { key: "purple", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", dot: "bg-purple-500" },
  { key: "orange", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", dot: "bg-orange-400" },
];
function noteColor(key: string) { return NOTE_COLORS.find(c => c.key === key) || NOTE_COLORS[0]; }

const PRIORITY_CFG: Record<string, { label: string; color: string; icon: string }> = {
  LOW:    { label: "E ulët",   color: "text-slate-500 bg-slate-100 dark:bg-slate-700",      icon: "⬇" },
  MEDIUM: { label: "Mesatare", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",       icon: "➡" },
  HIGH:   { label: "E lartë",  color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30", icon: "⬆" },
  URGENT: { label: "Urgjente", color: "text-red-600 bg-red-50 dark:bg-red-900/30",          icon: "🔥" },
};
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  TODO:        { label: "Për bërë",    color: "text-slate-600 bg-slate-100 dark:bg-slate-700"   },
  IN_PROGRESS: { label: "Në progres",  color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30"   },
  DONE:        { label: "Përfunduar",  color: "text-green-700 bg-green-50 dark:bg-green-900/30" },
  CANCELLED:   { label: "Anuluar",     color: "text-red-600 bg-red-50 dark:bg-red-900/30"       },
};
const EVENT_COLORS: Record<string, string> = {
  blue: "bg-blue-500", green: "bg-green-500", red: "bg-red-500",
  yellow: "bg-yellow-400", purple: "bg-purple-500", orange: "bg-orange-400",
};
const EVENT_TYPE_CFG: Record<string, { label: string; color: string }> = {
  EXAM:     { label: "Provim",      color: "text-red-600 bg-red-50 dark:bg-red-900/30"        },
  MEETING:  { label: "Takim",       color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30"     },
  ACTIVITY: { label: "Aktivitet",   color: "text-green-700 bg-green-50 dark:bg-green-900/30"  },
  HOLIDAY:  { label: "Pushim",      color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30"},
  GENERAL:  { label: "Të tjera",    color: "text-slate-600 bg-slate-100 dark:bg-slate-700"    },
};
const REMINDER_TYPE_CFG: Record<string, { label: string; icon: React.ReactNode }> = {
  PAYMENT:  { label: "Pagesë",     icon: <CreditCard className="w-3.5 h-3.5" /> },
  MEETING:  { label: "Takim",      icon: <Users className="w-3.5 h-3.5" />      },
  DOCUMENT: { label: "Dokument",   icon: <FileText className="w-3.5 h-3.5" />   },
  GENERAL:  { label: "Të tjera",   icon: <Bell className="w-3.5 h-3.5" />       },
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("sq-AL", { day: "2-digit", month: "short", year: "numeric" });
}
function isOverdue(d: string | null | undefined) {
  if (!d) return false;
  return new Date(d) < new Date();
}
function isToday(d: string) {
  const t = new Date(d);
  const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
}

/* ─── Mini Modal ─────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ─── TABS ───────────────────────────────────────────────── */
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview",   label: "Pasqyra",    icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "notes",      label: "Shënime",    icon: <StickyNote className="w-4 h-4" />     },
  { key: "tasks",      label: "Detyrat",    icon: <CheckSquare className="w-4 h-4" />    },
  { key: "calendar",   label: "Kalendari",  icon: <Calendar className="w-4 h-4" />       },
  { key: "reminders",  label: "Kujtesët",   icon: <Bell className="w-4 h-4" />           },
];

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function FletorjaPage() {
  const [tab, setTab] = useState<Tab>("overview");

  /* Stats / overview */
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* Notes */
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteColorFilter, setNoteColorFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newNote, setNewNote] = useState<{ title: string; content: string; color: string; tags: string } | null>(null);
  const [editNote, setEditNote] = useState<AdminNote | null>(null);

  /* Tasks */
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [taskStatus, setTaskStatus] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<AdminTask | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "MEDIUM", dueDate: "", assignedTo: "", status: "TODO" });

  /* Calendar */
  const [calDate, setCalDate] = useState(new Date());
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editEvent, setEditEvent] = useState<AdminEvent | null>(null);
  const [eventForm, setEventForm] = useState({ title: "", description: "", date: "", type: "GENERAL", color: "blue", allDay: true });

  /* Reminders */
  const [reminders, setReminders] = useState<AdminReminder[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderForm, setReminderForm] = useState({ title: "", type: "GENERAL", dueDate: "", description: "" });

  /* Student search */
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<Array<{ id: number; firstName: string; lastName: string; parentPhone: string; class: { name: string } | null }>>([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  /* ── Fetchers ── */
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const r = await fetch("/api/fletorja/stats");
    const d = await r.json();
    setStats(d);
    setStatsLoading(false);
  }, []);

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("archived", showArchived ? "true" : "false");
    if (noteSearch) params.set("search", noteSearch);
    if (noteColorFilter) params.set("color", noteColorFilter);
    const r = await fetch(`/api/fletorja/notes?${params}`);
    setNotes(await r.json());
  }, [showArchived, noteSearch, noteColorFilter]);

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (taskStatus) params.set("status", taskStatus);
    const r = await fetch(`/api/fletorja/tasks?${params}`);
    setTasks(await r.json());
  }, [taskStatus]);

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams({
      year: String(calDate.getFullYear()),
      month: String(calDate.getMonth()),
    });
    const r = await fetch(`/api/fletorja/events?${params}`);
    setEvents(await r.json());
  }, [calDate]);

  const fetchReminders = useCallback(async () => {
    const r = await fetch("/api/fletorja/reminders");
    setReminders(await r.json());
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (tab === "notes") fetchNotes(); }, [tab, fetchNotes]);
  useEffect(() => { if (tab === "tasks") fetchTasks(); }, [tab, fetchTasks]);
  useEffect(() => { if (tab === "calendar") fetchEvents(); }, [tab, calDate, fetchEvents]);
  useEffect(() => { if (tab === "reminders") fetchReminders(); }, [tab, fetchReminders]);

  /* Student search */
  useEffect(() => {
    if (!studentSearch.trim()) { setStudentResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}&limit=5`);
      const d = await r.json();
      setStudentResults(d.students || d || []);
      setShowStudentDropdown(true);
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  /* ── Note Actions ── */
  async function saveNote() {
    if (!newNote || !newNote.content.trim()) return;
    await fetch("/api/fletorja/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newNote),
    });
    setNewNote(null);
    fetchNotes();
  }

  async function updateNote(id: number, data: Partial<AdminNote>) {
    await fetch(`/api/fletorja/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchNotes();
    if (tab === "overview") fetchStats();
  }

  async function deleteNote(id: number) {
    await fetch(`/api/fletorja/notes/${id}`, { method: "DELETE" });
    fetchNotes();
  }

  /* ── Task Actions ── */
  function openTaskModal(task?: AdminTask) {
    if (task) {
      setEditTask(task);
      setTaskForm({ title: task.title, description: task.description || "", priority: task.priority, dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "", assignedTo: task.assignedTo || "", status: task.status });
    } else {
      setEditTask(null);
      setTaskForm({ title: "", description: "", priority: "MEDIUM", dueDate: "", assignedTo: "", status: "TODO" });
    }
    setShowTaskModal(true);
  }

  async function saveTask() {
    const method = editTask ? "PUT" : "POST";
    const url    = editTask ? `/api/fletorja/tasks/${editTask.id}` : "/api/fletorja/tasks";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskForm) });
    setShowTaskModal(false);
    fetchTasks();
    fetchStats();
  }

  async function deleteTask(id: number) {
    await fetch(`/api/fletorja/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
    fetchStats();
  }

  async function toggleTaskDone(task: AdminTask) {
    const status = task.status === "DONE" ? "TODO" : "DONE";
    await fetch(`/api/fletorja/tasks/${task.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    fetchTasks();
    fetchStats();
  }

  /* ── Event Actions ── */
  function openEventModal(ev?: AdminEvent, day?: number) {
    if (ev) {
      setEditEvent(ev);
      setEventForm({ title: ev.title, description: ev.description || "", date: ev.date.slice(0, 10), type: ev.type, color: ev.color, allDay: ev.allDay });
    } else {
      setEditEvent(null);
      const d = day ? new Date(calDate.getFullYear(), calDate.getMonth(), day) : new Date();
      setEventForm({ title: "", description: "", date: d.toISOString().slice(0, 10), type: "GENERAL", color: "blue", allDay: true });
    }
    setShowEventModal(true);
  }

  async function saveEvent() {
    const method = editEvent ? "PUT" : "POST";
    const url    = editEvent ? `/api/fletorja/events/${editEvent.id}` : "/api/fletorja/events";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventForm) });
    setShowEventModal(false);
    fetchEvents();
    fetchStats();
  }

  async function deleteEvent(id: number) {
    await fetch(`/api/fletorja/events/${id}`, { method: "DELETE" });
    fetchEvents();
    fetchStats();
  }

  /* ── Reminder Actions ── */
  async function saveReminder() {
    await fetch("/api/fletorja/reminders", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reminderForm),
    });
    setShowReminderModal(false);
    setReminderForm({ title: "", type: "GENERAL", dueDate: "", description: "" });
    fetchReminders();
    fetchStats();
  }

  async function toggleReminder(r: AdminReminder) {
    await fetch(`/api/fletorja/reminders/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !r.done }),
    });
    fetchReminders();
    fetchStats();
  }

  async function deleteReminder(id: number) {
    await fetch(`/api/fletorja/reminders/${id}`, { method: "DELETE" });
    fetchReminders();
    fetchStats();
  }

  /* ─── Calendar helpers ─── */
  const calYear  = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const MONTH_NAMES = ["Janar","Shkurt","Mars","Prill","Maj","Qershor","Korrik","Gusht","Shtator","Tetor","Nëntor","Dhjetor"];
  const DOW_LABELS  = ["Hën","Mar","Mër","Enj","Pre","Sht","Die"];

  function eventsForDay(day: number) {
    const d = new Date(calYear, calMonth, day);
    return events.filter(e => {
      const ed = new Date(e.date);
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth() && ed.getDate() === d.getDate();
    });
  }

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <>
      <Header title="Fletorja Digjitale" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ════════════════ OVERVIEW ════════════════ */}
        {tab === "overview" && (
          <div className="space-y-5">
            {statsLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400">
                <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full mr-3" />
                Duke ngarkuar...
              </div>
            ) : stats && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { label: "Detyrat aktive", value: stats.stats.activeTasks, icon: <CheckSquare className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Kujtesa sot", value: stats.stats.todayReminders, icon: <Bell className="w-5 h-5 text-yellow-500" />, bg: "bg-yellow-50 dark:bg-yellow-900/20",
                      sub: stats.stats.overdueReminders > 0 ? `${stats.stats.overdueReminders} vonuara` : undefined },
                    { label: "Borxhet totale", value: formatCurrency(stats.stats.totalDebt), icon: <AlertCircle className="w-5 h-5 text-red-500" />, bg: "bg-red-50 dark:bg-red-900/20" },
                    { label: "Nxënës aktivë", value: stats.stats.activeStudents, icon: <Users className="w-5 h-5 text-green-500" />, bg: "bg-green-50 dark:bg-green-900/20" },
                  ].map((s, i) => (
                    <div key={i} className="card p-4">
                      <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>{s.icon}</div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                      {s.sub && <p className="text-xs text-red-500 mt-1">{s.sub}</p>}
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Veprime të shpejta</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Detyrë e re", icon: <CheckSquare className="w-3.5 h-3.5" />, action: () => { setTab("tasks"); setTimeout(() => openTaskModal(), 100); } },
                      { label: "Shënim i ri", icon: <StickyNote className="w-3.5 h-3.5" />, action: () => { setTab("notes"); setNewNote({ title: "", content: "", color: "slate", tags: "" }); } },
                      { label: "Event i ri", icon: <Calendar className="w-3.5 h-3.5" />, action: () => { setTab("calendar"); setTimeout(() => openEventModal(), 100); } },
                      { label: "Kujtesë e re", icon: <Bell className="w-3.5 h-3.5" />, action: () => { setTab("reminders"); setShowReminderModal(true); } },
                    ].map((a, i) => (
                      <button key={i} onClick={a.action}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors">
                        {a.icon}{a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Student search */}
                <div className="card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Kërkim i shpejtë — Nxënësi</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input className="form-input pl-9" placeholder="Kërko nxënës..." value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      onFocus={() => studentResults.length > 0 && setShowStudentDropdown(true)}
                      onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)} />
                    {showStudentDropdown && studentResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-30 overflow-hidden">
                        {studentResults.map(s => (
                          <a key={s.id} href={`/students/${s.id}`}
                            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <div>
                              <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{s.firstName} {s.lastName}</p>
                              <p className="text-xs text-slate-400">{s.class?.name || "Pa klasë"} · {s.parentPhone}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  {/* Recent payments */}
                  <div className="card xl:col-span-2">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Pagesat e fundit</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {stats.recentPayments.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Nuk ka pagesa</p>}
                      {stats.recentPayments.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{p.student.firstName} {p.student.lastName}</p>
                            <p className="text-xs text-slate-400">{p.category.name} · {p.paidDate ? fmtDate(p.paidDate) : "—"}</p>
                          </div>
                          <span className="font-bold text-green-600 dark:text-green-400 text-sm">{formatCurrency(p.paidAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    {/* Students with debt */}
                    <div className="card">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Borxhet aktive</h3>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {stats.studentsWithDebt.length === 0 && <p className="text-center text-slate-400 text-sm py-6">Asnjë borxh</p>}
                        {stats.studentsWithDebt.slice(0, 4).map(s => (
                          <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                            <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.firstName} {s.lastName}</p>
                              <p className="text-xs text-slate-400">{s.class?.name || "—"}</p>
                            </div>
                            <span className="text-sm font-bold text-red-500">{formatCurrency(s.totalDebt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Upcoming events */}
                    <div className="card">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Eventet e ardhshme</h3>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {stats.upcomingEvents.length === 0 && <p className="text-center text-slate-400 text-sm py-6">Asnjë event</p>}
                        {stats.upcomingEvents.map(e => (
                          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_COLORS[e.color] || "bg-slate-400"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{e.title}</p>
                              <p className="text-xs text-slate-400">{fmtDate(e.date)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upcoming tasks */}
                {stats.upcomingTasks.length > 0 && (
                  <div className="card">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Detyrat e ardhshme (7 ditë)</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {stats.upcomingTasks.map(t => {
                        const pr = PRIORITY_CFG[t.priority] || PRIORITY_CFG.MEDIUM;
                        return (
                          <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                            <span className={`badge ${pr.color} text-xs`}>{pr.icon} {pr.label}</span>
                            <span className="flex-1 text-sm text-slate-800 dark:text-slate-100">{t.title}</span>
                            {t.dueDate && <span className="text-xs text-slate-400">{fmtDate(t.dueDate)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Activity log */}
                <div className="card">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Aktiviteti i fundit</h3>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {stats.auditLogs.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Nuk ka aktivitet</p>}
                    {stats.auditLogs.map(l => (
                      <div key={l.id} className="flex items-start gap-3 px-5 py-3">
                        <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-500">
                          {l.user.name[0]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            <span className="font-medium">{l.user.name}</span>
                            {" "}<span className="text-slate-400">{l.action}</span>
                            {" "}<span className="font-medium">{l.entity}</span>
                            {l.details && <span className="text-slate-400"> — {l.details}</span>}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{fmtDate(l.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════ NOTES ════════════════ */}
        {tab === "notes" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="form-input pl-9" placeholder="Kërko shënim..." value={noteSearch}
                  onChange={e => { setNoteSearch(e.target.value); setTimeout(fetchNotes, 300); }} />
              </div>
              <div className="flex gap-1">
                {NOTE_COLORS.map(c => (
                  <button key={c.key} onClick={() => { setNoteColorFilter(noteColorFilter === c.key ? "" : c.key); setTimeout(fetchNotes, 0); }}
                    className={`w-6 h-6 rounded-full ${c.dot} border-2 transition-all ${noteColorFilter === c.key ? "border-slate-800 dark:border-white scale-110" : "border-transparent"}`} />
                ))}
              </div>
              <button onClick={() => setShowArchived(!showArchived)}
                className={`btn-ghost text-xs ${showArchived ? "border-primary-400 text-primary-600" : ""}`}>
                <Archive className="w-3.5 h-3.5" /> {showArchived ? "Aktive" : "Arkiva"}
              </button>
              <button onClick={() => setNewNote({ title: "", content: "", color: "slate", tags: "" })} className="btn-primary">
                <Plus className="w-4 h-4" /> Shënim i ri
              </button>
            </div>

            {/* New note inline */}
            {newNote && (
              <div className={`border-2 border-primary-300 rounded-xl p-4 space-y-3 ${noteColor(newNote.color).bg}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <input className="form-input flex-1 min-w-48 text-sm font-medium" placeholder="Titulli (opsional)"
                    value={newNote.title} onChange={e => setNewNote({ ...newNote, title: e.target.value })} />
                  <div className="flex gap-1">
                    {NOTE_COLORS.map(c => (
                      <button key={c.key} onClick={() => setNewNote({ ...newNote, color: c.key })}
                        className={`w-5 h-5 rounded-full ${c.dot} border-2 ${newNote.color === c.key ? "border-slate-700 dark:border-white" : "border-transparent"}`} />
                    ))}
                  </div>
                </div>
                <textarea className="form-input text-sm resize-none" rows={4} placeholder="Shkruaj shënimet këtu..."
                  value={newNote.content} onChange={e => setNewNote({ ...newNote, content: e.target.value })} />
                <input className="form-input text-sm" placeholder="Tags (p.sh. financë, takim, urgjet)"
                  value={newNote.tags} onChange={e => setNewNote({ ...newNote, tags: e.target.value })} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setNewNote(null)} className="btn-secondary text-xs">Anulo</button>
                  <button onClick={saveNote} className="btn-primary text-xs">Ruaj shënimet</button>
                </div>
              </div>
            )}

            {/* Notes grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {notes.map(n => {
                const nc = noteColor(n.color);
                const isEditing = editNote?.id === n.id;
                return (
                  <div key={n.id} className={`border rounded-xl p-4 flex flex-col gap-2 transition-all hover:shadow-md ${nc.bg} ${nc.border} ${n.pinned ? "ring-2 ring-primary-300 dark:ring-primary-700" : ""}`}>
                    {isEditing ? (
                      <>
                        <input className="form-input text-sm font-medium" value={editNote.title || ""} onChange={e => setEditNote({ ...editNote, title: e.target.value })} placeholder="Titulli" />
                        <textarea className="form-input text-sm resize-none" rows={5} value={editNote.content} onChange={e => setEditNote({ ...editNote, content: e.target.value })} />
                        <input className="form-input text-sm" value={editNote.tags || ""} onChange={e => setEditNote({ ...editNote, tags: e.target.value })} placeholder="Tags" />
                        <div className="flex gap-1">
                          {NOTE_COLORS.map(c => (
                            <button key={c.key} onClick={() => setEditNote({ ...editNote, color: c.key })}
                              className={`w-5 h-5 rounded-full ${c.dot} border-2 ${editNote.color === c.key ? "border-slate-700 dark:border-white" : "border-transparent"}`} />
                          ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditNote(null)} className="btn-secondary text-xs">Anulo</button>
                          <button onClick={() => { updateNote(editNote.id, { title: editNote.title, content: editNote.content, tags: editNote.tags, color: editNote.color }); setEditNote(null); }} className="btn-primary text-xs">Ruaj</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {n.pinned && <Pin className="w-3 h-3 text-primary-500 mb-1 inline-block rotate-45" />}
                            {n.title && <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{n.title}</p>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
                            <button onClick={() => setEditNote(n)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/60 dark:hover:bg-slate-700 transition-colors"><Edit2 className="w-3 h-3 text-slate-500" /></button>
                            <button onClick={() => updateNote(n.id, { pinned: !n.pinned })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/60 dark:hover:bg-slate-700 transition-colors"><Pin className={`w-3 h-3 ${n.pinned ? "text-primary-500" : "text-slate-400"}`} /></button>
                            <button onClick={() => updateNote(n.id, { archived: !n.archived })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/60 dark:hover:bg-slate-700 transition-colors"><Archive className="w-3 h-3 text-slate-400" /></button>
                            <button onClick={() => deleteNote(n.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 className="w-3 h-3 text-red-400" /></button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-6">{n.content}</p>
                        {n.tags && (
                          <div className="flex flex-wrap gap-1 mt-auto">
                            {n.tags.split(",").map(t => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-slate-600">{t.trim()}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-slate-400">{fmtDate(n.updatedAt)}</p>
                          <div className="flex gap-1">
                            <button onClick={() => setEditNote(n)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/60 dark:hover:bg-slate-700"><Edit2 className="w-3 h-3 text-slate-400" /></button>
                            <button onClick={() => updateNote(n.id, { pinned: !n.pinned })} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/60 dark:hover:bg-slate-700"><Pin className={`w-3 h-3 ${n.pinned ? "text-primary-500" : "text-slate-400"}`} /></button>
                            <button onClick={() => updateNote(n.id, { archived: !n.archived })} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/60 dark:hover:bg-slate-700"><Archive className="w-3 h-3 text-slate-400" /></button>
                            <button onClick={() => deleteNote(n.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="w-3 h-3 text-red-400" /></button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {notes.length === 0 && !newNote && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <StickyNote className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm">Nuk ka shënime. Kliko &ldquo;Shënim i ri&rdquo; për të filluar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ TASKS ════════════════ */}
        {tab === "tasks" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                {[["", "Të gjitha"], ["TODO", "Për bërë"], ["IN_PROGRESS", "Në progres"], ["DONE", "Përfunduara"]].map(([v, l]) => (
                  <button key={v} onClick={() => { setTaskStatus(v); setTimeout(fetchTasks, 0); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${taskStatus === v ? "bg-primary-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={() => openTaskModal()} className="btn-primary ml-auto">
                <Plus className="w-4 h-4" /> Detyrë e re
              </button>
            </div>

            <div className="card divide-y divide-slate-100 dark:divide-slate-700/50">
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <CheckSquare className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm">Nuk ka detyra. Shto një detyrë të re.</p>
                </div>
              )}
              {tasks.map(t => {
                const pr = PRIORITY_CFG[t.priority] || PRIORITY_CFG.MEDIUM;
                const st = STATUS_CFG[t.status] || STATUS_CFG.TODO;
                const over = isOverdue(t.dueDate) && t.status !== "DONE";
                return (
                  <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${t.status === "DONE" ? "opacity-60" : ""}`}>
                    <button onClick={() => toggleTaskDone(t)} className="flex-shrink-0">
                      {t.status === "DONE"
                        ? <CheckCircle className="w-5 h-5 text-green-500" />
                        : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-primary-500 transition-colors" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm text-slate-800 dark:text-slate-100 ${t.status === "DONE" ? "line-through text-slate-400" : ""}`}>{t.title}</p>
                      {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                    </div>
                    <span className={`badge text-xs ${pr.color} hidden sm:inline-flex`}>{pr.icon} {pr.label}</span>
                    <span className={`badge text-xs ${st.color} hidden sm:inline-flex`}>{st.label}</span>
                    {t.assignedTo && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 hidden md:flex">
                        <User className="w-3 h-3" />{t.assignedTo}
                      </span>
                    )}
                    {t.dueDate && (
                      <span className={`flex items-center gap-1 text-xs ${over ? "text-red-500 font-medium" : "text-slate-400"}`}>
                        <Clock className="w-3 h-3" />{fmtDate(t.dueDate)}
                      </span>
                    )}
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openTaskModal(t)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><Edit2 className="w-3.5 h-3.5 text-slate-400" /></button>
                      <button onClick={() => deleteTask(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════ CALENDAR ════════════════ */}
        {tab === "calendar" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 card p-5">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="font-bold text-slate-900 dark:text-white">{MONTH_NAMES[calMonth]} {calYear}</h3>
                <button onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {/* Day labels */}
              <div className="grid grid-cols-7 mb-2">
                {DOW_LABELS.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1">{d}</div>
                ))}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dayEvs = eventsForDay(day);
                  const today = isToday(new Date(calYear, calMonth, day).toISOString());
                  const selected = selectedDay === day;
                  return (
                    <button key={day} onClick={() => setSelectedDay(selected ? null : day)}
                      className={`aspect-square flex flex-col items-center justify-start pt-1.5 px-1 rounded-xl text-sm font-medium transition-all hover:bg-primary-50 dark:hover:bg-primary-900/20 ${
                        today ? "bg-primary-600 text-white hover:bg-primary-700" :
                        selected ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-300" :
                        "text-slate-700 dark:text-slate-300"
                      }`}>
                      {day}
                      {dayEvs.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                          {dayEvs.slice(0, 3).map(e => (
                            <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[e.color] || "bg-slate-400"}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Events sidebar */}
            <div className="card flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  {selectedDay ? `${selectedDay} ${MONTH_NAMES[calMonth]}` : "Të gjitha eventet"}
                </h3>
                <button onClick={() => openEventModal(undefined, selectedDay || undefined)} className="btn-primary text-xs px-3 py-1.5">
                  <Plus className="w-3.5 h-3.5" /> Event
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                {(selectedDay ? eventsForDay(selectedDay) : events).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <Calendar className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-sm">Asnjë event</p>
                  </div>
                )}
                {(selectedDay ? eventsForDay(selectedDay) : events).map(e => {
                  const tc = EVENT_TYPE_CFG[e.type] || EVENT_TYPE_CFG.GENERAL;
                  return (
                    <div key={e.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${EVENT_COLORS[e.color] || "bg-slate-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{e.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(e.date)}</p>
                        {e.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.description}</p>}
                        <span className={`badge text-[10px] mt-1 ${tc.color}`}>{tc.label}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEventModal(e)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Edit2 className="w-3 h-3 text-slate-400" /></button>
                        <button onClick={() => deleteEvent(e.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="w-3 h-3 text-red-400" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ REMINDERS ════════════════ */}
        {tab === "reminders" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setReminderForm({ title: "", type: "GENERAL", dueDate: "", description: "" }); setShowReminderModal(true); }} className="btn-primary">
                <Plus className="w-4 h-4" /> Kujtesë e re
              </button>
            </div>

            {["overdue", "today", "upcoming", "done"].map(group => {
              const grouped = reminders.filter(r => {
                if (group === "overdue")  return !r.done && isOverdue(r.dueDate) && !isToday(r.dueDate);
                if (group === "today")    return !r.done && isToday(r.dueDate);
                if (group === "upcoming") return !r.done && !isOverdue(r.dueDate) && !isToday(r.dueDate);
                return r.done;
              });
              if (grouped.length === 0) return null;

              const groupLabels: Record<string, { label: string; color: string }> = {
                overdue:  { label: "Vonuara", color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
                today:    { label: "Sot", color: "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20" },
                upcoming: { label: "Të ardhshme", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
                done:     { label: "Përfunduara", color: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
              };
              const gl = groupLabels[group];

              return (
                <div key={group}>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${gl.color} mb-2`}>
                    <span className="text-xs font-bold uppercase tracking-wider">{gl.label}</span>
                    <span className="text-xs font-bold opacity-70">({grouped.length})</span>
                  </div>
                  <div className="card divide-y divide-slate-100 dark:divide-slate-700/50">
                    {grouped.map(r => {
                      const tc = REMINDER_TYPE_CFG[r.type] || REMINDER_TYPE_CFG.GENERAL;
                      return (
                        <div key={r.id} className={`flex items-center gap-3 px-5 py-3.5 ${r.done ? "opacity-50" : ""}`}>
                          <button onClick={() => toggleReminder(r)} className="flex-shrink-0">
                            {r.done
                              ? <CheckCircle className="w-5 h-5 text-green-500" />
                              : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-green-500 transition-colors" />
                            }
                          </button>
                          <span className="flex-shrink-0 text-slate-400">{tc.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm text-slate-800 dark:text-slate-100 ${r.done ? "line-through" : ""}`}>{r.title}</p>
                            {r.description && <p className="text-xs text-slate-400 truncate">{r.description}</p>}
                          </div>
                          <span className={`badge text-xs ${isOverdue(r.dueDate) && !r.done ? "bg-red-50 text-red-600 dark:bg-red-900/30" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
                            {fmtDate(r.dueDate)}
                          </span>
                          <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-500 text-[10px]">{tc.label}</span>
                          <button onClick={() => deleteReminder(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {reminders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Bell className="w-10 h-10 opacity-20 mb-3" />
                <p className="text-sm">Nuk ka kujtesa. Shto një kujtesë të re.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════ MODALS ════════ */}

      {/* Task modal */}
      {showTaskModal && (
        <Modal title={editTask ? "Ndrysho detyrën" : "Detyrë e re"} onClose={() => setShowTaskModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">Titulli <span className="text-red-500">*</span></label>
              <input className="form-input" placeholder="Titulli i detyrës" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Përshkrimi</label>
              <textarea className="form-input resize-none" rows={3} placeholder="Detaje shtesë..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Prioriteti</label>
                <select className="form-input" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                  <option value="LOW">E ulët</option>
                  <option value="MEDIUM">Mesatare</option>
                  <option value="HIGH">E lartë</option>
                  <option value="URGENT">Urgjente</option>
                </select>
              </div>
              <div>
                <label className="form-label">Statusi</label>
                <select className="form-input" value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
                  <option value="TODO">Për bërë</option>
                  <option value="IN_PROGRESS">Në progres</option>
                  <option value="DONE">Përfunduar</option>
                  <option value="CANCELLED">Anuluar</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Data e afatit</label>
                <input type="date" className="form-input" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Caktuar për</label>
                <input className="form-input" placeholder="Emri i personit" value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowTaskModal(false)} className="btn-secondary flex-1 justify-center">Anulo</button>
              <button onClick={saveTask} className="btn-primary flex-1 justify-center">Ruaj detyrën</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Event modal */}
      {showEventModal && (
        <Modal title={editEvent ? "Ndrysho eventin" : "Event i ri"} onClose={() => setShowEventModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">Titulli <span className="text-red-500">*</span></label>
              <input className="form-input" placeholder="Emri i eventit" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Përshkrimi</label>
              <textarea className="form-input resize-none" rows={2} value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Data</label>
                <input type="date" className="form-input" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Lloji</label>
                <select className="form-input" value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })}>
                  <option value="GENERAL">Të tjera</option>
                  <option value="EXAM">Provim</option>
                  <option value="MEETING">Takim</option>
                  <option value="ACTIVITY">Aktivitet</option>
                  <option value="HOLIDAY">Pushim</option>
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Ngjyra</label>
              <div className="flex gap-2 mt-1">
                {["blue","green","red","yellow","purple","orange"].map(c => (
                  <button key={c} onClick={() => setEventForm({ ...eventForm, color: c })}
                    className={`w-7 h-7 rounded-full ${EVENT_COLORS[c]} border-2 ${eventForm.color === c ? "border-slate-700 dark:border-white scale-110" : "border-transparent"} transition-all`} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEventModal(false)} className="btn-secondary flex-1 justify-center">Anulo</button>
              <button onClick={saveEvent} className="btn-primary flex-1 justify-center">Ruaj eventin</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reminder modal */}
      {showReminderModal && (
        <Modal title="Kujtesë e re" onClose={() => setShowReminderModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">Titulli <span className="text-red-500">*</span></label>
              <input className="form-input" placeholder="Titulli i kujtesës" value={reminderForm.title} onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Lloji</label>
                <select className="form-input" value={reminderForm.type} onChange={e => setReminderForm({ ...reminderForm, type: e.target.value })}>
                  <option value="GENERAL">Të tjera</option>
                  <option value="PAYMENT">Pagesë</option>
                  <option value="MEETING">Takim</option>
                  <option value="DOCUMENT">Dokument</option>
                </select>
              </div>
              <div>
                <label className="form-label">Data</label>
                <input type="date" className="form-input" value={reminderForm.dueDate} onChange={e => setReminderForm({ ...reminderForm, dueDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="form-label">Shënim</label>
              <textarea className="form-input resize-none" rows={2} placeholder="Detaje opsionale..." value={reminderForm.description} onChange={e => setReminderForm({ ...reminderForm, description: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowReminderModal(false)} className="btn-secondary flex-1 justify-center">Anulo</button>
              <button onClick={saveReminder} className="btn-primary flex-1 justify-center">Ruaj kujtesën</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
