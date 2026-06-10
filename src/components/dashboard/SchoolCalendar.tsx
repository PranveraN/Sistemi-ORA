"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Bell } from "lucide-react";

interface CalEvent {
  date: string; // YYYY-MM-DD
  label: string;
  type: "holiday" | "school" | "reminder";
}

const FIXED_HOLIDAYS: CalEvent[] = [
  // Festat Shtetërore
  { date: "2025-01-01", label: "Viti i Ri", type: "holiday" },
  { date: "2026-01-01", label: "Viti i Ri", type: "holiday" },
  { date: "2025-01-07", label: "Krishtlindja Ortodokse", type: "holiday" },
  { date: "2026-01-07", label: "Krishtlindja Ortodokse", type: "holiday" },
  { date: "2025-02-17", label: "Dita e Pavarësisë", type: "holiday" },
  { date: "2026-02-17", label: "Dita e Pavarësisë", type: "holiday" },
  { date: "2025-04-18", label: "Premtja e Madhe (Katolike)", type: "holiday" },
  { date: "2025-04-20", label: "Pashkët Katolike", type: "holiday" },
  { date: "2025-04-27", label: "Pashkët Ortodokse", type: "holiday" },
  { date: "2026-04-03", label: "Premtja e Madhe (Katolike)", type: "holiday" },
  { date: "2026-04-05", label: "Pashkët Katolike", type: "holiday" },
  { date: "2025-05-01", label: "Dita e Punës", type: "holiday" },
  { date: "2026-05-01", label: "Dita e Punës", type: "holiday" },
  { date: "2025-06-27", label: "Bajrami i Vogël (Fitër)", type: "holiday" },
  { date: "2025-09-05", label: "Bajrami i Madh (Kurban)", type: "holiday" },
  { date: "2025-11-28", label: "Dita e Flamurit", type: "holiday" },
  { date: "2026-11-28", label: "Dita e Flamurit", type: "holiday" },
  { date: "2025-12-25", label: "Krishtlindja Katolike", type: "holiday" },
  { date: "2026-12-25", label: "Krishtlindja Katolike", type: "holiday" },
  // Kalendari Shkollor Zyrtar (MAShT - UA Nr. 01/2025)
  { date: "2025-09-01", label: "Fillimi i Vitit Shkollor 2025/26", type: "school" },
  { date: "2025-12-26", label: "Pushimet Dimërore Fillojnë", type: "school" },
  { date: "2026-01-07", label: "Rifillimi pas Pushimeve Dimërore", type: "school" },
  { date: "2026-04-07", label: "Pushimet e Pranverës Fillojnë", type: "school" },
  { date: "2026-04-13", label: "Rifillimi pas Pranverës", type: "school" },
  { date: "2026-05-14", label: "Fundi Maturantët (kl. 12)", type: "school" },
  { date: "2026-06-05", label: "Fundi Klasa 9 & 10", type: "school" },
  { date: "2026-06-22", label: "Fundi i Vitit Shkollor (kl. 1–8, 11)", type: "school" },
];

