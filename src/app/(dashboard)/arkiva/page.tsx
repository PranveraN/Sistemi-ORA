"use client";

import { useState, useEffect, useCallback } from "react";
import { Archive, FileText, Receipt, BookOpen, Search, Trash2, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import Link from "next/link";
import PaymentReceiptModal from "@/components/finance/PaymentReceiptModal";

// ─── Types ─────────────────────────────────────────────────

interface DocEntry {
  id: number;
  type: string;
  studentId: number | null;
  studentName: string;
  className: string | null;
  generatedBy: string | null;
  createdAt: string;
}

interface InvoiceEntry {
  id: number;
  number: string;
  type: string;
  status: string;
  total: number;
  createdAt: string;
  studentName: string;
  className: string | null;
}

interface ReceiptEntry {
  id: number;
  receiptNumber: string;
  amount: number;
  paidDate: string | null;
  method: string | null;
  studentName: string;
  categoryName: string;
}

// ─── Helpers ────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  FLETEKALIM_CL: "Fletëkalim CL",
  FLETEKALIM_CU: "Fletëkalim CU",
  PASQYRE_CU:    "Pasqyrë Notave CU",
  VERTETIM_CL:   "Vërtetim CL",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  FLETEKALIM_CL: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  FLETEKALIM_CU: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  PASQYRE_CU:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  VERTETIM_CL:   "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-600",
  SENT:      "bg-blue-100 text-blue-700",
  PAID:      "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", SENT: "Dërguar", PAID: "Paguar", CANCELLED: "Anuluar",
};
const INV_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Faturë", PROFORMA: "Profaturë", OFFER: "Ofertë",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("sq-AL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Page ───────────────────────────────────────────────────

type Tab = "docs" | "invoices" | "receipts";

