"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, UserRound, Users, Power, Trash2, X, Save, Loader2 } from "lucide-react";

export interface ClassLite {
  id: number;
  name: string;
  teacher: string | null;
  capacity: number | null;
  active: boolean;
  students: number;
}

type EditField = "teacher" | "capacity";

// Menyja me tre pika e klasës — të gjitha veprimet ekzistuese (editimi i
// mësuesit/kapacitetit, aktivizimi/çaktivizimi, fshirja), tani në një vend.
export default function ClassMenu({ cls, onChanged, readOnly }: { cls: ClassLite; onChanged: () => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EditField | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (readOnly) return null;

  async function patch(body: Record<string, unknown>, failMsg: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || failMsg);
        return false;
      }
      onChanged();
      return true;
    } catch {
      alert("Gabim rrjeti — provo përsëri.");
      return false;
    }
  }

  async function toggleActive() {
    setOpen(false);
    if (cls.active && !confirm(`T'a shënoj paralelen ${cls.name} si joaktive? Nuk do të numërohet më te kontrolli i vendeve/lista e pritjes te aplikimi publik.`)) return;
    await patch({ active: !cls.active }, "Ndryshimi dështoi.");
  }

  async function remove() {
    setOpen(false);
    if (cls.students > 0) {
      alert(`Klasa ${cls.name} ka ${cls.students} nxënës — zhvendosi në klasë tjetër ose çaktivizo klasën në vend që ta fshish.`);
      return;
    }
    if (!confirm(`Fshi përgjithmonë klasën ${cls.name}?`)) return;
    try {
      const res = await fetch(`/api/classes/${cls.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Fshirja dështoi.");
        return;
      }
      onChanged();
    } catch {
      alert("Gabim rrjeti — provo përsëri.");
    }
  }

  const item = "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700";

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Veprime për klasën ${cls.name}`} title="Veprime"
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
          <button role="menuitem" className={item} onClick={() => { setOpen(false); setEdit("teacher"); }}>
            <UserRound className="w-4 h-4 text-slate-400" /> Edito mësuesin
          </button>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); setEdit("capacity"); }}>
            <Users className="w-4 h-4 text-slate-400" /> Edito kapacitetin
          </button>
          <button role="menuitem" className={item} onClick={toggleActive}>
            <Power className="w-4 h-4 text-slate-400" /> {cls.active ? "Çaktivizo klasën" : "Aktivizo klasën"}
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
          <button role="menuitem" className={`${item} text-red-600`} onClick={remove}>
            <Trash2 className="w-4 h-4" /> Fshij klasën
          </button>
        </div>
      )}
      {edit && (
        <EditClassModal cls={cls} field={edit} onClose={() => setEdit(null)}
          onSave={async v => { if (await patch(edit === "teacher" ? { teacher: v } : { capacity: v }, "Ruajtja dështoi.")) setEdit(null); }} />
      )}
    </div>
  );
}

export function EditClassModal({ cls, field, onClose, onSave }: {
  cls: ClassLite; field: EditField; onClose: () => void; onSave: (v: string) => Promise<void>;
}) {
  const [value, setValue] = useState(field === "teacher" ? (cls.teacher ?? "") : (cls.capacity != null ? String(cls.capacity) : ""));
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(value.trim());
    setSaving(false);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {field === "teacher" ? `Mësuesi/ja i klasës ${cls.name}` : `Kapaciteti i klasës ${cls.name}`}
          </h3>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 rounded text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        {field === "teacher" ? (
          <input autoFocus value={value} onChange={e => setValue(e.target.value)} className="form-input" placeholder="Emri i mësuesit (bosh = pa mësues)" />
        ) : (
          <div>
            <input autoFocus type="number" min={1} value={value} onChange={e => setValue(e.target.value)} className="form-input" placeholder="25" />
            <p className="text-xs text-slate-400 mt-1">Bosh = 25 (parazgjedhje). Përdoret edhe te kontrolli i vendeve të aplikimit publik.</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Anulo</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Ruaj
          </button>
        </div>
      </form>
    </div>
  );
}