const TYPE_COLORS = {
  holiday:  { dot: "bg-red-500",   text: "text-red-700 dark:text-red-300",   bg: "bg-red-50 dark:bg-red-900/20",   border: "border-red-200 dark:border-red-800",   badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
  school:   { dot: "bg-blue-500",  text: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  reminder: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300",bg: "bg-amber-50 dark:bg-amber-900/20",border: "border-amber-200 dark:border-amber-800",badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
};

const TYPE_ICONS = { holiday: "🎉", school: "📚", reminder: "🔔" };

const MONTHS_SQ = ["Janar","Shkurt","Mars","Prill","Maj","Qershor","Korrik","Gusht","Shtator","Tetor","Nëntor","Dhjetor"];
const DAYS_SQ   = ["Hë","Ma","Më","En","Pr","Sh","Di"];

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00"); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function daysUntilLabel(days: number): string {
  if (days === 0)  return "Sot";
  if (days === 1)  return "Nesër";
  if (days < 0)   return `${Math.abs(days)} ditë më parë`;
  if (days < 7)   return `${days} ditë`;
  if (days < 30)  return `${Math.round(days / 7)} javë`;
  if (days < 365) return `${Math.round(days / 30)} muaj`;
  return `${Math.round(days / 365)} vit`;
}

export default function SchoolCalendar() {
  const now = new Date();
  const [cur, setCur] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [reminders, setReminders] = useState<CalEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addLabel, setAddLabel] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("school_reminders");
      if (saved) setReminders(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  function saveReminders(r: CalEvent[]) {
    setReminders(r);
    localStorage.setItem("school_reminders", JSON.stringify(r));
  }

  function addReminder() {
    if (!addDate || !addLabel.trim()) return;
    saveReminders([...reminders, { date: addDate, label: addLabel.trim(), type: "reminder" }]);
    setAddDate(""); setAddLabel(""); setShowAdd(false);
  }

  function removeReminder(date: string, label: string) {
    saveReminders(reminders.filter(r => !(r.date === date && r.label === label)));
  }

  const allEvents = [...FIXED_HOLIDAYS, ...reminders];
  const eventMap  = new Map<string, CalEvent[]>();
  for (const ev of allEvents) {
    if (!eventMap.has(ev.date)) eventMap.set(ev.date, []);
    eventMap.get(ev.date)!.push(ev);
  }

  const year  = cur.getFullYear();
  const month = cur.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const todayStr    = now.toISOString().split("T")[0];

  // Eventet e 60 ditëve të ardhshme
  const upcoming: (CalEvent & { diff: number })[] = [];
  for (let i = 0; i <= 60; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    const key = d.toISOString().split("T")[0];
    (eventMap.get(key) ?? []).forEach(ev => upcoming.push({ ...ev, diff: i }));
  }

  const selectedEvents = selected ? (eventMap.get(selected) ?? []) : [];

  return (
    <div className="card p-5 flex flex-col gap-4 h-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-base">
          📅 Kalendari Shkollor
        </h2>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-2.5 py-1.5 rounded-lg transition-colors border border-primary-200 dark:border-primary-800">
          <Plus className="w-3.5 h-3.5" /> Reminder
        </button>
      </div>

      {/* Nav muajor */}
      <div className="flex items-center justify-between">
        <button onClick={() => { setCur(new Date(year, month - 1, 1)); setSelected(null); }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold text-slate-800 dark:text-white">{MONTHS_SQ[month]} {year}</span>
        </div>
        <button onClick={() => { setCur(new Date(year, month + 1, 1)); setSelected(null); }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid ditëve */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS_SQ.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 pb-1 uppercase tracking-wide">{d}</div>
        ))}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day     = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const evs     = eventMap.get(dateStr) ?? [];
          const isToday     = dateStr === todayStr;
          const isSelected  = dateStr === selected;
          const hasHoliday  = evs.some(e => e.type === "holiday");
          const hasSchool   = evs.some(e => e.type === "school");
          const hasReminder = evs.some(e => e.type === "reminder");
          const hasAny = evs.length > 0;

          return (
            <button key={day} onClick={() => setSelected(isSelected ? null : (hasAny ? dateStr : null))}
              className={`relative flex flex-col items-center py-1 px-0.5 rounded-lg transition-all ${
                isToday
                  ? "bg-primary-600 text-white font-bold shadow-sm"
                  : isSelected
                  ? "bg-primary-100 dark:bg-primary-900/40 ring-2 ring-primary-400"
                  : hasHoliday
                  ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100"
                  : hasSchool
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100"
                  : hasReminder
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}>
              <span className="text-[11px] font-medium leading-tight">{day}</span>
              {hasAny && !isToday && (
                <div className="flex gap-0.5 mt-0.5">
                  {hasHoliday  && <span className="w-1 h-1 rounded-full bg-red-500 block" />}
                  {hasSchool   && <span className="w-1 h-1 rounded-full bg-blue-500 block" />}
                  {hasReminder && <span className="w-1 h-1 rounded-full bg-amber-500 block" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Popup eventi i zgjedhur */}
      {selected && selectedEvents.length > 0 && (
        <div className="space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {new Date(selected + "T00:00:00").toLocaleDateString("sq-AL", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <button onClick={() => setSelected(null)} className="text-slate-300 hover:text-slate-500"><X className="w-3 h-3" /></button>
          </div>
          {selectedEvents.map((ev, i) => {
            const diff = daysUntil(ev.date);
            const c    = TYPE_COLORS[ev.type];
            return (
              <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${c.bg} ${c.border}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span>{TYPE_ICONS[ev.type]}</span>
                  <span className={`text-xs font-semibold truncate ${c.text}`}>{ev.label}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>
                    {diff === 0 ? "Sot" : diff > 0 ? `${daysUntilLabel(diff)}` : "Kaloi"}
                  </span>
                  {ev.type === "reminder" && (
                    <button onClick={() => removeReminder(ev.date, ev.label)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legjenda */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
        {[["bg-red-500","Festë shtetërore"],["bg-blue-500","Kalendar shkollor"],["bg-amber-500","Reminder"]].map(([c,l]) => (
          <span key={l} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${c} inline-block`} /> {l}
          </span>
        ))}
      </div>

      {/* Eventet e ardhshme */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">60 ditët e ardhshme</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {upcoming.map((ev, i) => {
              const c = TYPE_COLORS[ev.type];
              const d = new Date(ev.date + "T00:00:00");
              const dateLabel = d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
              return (
                <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${c.bg} ${c.border} cursor-pointer hover:opacity-90 transition-opacity`}
                  onClick={() => { setCur(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(ev.date); }}>
                  <span className="text-base flex-shrink-0">{TYPE_ICONS[ev.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${c.text}`}>{ev.label}</p>
                    <p className="text-[10px] text-slate-400">{dateLabel}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${c.badge}`}>
                      {ev.diff === 0 ? "Sot" : ev.diff === 1 ? "Nesër" : `${ev.diff} ditë`}
                    </span>
                    {ev.type === "reminder" && (
                      <button onClick={e => { e.stopPropagation(); removeReminder(ev.date, ev.label); }}
                        className="ml-1 text-slate-300 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal shto reminder */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" /> Shto Reminder
              </h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="form-label">Data</label>
              <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Përshkrimi</label>
              <input type="text" value={addLabel} onChange={e => setAddLabel(e.target.value)}
                placeholder="p.sh. Mbledhja e prindërve..." className="form-input"
                onKeyDown={e => e.key === "Enter" && addReminder()} autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center"><X className="w-4 h-4" /> Anulo</button>
              <button onClick={addReminder} disabled={!addDate || !addLabel.trim()} className="btn-primary flex-1 justify-center">
                <Plus className="w-4 h-4" /> Shto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
