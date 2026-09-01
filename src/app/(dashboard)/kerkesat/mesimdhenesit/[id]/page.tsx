"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { formatDate } from "@/lib/utils";
import { exportMaterialRequestsExcel, type ExportableRequest } from "@/lib/materialRequestExport";
import { CheckCircle, XCircle, Clock, Download, Package } from "lucide-react";

interface MaterialRequestRow extends ExportableRequest {
  id: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Në pritje",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="w-3.5 h-3.5" /> },
  APPROVED: { label: "Aprovuar",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  REJECTED: { label: "Refuzuar",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="w-3.5 h-3.5" /> },
};

export default function TeacherFolderPage() {
  const params = useParams();
  const teacherId = params.id as string;

  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/material-requests?teacherId=${teacherId}`);
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }, [teacherId]);

  useEffect(() => { load(); }, [load]);

  const teacherName = requests[0]?.teacher.name ?? "Mësimdhënësja";

  async function handleExport() {
    const safeName = teacherName.replace(/[^\p{L}\p{N}]+/gu, "-");
    await exportMaterialRequestsExcel(requests, `Kerkesat-${safeName}`, false);
  }

  return (
    <>
      <Header title={teacherName} backHref="/kerkesat/mesimdhenesit" />
      <div className="p-6 max-w-3xl mx-auto space-y-4 animate-fade-in">
        <div className="flex items-center justify-end">
          <button onClick={handleExport} disabled={!requests.length} className="btn-secondary text-sm">
            <Download className="w-4 h-4" />
            Eksporto Excel
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
        ) : requests.length === 0 ? (
          <div className="card p-10 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Asnjë kërkesë nga kjo mësimdhënëse.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const st = STATUS_LABEL[r.status];
              return (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
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
                      <p className="text-xs text-slate-400 mt-2">{formatDate(r.createdAt)}</p>
                      {r.status !== "PENDING" && (
                        <p className="text-xs text-slate-400 mt-1">
                          Shqyrtuar nga {r.reviewedBy?.name ?? "—"}
                          {r.reviewNote && <> — <span className="italic">{r.reviewNote}</span></>}
                        </p>
                      )}
                      {r.sentAt && (
                        <p className="text-xs text-green-600 mt-1">Dërguar te {r.sentToEmail}</p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                      {st.icon}
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