export default function ArkivaPage() {
  const [tab, setTab] = useState<Tab>("docs");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Docs
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsPage, setDocsPage] = useState(1);
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [docsLoading, setDocsLoading] = useState(false);

  // Invoices
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invPage, setInvPage] = useState(1);
  const [invLoading, setInvLoading] = useState(false);

  // Receipts
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Receipt modal
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);

  const LIMIT = 25;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch Docs ──
  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    const q = new URLSearchParams({
      page: String(docsPage),
      limit: String(LIMIT),
      search: debouncedSearch,
      type: docTypeFilter,
    });
    const res = await fetch(`/api/arkiva?${q}`);
    const data = await res.json();
    setDocs(data.docs || []);
    setDocsTotal(data.total || 0);
    setDocsLoading(false);
  }, [docsPage, debouncedSearch, docTypeFilter]);

  // ── Fetch Invoices ──
  const fetchInvoices = useCallback(async () => {
    setInvLoading(true);
    const q = new URLSearchParams({
      page: String(invPage),
      limit: String(LIMIT),
      search: debouncedSearch,
    });
    const res = await fetch(`/api/arkiva/invoices?${q}`);
    const data = await res.json();
    setInvoices(data.invoices || []);
    setInvTotal(data.total || 0);
    setInvLoading(false);
  }, [invPage, debouncedSearch]);

  // ── Fetch Receipts ──
  const fetchReceipts = useCallback(async () => {
    setReceiptLoading(true);
    const q = new URLSearchParams({
      page: String(receiptPage),
      limit: String(LIMIT),
      search: debouncedSearch,
    });
    const res = await fetch(`/api/arkiva/receipts?${q}`);
    const data = await res.json();
    setReceipts(data.receipts || []);
    setReceiptTotal(data.total || 0);
    setReceiptLoading(false);
  }, [receiptPage, debouncedSearch]);

  useEffect(() => { if (tab === "docs") fetchDocs(); }, [tab, fetchDocs]);
  useEffect(() => { if (tab === "invoices") fetchInvoices(); }, [tab, fetchInvoices]);
  useEffect(() => { if (tab === "receipts") fetchReceipts(); }, [tab, fetchReceipts]);

  async function deleteDoc(id: number) {
    if (!confirm("Fshi këtë dokument nga arkiva?")) return;
    await fetch(`/api/arkiva/${id}`, { method: "DELETE" });
    fetchDocs();
  }

  function Pagination({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) {
    const pages = Math.ceil(total / LIMIT);
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
        <span className="text-sm text-slate-500">{total} gjithsej</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{page} / {pages}</span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Archive className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Arkiva</h1>
          <p className="text-sm text-slate-500">Të gjitha dokumentet, faturat dhe dëshmitë e pagesave</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {([
          { key: "docs",     icon: BookOpen,  label: "Dokumentet Shkollore" },
          { key: "invoices", icon: FileText,  label: "Faturat" },
          { key: "receipts", icon: Receipt,   label: "Dëshmi Pagese" },
        ] as { key: Tab; icon: React.ElementType; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); setDocsPage(1); setInvPage(1); setReceiptPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Kërko nxënës..."
            value={search}
            onChange={e => { setSearch(e.target.value); setDocsPage(1); setInvPage(1); setReceiptPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {tab === "docs" && (
          <select
            value={docTypeFilter}
            onChange={e => { setDocTypeFilter(e.target.value); setDocsPage(1); }}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Të gjitha llojet</option>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => { if (tab === "docs") fetchDocs(); else if (tab === "invoices") fetchInvoices(); else fetchReceipts(); }}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"
          title="Rifresko"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Tab: Dokumentet Shkollore ── */}
      {tab === "docs" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Lloji</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nxënësi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Klasa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Gjeneruar nga</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Veprimet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {docsLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Duke ngarkuar...
                    </td>
                  </tr>
                ) : docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nuk ka dokumente të arkivuara
                    </td>
                  </tr>
                ) : docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${DOC_TYPE_COLORS[doc.type] || "bg-slate-100 text-slate-600"}`}>
                        {DOC_TYPE_LABELS[doc.type] || doc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                      {doc.studentName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{doc.className || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{doc.generatedBy || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{fmt(doc.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/sekretaria/fletkalimet?archiveId=${doc.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Rihap
                        </Link>
                        <button
                          onClick={() => deleteDoc(doc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Fshi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={docsTotal} page={docsPage} setPage={setDocsPage} />
        </div>
      )}

      {/* ── Tab: Faturat ── */}
      {tab === "invoices" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Numri</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Lloji</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nxënësi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Klasa</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Shuma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statusi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Hap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {invLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Duke ngarkuar...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nuk ka fatura
                    </td>
                  </tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">{inv.number}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {INV_TYPE_LABELS[inv.type] || inv.type}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{inv.studentName}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{inv.className || "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-slate-900 dark:text-white">
                      {inv.total.toLocaleString()} €
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[inv.status] || "bg-slate-100 text-slate-600"}`}>
                        {STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{fmt(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Hap
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={invTotal} page={invPage} setPage={setInvPage} />
        </div>
      )}

      {/* ── Tab: Dëshmi Pagese ── */}
      {tab === "receipts" && (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nr. Dëshmi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nxënësi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategoria</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Shuma</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Metoda</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Veprimet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {receiptLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Duke ngarkuar...
                      </td>
                    </tr>
                  ) : receipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Nuk ka dëshmi pagese
                      </td>
                    </tr>
                  ) : receipts.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">{r.receiptNumber}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{r.studentName}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{r.categoryName}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right text-slate-900 dark:text-white">
                        {r.amount.toLocaleString()} €
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{r.method || "CASH"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{r.paidDate ? fmt(r.paidDate) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setReceiptPaymentId(r.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Shiko / Printo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={receiptTotal} page={receiptPage} setPage={setReceiptPage} />
          </div>

          {receiptPaymentId !== null && (
            <PaymentReceiptModal
              paymentId={receiptPaymentId}
              onClose={() => setReceiptPaymentId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
