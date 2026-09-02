"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { formatDate } from "@/lib/utils";
import { exportMaterialRequestsExcel, type ExportableRequest } from "@/lib/materialRequestExport";
import { CheckCircle, XCircle, Clock, Package, Loader2, Send, Users, Download, X, Mail } from "lucide-react";

interface MaterialRequestRow extends ExportableRequest {
  id: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Në pritje",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="w-3.5 h-3.5" /> },
  APPROVED: { label: "Aprovuar",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  REJECTED: { label: "Refuzuar",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="w-3.5 h-3.5" /> },
};

export default function KerkesatPage() {
  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [actingId, setActingId] = useState<number | null>(null);
  const [furnitoriOraEmail, setFurnitoriOraEmail] = useState("");
  const [sendError, setSendError] = useState<{ id: number; message: string } | null>(null);
  const [sendModal, setSendModal] = useState<{ id: number; email: string } | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/material-requests");
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setFurnitoriOraEmail(d.furnitoriOraEmail || ""));
  }, []);

  function openSendModal(id: number) {
    setSendError(null);
    setSendModal({ id, email: furnitoriOraEmail || "" });
  }

  // I mbështjellë me try/catch — pa të, një dështim rrjeti (jo vetëm një
  // përgjigje jo-2xx) do të linte butonin "në ngarkim" pa asnjë sqarim,
  // duke dhënë përshtypjen se klikimi "s'bëri asgjë".
  async function confirmSend() {
    if (!sendModal) return;
    const { id, email } = sendModal;
    const trimmed = email.trim();
    if (!trimmed) {
      setSendError({ id, message: "Shkruaj një email para se të dërgosh." });
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/material-requests/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError({ id, message: d.error || "Dërgimi dështoi" });
        setSending(false);
        return;
      }
      setSending(false);
      setSendModal(null);
      load();
    } catch {
      setSending(false);
      setSendError({ id, message: "Gabim rrjeti — provo përsëri." });
    }
  }

  async function handleDecision(id: number, status: "APPROVED" | "REJECTED") {
    let reviewNote: string | null = null;
    if (status === "REJECTED") {
      reviewNote = window.prompt("Arsyeja e refuzimit (opsionale):") ?? "";
    }
    setActingId(id);
    await fetch(`/api/material-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote: reviewNote || undefined }),
    });
    setActingId(null);
    load();
  }

  const filtered = requests.filter(r => filter === "ALL" || r.status === filter);
  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  return (
    <>
      <Header title="Kërkesat për Material" />
      <div className="p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {([
              ["PENDING", "Në pritje"],
              ["APPROVED", "Aprovuara"],
              ["REJECTED", "Refuzuara"],
              ["ALL", "Të gjitha"],
            ] as [typeof filter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === key
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {label}
                {key === "PENDING" && pendingCount > 0 && (
                  <span className="ml-1.5 bg-white/20 px-1.5 rounded-full text-xs">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/kerkesat/mesimdhenesit" className="btn-secondary text-sm">
              <Users className="w-4 h-4" />
              Mësimdhënësit
            </Link>
            <button
              onClick={() => exportMaterialRequestsExcel(filtered, "Kerkesat-Materiale")}
              disabled={!filtered.length}
              className="btn-secondary text-sm"
            >
              <Download className="w-4 h-4" />
              Eksporto Excel
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Asnjë kërkesë në këtë kategori.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const st = STATUS_LABEL[r.status];
              return (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 dark:text-white">{r.item}</p>
                        <span className="text-slate-400 text-sm">× {r.quantity}</span>
                        {r.subjectOrClass && (
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">
                            {r.subjectOrClass}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1.5">{r.reason}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {r.teacher.name} · {formatDate(r.createdAt)}
                      </p>
                      {r.status !== "PENDING" && (
                        <p className="text-xs text-slate-400 mt-1">
                          Shqyrtuar nga {r.reviewedBy?.name ?? "—"}
                          {r.reviewNote && <> — <span className="italic">{r.reviewNote}</span></>}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                      {st.icon}
                      {st.label}
                    </span>
                  </div>

                  {r.status === "PENDING" && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={() => handleDecision(r.id, "APPROVED")}
                        disabled={actingId === r.id}
                        className="btn-primary text-sm"
                      >
                        {actingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Aprovo
                      </button>
                      <button
                        onClick={() => handleDecision(r.id, "REJECTED")}
                        disabled={actingId === r.id}
                        className="btn-secondary text-sm text-red-600"
                      >
                        <XCircle className="w-4 h-4" />
                        Refuzo
                      </button>
                    </div>
                  )}

                  {r.status === "APPROVED" && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                      {r.sentAt ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Dërguar te {r.sentToEmail}
                        </span>
                      ) : (
                        <button
                          onClick={() => openSendModal(r.id)}
                          className="btn-secondary text-sm"
                        >
                          <Send className="w-4 h-4" />
                          Dërgo te FurnitoriOra
                        </button>
                      )}
                      {sendError?.id === r.id && !sendModal && (
                        <p className="text-xs text-red-500 mt-2">{sendError.message}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !sending && setSendModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-primary-500" />
                Dërgo te FurnitoriOra
              </h3>
              <button onClick={() => !sending && setSendModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="form-label">Email-i i marrësit</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    autoFocus
                    value={sendModal.email}
                    onChange={e => setSendModal(m => m && { ...m, email: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && confirmSend()}
                    className="form-input pl-9"
                    placeholder="furnitori@example.com"
                  />
                </div>
              </div>
              {sendError?.id === sendModal.id && (
                <p className="text-sm text-red-500">{sendError.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => setSendModal(null)} disabled={sending} className="btn-secondary disabled:opacity-50">Anulo</button>
              <button onClick={confirmSend} disabled={sending} className="btn-primary disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Dërgo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
