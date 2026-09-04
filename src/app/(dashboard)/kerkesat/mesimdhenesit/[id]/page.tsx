"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { formatDate } from "@/lib/utils";
import { exportMaterialRequestsExcel, type ExportableRequest } from "@/lib/materialRequestExport";
import { REQUEST_STATUS_MAP } from "@/lib/materialConstants";
import { CheckCircle, XCircle, Clock, Download, Package } from "lucide-react";

interface MaterialRequestRow extends ExportableRequest {
  id: number;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  SUBMITTED: <Clock className="w-3.5 h-3.5" />,
  UNDER_REVIEW: <Clock className="w-3.5 h-3.5" />,
  APPROVED: <CheckCircle className="w-3.5 h-3.5" />,
  PARTIALLY_APPROVED: <CheckCircle className="w-3.5 h-3.5" />,
  REJECTED: <XCircle className="w-3.5 h-3.5" />,
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
              const st = REQUEST_STATUS_MAP[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600" };
              const isPending = r.status === "SUBMITTED" || r.status === "UNDER_REVIEW";
              return (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="space-y-1">
                        {r.items.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-800 dark:text-white">
                              {it.isCustom ? it.customItemName : it.material?.name}
                            </p>
                            <span className="text-slate-400 text-sm">× {it.quantity} {it.unit}</span>
                            {it.color && (
                              <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                {it.color}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {(r.subject?.name || r.class?.name) && (
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">
                          {r.subject?.name || r.class?.name}
                        </span>
                      )}
                      <p className="text-sm text-slate-500 mt-1.5">{r.reason}</p>
                      <p className="text-xs text-slate-400 mt-2">{formatDate(r.createdAt)}</p>
                      {!isPending && (
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
                      {STATUS_ICON[r.status]}
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
