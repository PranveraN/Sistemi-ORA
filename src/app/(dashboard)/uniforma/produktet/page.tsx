"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, X, Check, AlertTriangle, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: number;
  name: string;
  description: string | null;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  stockAlert: number;
  active: boolean;
  _count?: { saleItems: number };
}

const INITIAL_PRODUCTS = [
  { name: "Trenerka të poshtme",   buyPrice: 12, sellPrice: 15 },
  { name: "Bluzë me krah të gjatë", buyPrice: 12, sellPrice: 15 },
  { name: "Maicë hiri",             buyPrice: 8,  sellPrice: 10 },
  { name: "Maicë vjollcë",          buyPrice: 8,  sellPrice: 10 },
  { name: "Duks hiri",              buyPrice: 17, sellPrice: 20 },
  { name: "Duks vjollcë",           buyPrice: 17, sellPrice: 20 },
];

export default function ProduktetPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<number, { buyPrice: string; sellPrice: string }>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBuy, setNewBuy] = useState("");
  const [newSell, setNewSell] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/uniforms/products")
      .then(r => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (p: Product) => {
    setEditing(e => ({ ...e, [p.id]: { buyPrice: String(p.buyPrice), sellPrice: String(p.sellPrice) } }));
  };

  const cancelEdit = (id: number) => {
    setEditing(e => { const n = { ...e }; delete n[id]; return n; });
  };

  const savePrice = async (p: Product) => {
    const e = editing[p.id];
    if (!e) return;
    await fetch(`/api/uniforms/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyPrice: parseFloat(e.buyPrice), sellPrice: parseFloat(e.sellPrice) }),
    });
    cancelEdit(p.id);
    load();
  };

  const addProduct = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/uniforms/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        buyPrice: parseFloat(newBuy) || 0,
        sellPrice: parseFloat(newSell) || 0,
        stock: 0, stockAlert: 5,
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setNewName(""); setNewBuy(""); setNewSell("");
    load();
  };

  const seedProducts = async () => {
    setSeeding(true);
    for (const p of INITIAL_PRODUCTS) {
      await fetch("/api/uniforms/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, buyPrice: p.buyPrice, sellPrice: p.sellPrice, stock: 0, stockAlert: 5 }),
      });
    }
    setSeeding(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/uniforms/products/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  if (loading) return (
    <div className="p-6 flex justify-center py-20">
      <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/uniforma" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div className="flex items-center justify-between flex-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lista e Produkteve & Çmimet</h1>
          <p className="text-sm text-slate-400 mt-0.5">Kliko mbi çmimin për ta ndryshuar</p>
        </div>
        <div className="flex gap-2">
          {products.length === 0 && (
            <button onClick={seedProducts} disabled={seeding}
              className="btn-ghost text-primary-600 border-primary-200 dark:border-primary-700">
              {seeding ? "Duke shtuar..." : "Shto produktet fillestare"}
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Shto Produkt të Ri
          </button>
        </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">PRODUKTI</th>
              <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">ÇMIMI BLERJES</th>
              <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">ÇMIMI SHITJES</th>
              <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">FITIMI/NJËSI</th>
              <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">SHITJE</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  <p className="mb-2">Nuk ka produkte.</p>
                  <button onClick={seedProducts} disabled={seeding}
                    className="text-primary-600 underline text-sm">
                    {seeding ? "Duke shtuar..." : "Shto 6 produktet standard"}
                  </button>
                </td>
              </tr>
            )}
            {products.map(p => {
              const ed = editing[p.id];
              const profit = ed
                ? (parseFloat(ed.sellPrice) || 0) - (parseFloat(ed.buyPrice) || 0)
                : p.sellPrice - p.buyPrice;
              return (
                <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!p.active ? "opacity-40" : ""}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                      {p.stock <= p.stockAlert && p.active && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    {p.description && <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>}
                  </td>

                  {/* Buy price */}
                  <td className="px-5 py-4 text-center">
                    {ed ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" step="0.01"
                          value={ed.buyPrice}
                          onChange={e => setEditing(prev => ({ ...prev, [p.id]: { ...prev[p.id], buyPrice: e.target.value } }))}
                          className="w-20 text-center border border-primary-400 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-slate-400 text-xs">€</span>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{p.buyPrice}</span>
                        <span className="text-slate-400 text-xs">€</span>
                      </button>
                    )}
                  </td>

                  {/* Sell price */}
                  <td className="px-5 py-4 text-center">
                    {ed ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" step="0.01"
                          value={ed.sellPrice}
                          onChange={e => setEditing(prev => ({ ...prev, [p.id]: { ...prev[p.id], sellPrice: e.target.value } }))}
                          className="w-20 text-center border border-primary-400 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-slate-400 text-xs">€</span>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{p.sellPrice}</span>
                        <span className="text-slate-400 text-xs">€</span>
                      </button>
                    )}
                  </td>

                  {/* Profit */}
                  <td className="px-5 py-4 text-center">
                    <span className={`font-bold text-base ${profit > 0 ? "text-primary-600" : "text-red-500"}`}>
                      {profit > 0 ? "+" : ""}{profit}€
                    </span>
                  </td>

                  {/* Sales count */}
                  <td className="px-5 py-4 text-center text-slate-400 text-sm">{p._count?.saleItems ?? 0}</td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      {ed ? (
                        <>
                          <button onClick={() => savePrice(p)}
                            className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => cancelEdit(p.id)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteId(p.id)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add new product row */}
        {showAdd && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <input className="input flex-1" placeholder="Emri i produktit" value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addProduct()} />
              <div className="flex items-center gap-1">
                <input className="input w-24 text-center" type="number" step="0.01" placeholder="Blerje €" value={newBuy}
                  onChange={e => setNewBuy(e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                <input className="input w-24 text-center" type="number" step="0.01" placeholder="Shitje €" value={newSell}
                  onChange={e => setNewSell(e.target.value)} />
              </div>
              {newBuy && newSell && (
                <span className="text-primary-600 font-bold text-sm whitespace-nowrap">
                  +{(parseFloat(newSell) - parseFloat(newBuy)).toFixed(0)}€
                </span>
              )}
              <button onClick={addProduct} disabled={saving || !newName.trim()}
                className="btn-primary whitespace-nowrap">
                {saving ? "..." : "Shto"}
              </button>
              <button onClick={() => { setShowAdd(false); setNewName(""); setNewBuy(""); setNewSell(""); }}
                className="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Fshi produktin?</h3>
            <p className="text-sm text-slate-400 mb-6">Ky veprim nuk mund të kthehet.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={confirmDelete} className="btn-danger flex-1">Fshi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
