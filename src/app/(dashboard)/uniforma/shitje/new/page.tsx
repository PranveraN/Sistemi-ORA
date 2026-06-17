"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, ShoppingCart, ArrowLeft, Package, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: number;
  name: string;
  sellPrice: number;
  buyPrice: number;
  stock: number;
}

interface CartItem {
  id: string; // unique key: productId + size
  product: Product;
  size: string;
  quantity: number;
  sellPrice: number;
}

const SIZES = ["1", "2", "3", "4", "5", "6", "7", "XS", "S", "M", "L", "XL", "2XL"];

export default function NewSalePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
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

  const total = cart.reduce((s, i) => s + i.sellPrice * i.quantity, 0);
  const paid  = parseFloat(paidAmount) || 0;
  const debt  = Math.max(0, total - paid);

  const submit = async () => {
    if (!customerName.trim() || cart.length === 0) return;
    setSaving(true);
    const body = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      items: cart.map(i => ({
        productId: i.product.id,
        size: i.size,
        quantity: i.quantity,
        sellPrice: i.sellPrice,
      })),
      paidAmount: paid,
      method,
      notes: notes.trim() || null,
      saleDate,
    };
    const res = await fetch("/api/uniforms/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const sale = await res.json();
      router.push(`/uniforma/shitje/${sale.id}`);
    } else {
      setSaving(false);
      const data = await res.json().catch(() => ({}));
      alert("Gabim gjatë ruajtjes:\n" + (data.error || res.statusText || res.status));
    }
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

          {/* Cart */}
          {cart.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Shporta ({cart.length} rreshta)
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
                      <td className="py-2 px-1 text-right font-bold text-lg text-primary-600">{formatCurrency(total)}</td>
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
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Klienti</h2>
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
              <label className="label">Shumë e paguar (€)</label>
              <input className="input" type="number" step="0.01" placeholder="0.00" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)} />
            </div>
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
            disabled={saving || !customerName.trim() || cart.length === 0}
            className="btn-primary w-full justify-center text-base py-3 disabled:opacity-40">
            {saving ? "Duke ruajtur..." : "Regjistro Shitjen"}
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
