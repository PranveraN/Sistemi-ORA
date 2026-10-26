"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, ShoppingCart, ArrowLeft, Package, ChevronDown, X, UserPlus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: number;
  name: string;
  sellPrice: number;
  buyPrice: number;
  stock: number;
}

interface StudentOpt {
  id: number;
  firstName: string;
  lastName: string;
  class: { name: string } | null;
}

interface CartItem {
  id: string; // unique key: productId + size
  product: Product;
  size: string;
  quantity: number;
  sellPrice: number;
}

const SIZES = ["1", "2", "3", "4", "5", "6", "7", "XS", "S", "M", "L", "XL", "2XL"];

// Një "zë" = një nxënës/klient me shportën e vet. Për çdo zë krijohet shitja e vet (si gjithmonë),
// që borxhi, stoku dhe historiku i secilit të mbeten të sakta; me 2+ zëra ato bashkohen në një
// dëshmi pagese familjeje (/api/family-receipts/batch — i njëjti mekanizëm si te lista e shitjeve).
interface Buyer { key: number; student: StudentOpt | null; customerName: string; cart: CartItem[]; paid: string }
let nextKey = 1;
const newBuyer = (): Buyer => ({ key: nextKey++, student: null, customerName: "", cart: [], paid: "" });

export default function NewSalePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [buyers, setBuyers] = useState<Buyer[]>(() => [newBuyer()]);
  const [active, setActive] = useState(0);
  const [customerPhone, setCustomerPhone] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentOpts, setStudentOpts] = useState<StudentOpt[]>([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidEdited, setPaidEdited] = useState(false); // pagesa e ndarë me dorë për secilin nxënës
  const shumë = buyers.length > 1;
  const cur = buyers[Math.min(active, buyers.length - 1)];
  const cart = cur.cart;
  const selStudent = cur.student;
  const customerName = cur.customerName;
  const updBuyer = (patch: Partial<Buyer>) => setBuyers(bs => bs.map((b, i) => i === active ? { ...b, ...patch } : b));
  const setCart = (fn: (c: CartItem[]) => CartItem[]) => setBuyers(bs => bs.map((b, i) => i === active ? { ...b, cart: fn(b.cart) } : b));
  const setCustomerName = (v: string) => updBuyer({ customerName: v });
  const setSelStudent = (v: StudentOpt | null) => updBuyer({ student: v });
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  // picker state
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pickerSize, setPickerSize] = useState("");

  useEffect(() => {
    fetch("/api/uniforms/products?active=true")
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []));
  }, []);

  // Kërkim nxënësi — opsionale (Uniforma shitet edhe klientëve që s'janë
  // nxënës të regjistruar), prandaj s'kufizon fare regjistrimin e shitjes.
  useEffect(() => {
    if (!studentSearch || studentSearch.length < 2) { setStudentOpts([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}&limit=10`);
      if (r.ok) {
        const d = await r.json();
        setStudentOpts(Array.isArray(d) ? d : d.students || []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  function selectStudent(s: StudentOpt) {
    updBuyer({ student: s, customerName: `${s.firstName} ${s.lastName}` });
    setStudentOpts([]);
    setStudentSearch("");
  }
  function shtoNxenes() {
    setBuyers(bs => [...bs, newBuyer()]);
    setActive(buyers.length);
    setStudentSearch("");
  }
  function hiqNxenes(i: number) {
    setBuyers(bs => bs.filter((_, j) => j !== i));
    setActive(a => Math.max(0, a >= i ? a - 1 : a));
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openPicker = (p: Product) => {
    setPickerProduct(p);
    setPickerSize("");
  };

  const addToCart = (size: string) => {
    if (!pickerProduct) return;
    const key = `${pickerProduct.id}-${size}`;
    setCart(c => {
      const ex = c.find(i => i.id === key);
      if (ex) return c.map(i => i.id === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, {
        id: key,
        product: pickerProduct,
        size,
        quantity: 1,
        sellPrice: pickerProduct.sellPrice,
      }];
    });
    setPickerProduct(null);
  };

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) { setCart(c => c.filter(i => i.id !== id)); return; }
    setCart(c => c.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id: string, price: string) => {
    setCart(c => c.map(i => i.id === id ? { ...i, sellPrice: parseFloat(price) || 0 } : i));
  };

  const totalOf = (b: Buyer) => b.cart.reduce((s, i) => s + i.sellPrice * i.quantity, 0);
  const cartTotal = totalOf(cur);
  const total = buyers.reduce((s, b) => s + totalOf(b), 0);
  // Pagesa e përbashkët ndahet sipas totalit të secilit (në centë, pa humbur asnjë cent);
  // ose me dorë për secilin nxënës.
  const ndarja = (() => {
    if (paidEdited) return buyers.map(b => Math.round((parseFloat(b.paid) || 0) * 100));
    const paguar = Math.round((parseFloat(paidAmount) || 0) * 100);
    const tot = buyers.map(b => Math.round(totalOf(b) * 100));
    const sum = tot.reduce((a, x) => a + x, 0);
    if (!sum) return buyers.map((_, i) => (i === 0 ? paguar : 0));
    const out = tot.map(t => Math.floor((paguar * t) / sum));
    let mbet = paguar - out.reduce((a, x) => a + x, 0);
    for (let i = 0; mbet > 0; i = (i + 1) % out.length, mbet--) out[i]++;
    return out;
  })();
  const paid  = ndarja.reduce((a, x) => a + x, 0) / 100;
  const debt  = Math.max(0, total - paid);

  const gati = buyers.every(b => b.customerName.trim() && b.cart.length > 0);

  const submit = async () => {
    if (!gati) return;
    setSaving(true);
    const krijuar: number[] = [];
    for (let i = 0; i < buyers.length; i++) {
      const b = buyers[i];
      const body = {
        customerName: b.customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        studentId: b.student?.id ?? null,
        items: b.cart.map(it => ({ productId: it.product.id, size: it.size, quantity: it.quantity, sellPrice: it.sellPrice })),
        paidAmount: ndarja[i] / 100,
        method,
        notes: notes.trim() || null,
        saleDate,
      };
      const res = await fetch("/api/uniforms/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        setSaving(false);
        const data = await res.json().catch(() => ({}));
        alert(`Gabim gjatë ruajtjes së ${b.customerName}:\n${data.error || res.statusText || res.status}` +
          (krijuar.length ? `\n\nKujdes: ${krijuar.length} shitje u ruajtën tashmë (${buyers.slice(0, krijuar.length).map(x => x.customerName).join(", ")}). Mos i rishtoni — vazhdoni vetëm me të tjerët.` : ""));
        if (krijuar.length) { setBuyers(bs => bs.slice(krijuar.length)); setActive(0); }
        return;
      }
      krijuar.push((await res.json()).id);
    }
    if (krijuar.length === 1) { router.push(`/uniforma/shitje/${krijuar[0]}`); return; }
    // 2+ nxënës → një dëshmi pagese familjeje
    const fr = await fetch("/api/family-receipts/batch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentName: buyers[0].customerName.trim(), parentPhone: customerPhone.trim() || null, method, uniSaleIds: krijuar }),
    });
    if (!fr.ok) alert("Shitjet u ruajtën, por dëshmia e përbashkët s'u krijua — mund ta bëni te lista e shitjeve (zgjidhni ato dhe 'Dëshmi familjeje').");
    router.push("/uniforma/shitje");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shitje e Re</h1>
          <p className="text-sm text-slate-400 mt-0.5">Zgjidh produktin dhe madhësinë</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product picker */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm">Zgjidh Produktin</h2>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="input pl-9" placeholder="Kërko produkt..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-sm">
                  <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Nuk ka produkte
                </div>
              )}
              {filtered.map(p => (
                <button key={p.id} onClick={() => openPicker(p)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left group">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Çmimi: {formatCurrency(p.sellPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary-600 font-bold">{formatCurrency(p.sellPrice)}</span>
                    <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-primary-500 rotate-[-90deg] transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Nxënësit e kësaj pagese (vëllezër/motra) — secili me shportën e vet */}
          <div className="card p-3 flex flex-wrap items-center gap-2">
            {buyers.map((b, i) => (
              <div key={b.key} className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm cursor-pointer ${i === active ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300 font-semibold" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                onClick={() => setActive(i)}>
                <span>{b.customerName.trim() || `Nxënësi ${i + 1}`}</span>
                <span className="text-xs text-slate-400 ml-1">{formatCurrency(totalOf(b))}</span>
                {buyers.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); hiqNxenes(i); }} className="ml-1 text-slate-400 hover:text-red-500" title="Hiq"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
            <button onClick={shtoNxenes} className="btn-ghost !py-1.5 !text-xs"><UserPlus className="w-4 h-4" />Shto nxënës (vëlla/motër)</button>
            {shumë && <span className="text-[11px] text-slate-400 w-full">Produktet që zgjidhni shtohen te nxënësi i shënuar. Për secilin ruhet shitja e vet, dhe bashkohen në një dëshmi familjeje.</span>}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Shporta{shumë ? ` — ${customerName.trim() || `Nxënësi ${active + 1}`}` : ""} ({cart.length} rreshta)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left py-2 px-1 text-xs text-slate-400 font-semibold">Produkti</th>
                      <th className="text-center py-2 px-1 text-xs text-slate-400 font-semibold">Nr./Madhësia</th>
                      <th className="text-center py-2 px-1 text-xs text-slate-400 font-semibold">Sasia</th>
                      <th className="text-center py-2 px-1 text-xs text-slate-400 font-semibold">Çmimi (€)</th>
                      <th className="text-right py-2 px-1 text-xs text-slate-400 font-semibold">Totali</th>
                      <th className="py-2 px-1"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td className="py-2 px-1 font-medium text-slate-800 dark:text-slate-200 max-w-[140px]">
                          <span className="truncate block">{item.product.name}</span>
                        </td>
                        <td className="py-2 px-1 text-center">
                          <span className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg font-bold text-sm">
                            {item.size}
                          </span>
                        </td>
                        <td className="py-2 px-1">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQty(item.id, item.quantity - 1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-lg leading-none">−</button>
                            <span className="w-8 text-center font-bold">{item.quantity}</span>
                            <button onClick={() => updateQty(item.id, item.quantity + 1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-lg leading-none">+</button>
                          </div>
                        </td>
                        <td className="py-2 px-1">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number" step="0.5"
                              value={item.sellPrice}
                              onChange={e => updatePrice(item.id, e.target.value)}
                              className="w-16 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <span className="text-slate-400 text-xs">€</span>
                          </div>
                        </td>
                        <td className="py-2 px-1 text-right font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(item.sellPrice * item.quantity)}
                        </td>
                        <td className="py-2 px-1">
                          <button onClick={() => setCart(c => c.filter(i => i.id !== item.id))}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-slate-700">
                      <td colSpan={4} className="py-2 px-1 font-bold text-slate-700 dark:text-slate-200 text-right">TOTALI</td>
                      <td className="py-2 px-1 text-right font-bold text-lg text-primary-600">{formatCurrency(cartTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Klienti{shumë ? ` — ${customerName.trim() || `Nxënësi ${active + 1}`}` : ""}</h2>
            <div>
              <label className="label">Nxënësi (opsionale)</label>
              {selStudent ? (
                <div className="flex items-center justify-between p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                  <div>
                    <p className="font-semibold text-primary-800 dark:text-primary-300 text-sm">{selStudent.firstName} {selStudent.lastName}</p>
                    {selStudent.class && <p className="text-xs text-slate-500">Klasa {selStudent.class.name}</p>}
                  </div>
                  <button onClick={() => setSelStudent(null)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Kërko nxënësin (opsionale)..." className="input pl-9" />
                  {studentOpts.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                      {studentOpts.map(s => (
                        <button key={s.id} onClick={() => selectStudent(s)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left text-sm transition-colors">
                          <span className="font-medium text-slate-800 dark:text-white">{s.firstName} {s.lastName}</span>
                          {s.class && <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{s.class.name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="label">Emri i klientit *</label>
              <input className="input" placeholder="Emri Mbiemri" value={customerName}
                onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="label">Telefoni</label>
              <input className="input" placeholder="+383..." value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Data e shitjes</label>
              <input className="input" type="date" value={saleDate}
                onChange={e => setSaleDate(e.target.value)} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Pagesa</h2>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Totali</span>
              <span className="font-bold text-slate-900 dark:text-white text-xl">{formatCurrency(total)}</span>
            </div>
            <div>
              <label className="label">Shumë e paguar (€){shumë ? " — gjithsej" : ""}</label>
              <input className="input" type="number" step="0.01" placeholder="0.00" value={paidEdited ? paid.toFixed(2) : paidAmount}
                disabled={paidEdited} onChange={e => setPaidAmount(e.target.value)} />
            </div>
            {shumë && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Ndarja sipas nxënësve</span>
                  <button className="text-primary-600 hover:underline" onClick={() => {
                    if (!paidEdited) setBuyers(bs => bs.map((b, i) => ({ ...b, paid: (ndarja[i] / 100).toFixed(2) })));
                    setPaidEdited(v => !v);
                  }}>{paidEdited ? "Ndaje vetë" : "Ndrysho me dorë"}</button>
                </div>
                {buyers.map((b, i) => (
                  <div key={b.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{b.customerName.trim() || `Nxënësi ${i + 1}`} <span className="text-xs text-slate-400">/ {formatCurrency(totalOf(b))}</span></span>
                    {paidEdited
                      ? <input className="input !w-24 !py-1 text-right" type="number" step="0.01" value={b.paid}
                          onChange={e => setBuyers(bs => bs.map((x, j) => j === i ? { ...x, paid: e.target.value } : x))} />
                      : <span className="tabular-nums font-semibold">{formatCurrency(ndarja[i] / 100)}</span>}
                  </div>
                ))}
              </div>
            )}
            {debt > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex justify-between text-sm">
                <span className="text-amber-700 dark:text-amber-400">Borxhi</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(debt)}</span>
              </div>
            )}
            {paid >= total && total > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-400 text-center">
                Paguar plotësisht ✓
              </div>
            )}
            <div>
              <label className="label">Mënyra e pagesës</label>
              <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bankë / Transfer</option>
                <option value="CARD">Kartë</option>
              </select>
            </div>
            <div>
              <label className="label">Shënim</label>
              <textarea className="input resize-none" rows={2} placeholder="opsional" value={notes}
                onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <button onClick={submit}
            disabled={saving || !gati}
            className="btn-primary w-full justify-center text-base py-3 disabled:opacity-40">
            {saving ? "Duke ruajtur..." : shumë ? `Regjistro ${buyers.length} shitjet` : "Regjistro Shitjen"}
          </button>
        </div>
      </div>

      {/* Size picker modal */}
      {pickerProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPickerProduct(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="mb-5">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">{pickerProduct.name}</h2>
              <p className="text-sm text-slate-400 mt-0.5">Zgjidh numrin / madhësinë</p>
            </div>

            {/* Children sizes */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Fëmijë</p>
              <div className="grid grid-cols-7 gap-1.5">
                {["1","2","3","4","5","6","7"].map(s => (
                  <button key={s} onClick={() => addToCart(s)}
                    className="py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-200 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Adult sizes */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Të rritur</p>
              <div className="grid grid-cols-6 gap-1.5">
                {["XS","S","M","L","XL","2XL"].map(s => (
                  <button key={s} onClick={() => addToCart(s)}
                    className="py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-200 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setPickerProduct(null)}
              className="mt-5 w-full btn-ghost justify-center">
              Anulo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
