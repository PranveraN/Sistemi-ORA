"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Edit, X, Plus, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useModuleAccess } from "@/lib/useModuleAccess";

interface TiRow { id: number; studentId: number | null; regularPrice: number }

// Lidhja me Timi Invest (Lidh / Ndrysho çmimin / Hiq) — zhvendosur këtu nga
// kolona "Çmimi TI" e tabelës së Nxënësve. E njëjta logjikë dhe të njëjtat API
// si më parë; shfaqet vetëm kur moduli TI është aktiv dhe roli ka leje.
export default function TimiInvestCard({ student }: {
  student: { id: number; firstName: string; lastName: string; parentName: string | null; parentPhone: string | null };
}) {
  const { canAccess } = useModuleAccess();
  const [enabled, setEnabled] = useState(false);
  const [link, setLink] = useState<TiRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const allowed = canAccess("/investime");

  const load = useCallback(async () => {
    try {
      const [sRes, tRes] = await Promise.all([fetch("/api/settings"), fetch("/api/timi-invest/students")]);
      const settings = sRes.ok ? await sRes.json() : {};
      setEnabled(settings.timiInvestEnabled !== "false");
      const rows: TiRow[] = tRes.ok ? await tRes.json() : [];
      setLink(Array.isArray(rows) ? rows.find(r => r.studentId === student.id) ?? null : null);
    } catch { /* karta thjesht s'shfaqet */ }
    setLoaded(true);
  }, [student.id]);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (!allowed || !loaded || !enabled) return null;

  async function save() {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return;
    setSaving(true);
    try {
      const res = link
        ? await fetch(`/api/timi-invest/students/${link.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ regularPrice: p }),
          })
        : await fetch("/api/timi-invest/students", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: student.firstName, lastName: student.lastName,
              parentName: student.parentName || "", parentPhone: student.parentPhone || "",
              regularPrice: p, studentId: student.id,
            }),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Ruajtja dështoi.");
        return;
      }
      setEditing(false);
      await load();
    } catch {
      alert("Gabim rrjeti — provo përsëri.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!link || !confirm(`Hiq lidhjen Timi Invest për ${student.firstName} ${student.lastName}?`)) return;
    try {
      const res = await fetch(`/api/timi-invest/students/${link.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Heqja dështoi.");
        return;
      }
      setLink(null);
    } catch {
      alert("Gabim rrjeti — provo përsëri.");
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-500" /> Timi Invest
        </h3>
        {!editing && (
          link ? (
            <div className="flex items-center gap-1">
              <button onClick={() => { setPrice(String(link.regularPrice)); setEditing(true); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                title="Ndrysho çmimin TI" aria-label="Ndrysho çmimin TI">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={remove}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Hiq lidhjen TI" aria-label="Hiq lidhjen TI">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => { setPrice(""); setEditing(true); }} className="btn-secondary text-xs">
              <Plus className="w-3.5 h-3.5" /> Lidh me Timi Invest
            </button>
          )
        )}
      </div>
      {editing ? (
        <div className="mt-3 flex gap-2">
          <input type="number" min={0} autoFocus value={price} onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="form-input" placeholder="Çmimi i rregullt TI (€)" />
          <button onClick={() => setEditing(false)} className="btn-secondary">Anulo</button>
          <button onClick={save} disabled={saving || !price} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ruaj"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500 mt-2">
          {link ? <>Çmimi i rregullt TI: <span className="font-semibold text-blue-600">{formatCurrency(link.regularPrice)}</span></> : "Nuk është i lidhur me Timi Invest."}
        </p>
      )}
    </div>
  );
}
