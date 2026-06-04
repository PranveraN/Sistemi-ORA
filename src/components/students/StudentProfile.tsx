"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { ChevronLeft, Edit, CreditCard, FileText, Phone, MapPin, User, GraduationCap, Users, Trash2 } from "lucide-react";

interface Payment {
  id: number;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  method: string | null;
  dueDate: string;
  paidDate: string | null;
  description: string | null;
  category: { name: string };
}

interface Invoice {
  id: number;
  number: string;
  type: string;
  total: number;
  status: string;
  createdAt: string;
}

interface Sibling {
  id: number;
  firstName: string;
  lastName: string;
  class: { name: string; level: string } | null;
}

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  parentName: string | null;
  parentPhone: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  personalNumber: string | null;
  birthDate: string | null;
  address: string | null;
  guardian: string | null;
  motherNumber: string | null;
  diaryNumber: string | null;
  status: string;
  enrollDate: string;
  notes: string | null;
  class: { name: string; level: string } | null;
  payments: Payment[];
  invoices: Invoice[];
}

export default function StudentProfile({ student }: { student: Student }) {
  const router = useRouter();
  const totalDebt = student.payments.reduce((sum, p) => sum + p.balance, 0);
  const totalPaid = student.payments.reduce((sum, p) => sum + p.paidAmount, 0);

  async function handleDelete() {
    const ok = window.confirm(
      `Fshi përgjithmonë "${student.firstName} ${student.lastName}"?\n\nKJO VEPRIM NUK MUND TË KTHEHET — fshihen edhe të gjitha pagesat dhe faturat.`
    );
    if (!ok) return;
    await fetch(`/api/students/${student.id}?permanent=true`, { method: "DELETE" });
    router.push("/students");
    router.refresh();
  }

  const [siblings, setSiblings] = useState<Sibling[]>([]);
  useEffect(() => {
    const params = new URLSearchParams({ excludeId: String(student.id), status: "ACTIVE", limit: "10" });
    if (student.fatherPhone) {
      params.set("siblingFatherPhone", student.fatherPhone);
      if (student.fatherName) params.set("siblingFatherName", student.fatherName);
    }
    if (student.motherPhone) {
      params.set("siblingMotherPhone", student.motherPhone);
      if (student.motherName) params.set("siblingMotherName", student.motherName);
    }
    if (!student.fatherPhone && !student.motherPhone) {
      const phone = student.parentPhone;
      if (!phone) return;
      params.set("siblingPhone", phone);
    }
    fetch(`/api/students?${params}`)
      .then(r => r.json())
      .then(data => {
        const sorted = (data.students || []).sort((a: Sibling, b: Sibling) =>
          a.firstName.localeCompare(b.firstName, "sq", { sensitivity: "base" }) ||
          a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" })
        );
        setSiblings(sorted);
      })
      .catch(() => {});
  }, [student]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.length > 1 ? router.back() : router.push("/students")}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">{student.firstName} {student.lastName}</h1>
              <span className={`badge ${getStatusColor(student.status)}`}>
                {getStatusLabel(student.status)}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Regjistruar: {formatDate(student.enrollDate)}
              {student.class && ` • Klasa ${student.class.name}`}
            </p>
          </div>
        </div>
        <Link href={`/students/${student.id}/edit`} className="btn-secondary">
          <Edit className="w-4 h-4" />
          Modifiko
        </Link>
        <button onClick={handleDelete} className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800">
          <Trash2 className="w-4 h-4" />
          Fshi
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Totali Paguar</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Borxhi i Mbetur</p>
          <p className={`text-xl font-bold ${totalDebt > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"}`}>
            {formatCurrency(totalDebt)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Numri i Pagesave</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{student.payments.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Personal Info */}
        <div className="lg:col-span-1 card p-5 space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            Të Dhënat Personale
          </h3>

          <InfoRow label="Emri i plotë" value={`${student.firstName} ${student.lastName}`} />
          <InfoRow label="Nr. Personal" value={student.personalNumber} mono />
          <InfoRow label="Datëlindja" value={student.birthDate ? formatDate(student.birthDate) : null} />
          {student.motherNumber && <InfoRow label="Nr. Amë" value={student.motherNumber} />}
          {student.diaryNumber && <InfoRow label="Nr. Ditar" value={student.diaryNumber} />}
          {student.class && (
            <InfoRow
              label="Klasa"
              value={`${student.class.name} — ${student.class.level}`}
              icon={<GraduationCap className="w-3.5 h-3.5 text-primary-500" />}
            />
          )}

          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prindi</h4>
            <InfoRow
              label="Emri"
              value={student.parentName}
              icon={<User className="w-3.5 h-3.5 text-slate-400" />}
            />
            <InfoRow
              label="Telefoni"
              value={student.parentPhone}
              icon={<Phone className="w-3.5 h-3.5 text-slate-400" />}
            />
            {student.guardian && <InfoRow label="Kujdestari" value={student.guardian} />}
            {student.address && (
              <InfoRow
                label="Adresa"
                value={student.address}
                icon={<MapPin className="w-3.5 h-3.5 text-slate-400" />}
              />
            )}
          </div>

          {student.notes && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Shënime</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{student.notes}</p>
            </div>
          )}

          {siblings.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Vëllezër / Motra
              </h4>
              <div className="space-y-1.5">
                {siblings.map(s => (
                  <Link
                    key={s.id}
                    href={`/students/${s.id}`}
                    className="flex items-center justify-between text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <span>{s.firstName} {s.lastName}</span>
                    {s.class && <span className="text-xs text-slate-400">{s.class.name}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payments & Invoices */}
        <div className="lg:col-span-2 space-y-5">
          {/* Payments */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="section-title flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                Pagesat
              </h3>
              <Link href={`/payments/new?studentId=${student.id}`} className="btn-primary text-xs">
                + Pagesë e re
              </Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {student.payments.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">Asnjë pagesë e regjistruar</p>
              ) : student.payments.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{p.category.name}</p>
                    <p className="text-xs text-slate-400">
                      Afati: {formatDate(p.dueDate)}
                      {p.paidDate && ` • Paguar: ${formatDate(p.paidDate)}`}
                      {p.method && ` • ${getStatusLabel(p.method)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                    {p.balance > 0 && (
                      <p className="text-xs text-red-500 mt-0.5">Borxh: {formatCurrency(p.balance)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Invoices */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="section-title flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Faturat
              </h3>
              <Link href={`/invoices/new?studentId=${student.id}`} className="btn-primary text-xs">
                + Faturë e re
              </Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {student.invoices.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">Asnjë faturë e krijuar</p>
              ) : student.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {getStatusLabel(inv.type)} #{inv.number}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(inv.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getStatusColor(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(inv.total)}
                    </span>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                    >
                      Shiko
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false, icon }: {
  label: string; value: string | null | undefined; mono?: boolean; icon?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1 ${mono ? "font-mono" : ""}`}>
        {icon}{value}
      </p>
    </div>
  );
}
