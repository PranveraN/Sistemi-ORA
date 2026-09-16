"use client";

import { useRef, useState } from "react";
import { X, Send, Loader2, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

export interface NotificationRecipient {
  phone: string;
  name: string;
  studentId?: number;
  message: string;
}

interface Props {
  recipients: NotificationRecipient[];
  onClose: () => void;
  onSent?: (result: { sent: number; failed: number; total: number }) => void;
}

// Preview para dërgimit të njoftimeve të gjeneruara automatikisht (shih
// notificationTemplates.ts) — ndryshe nga kompozimi i zakonshëm te faqja SMS
// (një tekst i përbashkët për të gjithë), këtu çdo marrës ka mesazhin e vet
// real (shuma/statusi ndryshojnë student pas studenti), ndaj secili dërgohet
// me `recipients[].message` te /api/sms/send (jo fusha e përbashkët `message`).
export default function NotificationPreviewModal({ recipients, onClose, onSent }: Props) {
  // Indeksi (jo telefoni!) është çelësi — vëllezër/motra shpesh e ndajnë të
  // njëjtin telefon prindi, por kanë mesazhe krejt të ndryshme (shuma të
  // ndryshme borxhi); çelësim sipas telefonit i bashkonte aksidentalisht
  // (njëri fshihej nga tjetri) si te state-i këtu ashtu edhe te dërgimi.
  const [messages, setMessages] = useState<string[]>(() => recipients.map(r => r.message));
  const [expanded, setExpanded] = useState<number | null>(recipients.length === 1 ? 0 : null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Selektimi i tekstit brenda textarea-s s'duhet ta mbyllë modalin
  // aksidentalisht (shih fix-in e njëjtë te OfertaModal.tsx).
  const backdropDownRef = useRef(false);
  function onBackdropMouseDown(e: React.MouseEvent) { backdropDownRef.current = e.target === e.currentTarget; }
  function onBackdropClick(e: React.MouseEvent) {
    if (backdropDownRef.current && e.target === e.currentTarget) onClose();
    backdropDownRef.current = false;
  }

  async function handleSend() {
    setError("");
    setSending(true);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: recipients.map((r, i) => ({ phone: r.phone, name: r.name, studentId: r.studentId, message: messages[i] })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setError(d.error || "Dërgimi dështoi."); return; }
    onSent?.(d);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary-500" />
            Preview njoftimi{recipients.length > 1 ? ` (${recipients.length} marrës)` : ""}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-2.5 overflow-y-auto">
          {recipients.map((r, i) => {
            const isOpen = expanded === i || recipients.length === 1;
            const text = messages[i] ?? "";
            const segments = Math.ceil((text.length || 0) / 160) || 0;
            return (
              <div key={`${r.phone}-${i}`} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {recipients.length > 1 && (
                  <button
                    onClick={() => setExpanded(o => o === i ? null : i)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 text-left"
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{r.name}</span>
                    <span className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
                      {segments} segment{segments === 1 ? "" : "e"}
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                )}
                {isOpen && (
                  <div className="p-3 space-y-1">
                    {recipients.length === 1 && (
                      <p className="text-xs text-slate-400">{r.name} · {r.phone}</p>
                    )}
                    <textarea
                      value={text}
                      onChange={e => setMessages(m => m.map((v, mi) => mi === i ? e.target.value : v))}
                      className="form-input min-h-[90px] resize-none text-sm"
                    />
                    <p className="text-xs text-slate-400">{text.length} karaktere · {segments} segment{segments === 1 ? "" : "e"} SMS</p>
                  </div>
                )}
              </div>
            );
          })}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 pt-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={handleSend} disabled={sending || messages.some(m => !m?.trim())} className="btn-primary flex-1 justify-center">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Duke dërguar..." : `Dërgo (${recipients.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
