"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Folder, Clock, CheckCircle, XCircle } from "lucide-react";

interface MaterialRequestRow {
  id: number;
  status: string;
  teacher: { name: string; email: string };
  teacherId?: number;
}

const PENDING_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW"]);
const APPROVED_STATUSES = new Set(["APPROVED", "PARTIALLY_APPROVED"]);

interface TeacherSummary {
  teacherId: number;
  name: string;
  email: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function MesimdhenesitFolderPage() {
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/material-requests")
      .then(r => r.json())
      .then((rows: (MaterialRequestRow & { teacherId: number })[]) => {
        const byTeacher = new Map<number, TeacherSummary>();
        for (const r of rows) {
          const existing = byTeacher.get(r.teacherId) ?? {
            teacherId: r.teacherId,
            name: r.teacher.name,
            email: r.teacher.email,
            total: 0, pending: 0, approved: 0, rejected: 0,
          };
          existing.total++;
          if (PENDING_STATUSES.has(r.status)) existing.pending++;
          if (APPROVED_STATUSES.has(r.status)) existing.approved++;
          if (r.status === "REJECTED") existing.rejected++;
          byTeacher.set(r.teacherId, existing);
        }
        setTeachers([...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name, "sq")));
        setLoading(false);
      });
  }, []);

  return (
    <>
      <Header title="Mësimdhënësit" backHref="/kerkesat" />
      <div className="p-6 max-w-4xl mx-auto space-y-3 animate-fade-in">
        <p className="text-sm text-slate-400 mb-2">Historiku i kërkesave për secilën mësimdhënëse.</p>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
        ) : teachers.length === 0 ? (
          <div className="card p-10 text-center">
            <Folder className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Asnjë mësimdhënëse s&apos;ka bërë ende kërkesa.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teachers.map(t => (
              <Link
                key={t.teacherId}
                href={`/kerkesat/mesimdhenesit/${t.teacherId}`}
                className="card p-4 hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white truncate">{t.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{t.total} kërkesa</span>
                    {t.pending > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-600"><Clock className="w-3 h-3" />{t.pending}</span>
                    )}
                    <span className="flex items-center gap-0.5 text-green-600"><CheckCircle className="w-3 h-3" />{t.approved}</span>
                    <span className="flex items-center gap-0.5 text-red-500"><XCircle className="w-3 h-3" />{t.rejected}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
