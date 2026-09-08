"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { ChevronLeft, Save, Plus, Trash2, X, Search, Users } from "lucide-react";

interface FamilyChild { id: number; firstName: string; lastName: string; class: { name: string } | null; status: string }
interface FamilyGroup { parent: { name: string; parentPhone: string | null } | null; children: FamilyChild[] }
interface InvoiceItem {
  studentId: string;    // "" = zë i përgjithshëm, jo i lidhur me një fëmijë specifik
  description: string;
  quantity: number;
  regularPrice: number;
  discountPct: number;
  unitPrice: number;   // auto: regularPrice * (1 - discountPct/100)
  total: number;       // auto: quantity * unitPrice
}

function emptyItem(studentId = ""): InvoiceItem {
  return { studentId, description: "", quantity: 1, regularPrice: 0, discountPct: 0, unitPrice: 0, total: 0 };
}

function calcItem(item: InvoiceItem): InvoiceItem {
  const unit  = item.regularPrice > 0
    ? Math.round(item.regularPrice * (1 - item.discountPct / 100) * 100) / 100
    : item.unitPrice;
  return { ...item, unitPrice: unit, total: Math.round(item.quantity * unit * 100) / 100 };
}

function fmt(v: number) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function InvoiceForm() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const preStudentId  = searchParams.get("studentId") || "";
  const preType       = searchParams.get("type") || "";
  const initialType   = ["INVOICE", "PROFORMA", "OFFER"].includes(preType) ? preType : "INVOICE";

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const [parentQuery, setParentQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<FamilyGroup | null>(null);
  const parentInfo     = selectedFamily?.parent ? { name: selectedFamily.parent.name, phone: selectedFamily.parent.parentPhone } : null;
  const familyChildren = selectedFamily?.children ?? [];

  const [form, setForm] = useState({
    type:      initialType,
    vatRate:   "0",
    dueDate:   "",
    notes:     "",
  });

  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  async function runFamilySearch(query: string) {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setFamilyGroups([]);
    setSelectedFamily(null);
    const isPhone = /\d/.test(query);
    const param = isPhone ? `phone=${encodeURIComponent(query)}` : `name=${encodeURIComponent(query)}`;
    const res = await fetch(`/api/families?${param}`);
    const data = await res.json();
    setSearching(false);
    setSearched(true);
    if (!res.ok || !data.families?.length) return;
    const groups: FamilyGroup[] = (data.families as FamilyGroup[])
      .map(f => ({ parent: f.parent, children: f.children.filter(c => c.status === "ACTIVE") }))
      .filter(f => f.children.length > 0);
    setFamilyGroups(groups);
    if (groups.length === 1) setSelectedFamily(groups[0]);
  }

  // Nëse erdhëm nga profili i një nxënësi specifik (?studentId=), gjejmë
  // familjen e tij automatikisht (telefoni/emri i prindit) — kështu i njëjti
  // rrjedhë funksionon edhe kur ka vëllezër/motra, edhe kur s'ka.
  useEffect(() => {
    if (!preStudentId) return;
    fetch(`/api/students/${preStudentId}`).then(r => r.json()).then(s => {
      const key = s.parentPhone || s.fatherPhone || s.motherPhone || s.parentName || s.fatherName || s.motherName;
      if (key) {
        setParentQuery(key);
        runFamilySearch(key).then(() => {
          setItems([emptyItem(preStudentId)]);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preStudentId]);

  function setField(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      return calcItem({ ...item, [field]: value } as InvoiceItem);
    }));
  }

  function addItem(studentId = "") {
    setItems(p => [...p, emptyItem(studentId)]);
  }

  function removeItem(i: number) { if (items.length > 1) setItems(p => p.filter((_, idx) => idx !== i)); }

  const subtotal  = items.reduce((s, i) => s + i.total, 0);
  const vatRate   = parseFloat(form.vatRate || "0");
  const vatAmount = (subtotal * vatRate) / 100;
  const total     = subtotal + vatAmount;

  function childName(id: string) {
    const c = familyChildren.find(c => String(c.id) === id);
    return c ? `${c.firstName} ${c.lastName}` : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!familyChildren.length) { setError("Kërko prindin (telefon ose emër) dhe zgjidh familjen fillimisht."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, studentId: familyChildren[0].id, items }),
    });
    setLoading(false);
    if (res.ok) { const inv = await res.json(); router.push(`/invoices/${inv.id}`); }
    else { const d = await res.json().catch(() => ({})); setError(d.message || "Ndodhi një gabim. Provoni sërish."); }
  }

  return (
    <>
      <Header />
      <div className="p-6 max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/invoices" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Faturë e Re</h1>
            <p className="text-sm text-slate-400 mt-0.5">Krijo faturë, profaturë ose ofertë</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          {/* Prindi / Familja */}
          <div className="card p-5 space-y-3">
            <h3 className="section-title flex items-center gap-1.5"><Users className="w-4 h-4" /> Prindi / Familja</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={parentQuery}
                  onChange={e => setParentQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); runFamilySearch(parentQuery); } }}
                  className="form-input pl-9"
                  placeholder="Kërko me numër telefoni ose emrin e prindit..."
                />
              </div>
              <button type="button" onClick={() => runFamilySearch(parentQuery)} disabled={searching || !parentQuery.trim()} className="btn-secondary">
                {searching ? "Duke kërkuar..." : "Kërko"}
              </button>
            </div>

            {searched && familyGroups.length === 0 && (
              <p className="text-sm text-amber-600">Asnjë nxënës aktiv s&apos;u gjet me këtë telefon/emër.</p>
            )}

            {familyGroups.length > 1 && !selectedFamily && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl space-y-2">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  U gjetën {familyGroups.length} familje të ndryshme me këtë emër — zgjidh njërën:
                </p>
                <div className="space-y-1.5">
                  {familyGroups.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedFamily(g)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-primary-400 text-sm"
                    >
                      <span className="font-semibold">{g.parent?.name || "—"}</span>
                      {g.parent?.parentPhone && <span className="text-slate-400"> · {g.parent.parentPhone}</span>}
                      <span className="text-slate-400"> · {g.children.map(c => `${c.firstName} ${c.lastName}`).join(", ")}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {familyChildren.length > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between gap-2 mb-2">
                  {parentInfo && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">{parentInfo.name}</span>
                      {parentInfo.phone && <span className="text-slate-400"> · {parentInfo.phone}</span>}
                    </p>
                  )}
                  {familyGroups.length > 1 && (
                    <button type="button" onClick={() => setSelectedFamily(null)} className="text-xs text-primary-600 hover:text-primary-700 shrink-0">‹ Familje tjetër</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {familyChildren.map(c => (
                    <span key={c.id} className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                      {c.firstName} {c.lastName}{c.class && ` · ${c.class.name}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Header info */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Informacioni i Faturës</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Lloji <span className="text-red-500">*</span></label>
                <select value={form.type} onChange={e => setField("type", e.target.value)} className="form-input">
                  <option value="INVOICE">Faturë</option>
                  <option value="PROFORMA">Profaturë</option>
                  <option value="OFFER">Ofertë</option>
                </select>
              </div>
              <div>
                <label className="form-label">Afati i Pagesës</label>
                <input type="date" value={form.dueDate} onChange={e => setField("dueDate", e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">TVSH (%)</label>
                <input type="number" value={form.vatRate} onChange={e => setField("vatRate", e.target.value)} className="form-input" min="0" max="100" />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="section-title">Zërat e Faturës</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {familyChildren.map(c => (
                  <button key={c.id} type="button" onClick={() => addItem(String(c.id))} className="btn-secondary text-xs">
                    <Plus className="w-3.5 h-3.5" /> Zë për {c.firstName}
                  </button>
                ))}
                <button type="button" onClick={() => addItem()} className="btn-secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Zë i Përgjithshëm
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">
              <div className="col-span-2">Nxënësi</div>
              <div className="col-span-3">Përshkrimi</div>
              <div className="col-span-1 text-right">Sasi</div>
              <div className="col-span-2 text-right">Çm. Rregullt (€)</div>
              <div className="col-span-1 text-right">Zbritja (%)</div>
              <div className="col-span-2 text-right">Çm. Final / Totali</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item, i) => {
                const discAmt = item.regularPrice > 0 ? Math.round(item.regularPrice * (item.discountPct / 100) * 100) / 100 : 0;
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    {/* Nxënësi */}
                    <div className="col-span-2">
                      <select value={item.studentId} onChange={e => updateItem(i, "studentId", e.target.value)} className="form-input text-xs">
                        <option value="">— i përgjithshëm —</option>
                        {familyChildren.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                      </select>
                    </div>

                    {/* Përshkrimi */}
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        className="form-input"
                        placeholder="Shkollimi, Ushqimi..."
                        required
                      />
                    </div>

                    {/* Sasia */}
                    <div className="col-span-1">
                      <input
                        type="number" min="1" step="0.5"
                        value={item.quantity}
                        onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)}
                        className="form-input text-right"
                      />
                    </div>

                    {/* Çmimi i Rregullt */}
                    <div className="col-span-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={item.regularPrice || ""}
                        onChange={e => updateItem(i, "regularPrice", parseFloat(e.target.value) || 0)}
                        className="form-input text-right"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Zbritja % */}
                    <div className="col-span-1">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={item.discountPct || ""}
                        onChange={e => updateItem(i, "discountPct", parseFloat(e.target.value) || 0)}
                        className="form-input text-right"
                        placeholder="0"
                      />
                      {discAmt > 0 && (
                        <p className="text-[10px] text-green-600 text-right mt-0.5">− {fmt(discAmt)} €</p>
                      )}
                    </div>

                    {/* Çmimi final + totali */}
                    <div className="col-span-2 text-right pt-2">
                      {item.regularPrice > 0 && item.discountPct > 0 && (
                        <p className="text-[10px] text-slate-400 line-through">{fmt(item.regularPrice)} €</p>
                      )}
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{fmt(item.unitPrice)} €</p>
                      {item.quantity > 1 && (
                        <p className="text-[10px] text-primary-600 font-bold">= {fmt(item.total)} €</p>
                      )}
                    </div>

                    {/* Fshi */}
                    <div className="col-span-1 flex justify-end pt-2">
                      <button type="button" onClick={() => removeItem(i)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {item.studentId && childName(item.studentId) && (
                      <div className="col-span-12 -mt-1 pl-2">
                        <p className="text-[10px] text-slate-400">Për: {childName(item.studentId)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <div className="w-64 space-y-2">
                {items.some(i => i.discountPct > 0) && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Çmimi pa zbritje:</span>
                    <span>{fmt(items.reduce((s, i) => s + i.regularPrice * i.quantity, 0))} €</span>
                  </div>
                )}
                {items.some(i => i.discountPct > 0) && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Zbritja totale:</span>
                    <span>− {fmt(items.reduce((s, i) => s + Math.round(i.regularPrice * (i.discountPct / 100) * i.quantity * 100) / 100, 0))} €</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Nëntotali:</span><span>{fmt(subtotal)} €</span>
                </div>
                {vatRate > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>TVSH ({vatRate}%):</span><span>{fmt(vatAmount)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-600 pt-2">
                  <span>TOTALI:</span>
                  <span className="text-primary-600">{fmt(total)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <label className="form-label">Shënime</label>
            <textarea value={form.notes} onChange={e => setField("notes", e.target.value)}
              className="form-input min-h-[80px] resize-none" placeholder="Shënime shtesë për faturën..." />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              <X className="w-4 h-4" /> Anulo
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              <Save className="w-4 h-4" />
              {loading ? "Duke krijuar..." : "Krijo Faturën"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function NewInvoicePage() {
  return <Suspense><InvoiceForm /></Suspense>;
}
