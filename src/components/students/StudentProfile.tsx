"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { ChevronLeft, Edit, CreditCard, FileText, Phone, MapPin, User, GraduationCap, Users, Trash2, Printer } from "lucide-react";

interface Payment {
  id: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  method: string | null;
  dueDate: string;
  paidDate: string | null;
  description: string | null;
  category: { name: string };
}

// Faqet dedikuara për disa kategori — "Modifiko" te kartela e përmbledhur çon
// direkt te faqja ku ka planin e plotë (Dy Këste/Çdo Muaj/Këste Fleksibël).
const CATEGORY_LINKS: Record<string, string> = {
  "Shkollimi": "/shkollimi",
  "Librat & Shkollorja": "/eshkollori",
  "Ushqimi": "/ushqimi",
  "Librat e Anglishtes": "/librat",
  "Uniforma": "/uniforma/shitje",
};

interface CategoryPaymentGroup {
  categoryName: string;
  baseAmount: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  lastPaidDate: string | null;
}

function groupPaymentsByCategory(payments: Payment[]): CategoryPaymentGroup[] {
  const byCategory = new Map<string, Payment[]>();
  for (const p of payments) {
    const arr = byCategory.get(p.category.name) ?? [];
    arr.push(p);
    byCategory.set(p.category.name, arr);
  }
  const groups: CategoryPaymentGroup[] = [];
  for (const [categoryName, group] of byCategory) {
    // Këste Fleksibël (FLEX_HEADER + FLEX_PAY_N): header-i mban VETËM totalin
    // e vërtetë (amount/finalAmount) — çdo pagesë tjetër ka finalAmount = e
    // vetja (asnjë borxh individual). Mbledhja e thjeshtë e të gjithëve do ta
    // fryente totalin (header + çdo pagesë = shumëfishim), prandaj kur ka
    // header, përdoret VETËM ai për bazën/totalin.
    const header = group.find(p => p.description === "FLEX_HEADER");
    const baseAmount   = header ? header.amount      : group.reduce((s, p) => s + p.amount, 0);
    const finalAmount  = header ? header.finalAmount : group.reduce((s, p) => s + p.finalAmount, 0);
    const paidAmount   = group.reduce((s, p) => s + p.paidAmount, 0);
    const lastPaidDate = group.reduce<string | null>((max, p) => (p.paidDate && (!max || p.paidDate > max)) ? p.paidDate : max, null);
    groups.push({
      categoryName, baseAmount, finalAmount, paidAmount,
      balance: Math.max(0, finalAmount - paidAmount),
      lastPaidDate,
    });
  }
  return groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName, "sq"));
}

// Librat e Anglishtes (BookSale) dhe Uniforma (UniSale) s'i takojnë tabelës
// Payment — janë shitje (me artikuj/stok), jo pagesa me kategori — prandaj
// mblidhen veç dhe shtohen si "kategori" shtesë në pasqyrën e njëjtë, që të
// mos mungojnë nga historiku.
interface BookSale {
  id: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  saleDate: string;
}

interface UniSale {
  id: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  saleDate: string;
}

function salesToGroup(categoryName: string, sales: { totalAmount: number; paidAmount: number; saleDate: string }[]): CategoryPaymentGroup | null {
  if (sales.length === 0) return null;
  const baseAmount = sales.reduce((s, b) => s + b.totalAmount, 0);
  const paidAmount = sales.reduce((s, b) => s + b.paidAmount, 0);
  const lastPaidDate = sales.reduce<string | null>((max, b) => (!max || b.saleDate > max ? b.saleDate : max), null);
  return {
    categoryName,
    baseAmount,
    finalAmount: baseAmount,
    paidAmount,
    balance: Math.max(0, baseAmount - paidAmount),
    lastPaidDate,
  };
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
  fatherBirth: string | null;
  fatherProf: string | null;
  fatherEmail: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherBirth: string | null;
  motherProf: string | null;
  motherEmail: string | null;
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
  bookSales: BookSale[];
  uniSales: UniSale[];
}

const SCHOOL = {
  name:    "Akademia Ora",
  address: "Përroi i njelmët, Prishtinë",
  phone:   "+383 46 505 055",
  web:     "www.akademiaora.com",
};

// Ndërton dokumentin e printueshëm të historikut të plotë — përdor pikërisht
// të njëjtin model "HTML e vetë-mjaftueshme + stil inline" si Dëshmia e Pagesës
// (PaymentReceiptModal), JO kopjimin e innerHTML-it Tailwind të faqes (ai qasje
// pati shkaktuar printim krejtësisht të shformuar te faturat më herët).
function buildHistoryHTML(student: Student, categoryGroups: CategoryPaymentGroup[], totalPaid: number, totalDebt: number, origin: string): string {
  const dateStr = new Date().toLocaleDateString("sq-AL");
  const parentName = student.fatherName || student.motherName || student.parentName || "—";
  const phone = student.fatherPhone || student.motherPhone || student.parentPhone || "—";

  const rows = categoryGroups.map(g => `
    <tr>
      <td>${g.categoryName}</td>
      <td class="num">${formatCurrency(g.baseAmount)}</td>
      <td class="num">${formatCurrency(g.finalAmount)}</td>
      <td class="num paid">${formatCurrency(g.paidAmount)}</td>
      <td>${g.lastPaidDate ? formatDate(g.lastPaidDate) : "—"}</td>
      <td class="num ${g.balance > 0 ? "debt" : "ok"}">${g.balance > 0 ? formatCurrency(g.balance) : "&#10003; Pa borxh"}</td>
    </tr>`).join("");

  const invoiceRows = student.invoices.map(inv => `
    <tr>
      <td>${inv.number}</td>
      <td>${getStatusLabel(inv.type)}</td>
      <td>${formatDate(inv.createdAt)}</td>
      <td>${getStatusLabel(inv.status)}</td>
      <td class="num">${formatCurrency(inv.total)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Historiku — ${student.firstName} ${student.lastName}</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.header { display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; }
.logo { height:44px; width:auto; object-fit:contain; }
.school-name { font-size:16px; font-weight:800; color:#1e3a8a; }
.school-sub { font-size:9px; color:#64748b; margin-top:1px; }
.title-box { margin-left:auto; text-align:right; }
.title { font-size:14px; font-weight:800; color:#1e3a8a; text-transform:uppercase; letter-spacing:.04em; }
.title-sub { font-size:9px; color:#94a3b8; margin-top:2px; }
.divider { border:none; border-top:2px solid #e2e8f0; margin:8px 0 14px; }
.info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px 16px; margin-bottom:16px; font-size:10px; }
.info-row .lbl { color:#64748b; display:block; }
.info-row .val { font-weight:700; color:#0f172a; }
h2 { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#334155; margin:18px 0 6px; }
table { width:100%; border-collapse:collapse; font-size:10px; }
th { text-align:left; background:#f1f5f9; color:#475569; font-weight:700; padding:5px 8px; border-bottom:1px solid #e2e8f0; }
td { padding:5px 8px; border-bottom:1px solid #f1f5f9; }
.num { text-align:right; }
td.paid { color:#059669; font-weight:600; }
td.debt { color:#dc2626; font-weight:700; }
td.ok { color:#059669; font-weight:600; }
tfoot td { font-weight:800; border-top:2px solid #cbd5e1; border-bottom:none; padding-top:7px; }
.footer-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:44px; }
.sig-line { border-top:1px solid #94a3b8; margin-bottom:4px; margin-top:24px; }
.sig-lbl { font-size:8px; color:#64748b; text-align:center; }
.printed-at { font-size:8px; color:#cbd5e1; text-align:right; margin-top:20px; }
</style></head><body>
  <div class="header">
    <img src="${origin}/logo.png" class="logo" alt="" onerror="this.style.display='none'"/>
    <div>
      <div class="school-name">${SCHOOL.name}</div>
      <div class="school-sub">${SCHOOL.address} &bull; ${SCHOOL.phone}</div>
      <div class="school-sub">${SCHOOL.web}</div>
    </div>
    <div class="title-box">
      <div class="title">Historiku i Plotë</div>
      <div class="title-sub">${dateStr}</div>
    </div>
  </div>
  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-row"><span class="lbl">Nxënësi</span><span class="val">${student.firstName} ${student.lastName}</span></div>
    <div class="info-row"><span class="lbl">Klasa</span><span class="val">${student.class ? `${student.class.name} — ${student.class.level}` : "—"}</span></div>
    <div class="info-row"><span class="lbl">Nr. Personal</span><span class="val">${student.personalNumber || "—"}</span></div>
    <div class="info-row"><span class="lbl">Prindi</span><span class="val">${parentName}</span></div>
    <div class="info-row"><span class="lbl">Telefoni</span><span class="val">${phone}</span></div>
    <div class="info-row"><span class="lbl">Statusi</span><span class="val">${getStatusLabel(student.status)}</span></div>
  </div>

  <h2>Pagesat sipas Kategorisë</h2>
  <table>
    <thead><tr><th>Kategoria</th><th class="num">Çmimi bazë</th><th class="num">Me zbritje</th><th class="num">Pagesa</th><th>Data e pagesës</th><th class="num">Borxhi i mbetur</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:14px">Asnjë pagesë e regjistruar</td></tr>`}</tbody>
    <tfoot><tr><td colspan="3">TOTALI</td><td class="num paid">${formatCurrency(totalPaid)}</td><td></td><td class="num ${totalDebt > 0 ? "debt" : "ok"}">${totalDebt > 0 ? formatCurrency(totalDebt) : "&#10003; Pa borxh"}</td></tr></tfoot>
  </table>

  ${student.invoices.length > 0 ? `
  <h2>Faturat</h2>
  <table>
    <thead><tr><th>Nr.</th><th>Lloji</th><th>Data</th><th>Statusi</th><th class="num">Shuma</th></tr></thead>
    <tbody>${invoiceRows}</tbody>
  </table>` : ""}

  <div class="footer-grid">
    <div><div class="sig-line"></div><div class="sig-lbl">Nënshkrimi i prindit / nxënësit</div></div>
    <div><div class="sig-line"></div><div class="sig-lbl">Vula dhe nënshkrimi i shkollës</div></div>
  </div>
  <div class="printed-at">Printuar më ${dateStr}</div>

<script>window.onload=()=>{window.print();}</script>
</body></html>`;
}

export default function StudentProfile({ student }: { student: Student }) {
  const router = useRouter();
  const payments = student.payments;
  const bookGroup = salesToGroup("Librat e Anglishtes", student.bookSales);
  const uniGroup  = salesToGroup("Uniforma", student.uniSales);
  const categoryGroups = [...groupPaymentsByCategory(payments), ...(bookGroup ? [bookGroup] : []), ...(uniGroup ? [uniGroup] : [])]
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "sq"));
  // Totalet nxirren nga grupet (jo nga `payments` e papërpunuara si më parë), që
  // të përfshijnë edhe Librat e Anglishtes dhe të përputhen saktë me atë që
  // shfaqet më poshtë kartelë për kartelë.
  const totalDebt = categoryGroups.reduce((sum, g) => sum + g.balance, 0);
  const totalPaid = categoryGroups.reduce((sum, g) => sum + g.paidAmount, 0);

  async function handleDelete() {
    const ok = window.confirm(
      `Fshi përgjithmonë "${student.firstName} ${student.lastName}"?\n\nKJO VEPRIM NUK MUND TË KTHEHET — fshihen edhe të gjitha pagesat dhe faturat.`
    );
    if (!ok) return;
    await fetch(`/api/students/${student.id}?permanent=true`, { method: "DELETE" });
    router.push("/students");
    router.refresh();
  }

  function printHistory() {
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(buildHistoryHTML(student, categoryGroups, totalPaid, totalDebt, window.location.origin));
    win.document.close();
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
    <>
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
        <button onClick={printHistory} className="btn-secondary">
          <Printer className="w-4 h-4" />
          Printo Historinë
        </button>
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
          <p className="text-xs text-slate-400 mb-1">Kategori Pagesash</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{categoryGroups.length}</p>
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

          {/* Baba */}
          {(student.fatherName || student.fatherPhone) && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Babai
              </h4>
              {student.fatherName  && <InfoRow label="Emri"        value={student.fatherName} />}
              {student.fatherBirth && <InfoRow label="Datëlindja"  value={formatDate(student.fatherBirth)} />}
              {student.fatherProf  && <InfoRow label="Profesioni"  value={student.fatherProf} />}
              {student.fatherPhone && <InfoRow label="Telefoni"    value={student.fatherPhone} icon={<Phone className="w-3.5 h-3.5 text-slate-400" />} />}
              {student.fatherEmail && <InfoRow label="E-mail"      value={student.fatherEmail} />}
            </div>
          )}

          {/* Nëna */}
          {(student.motherName || student.motherPhone) && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-pink-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Nëna
              </h4>
              {student.motherName  && <InfoRow label="Emri"        value={student.motherName} />}
              {student.motherBirth && <InfoRow label="Datëlindja"  value={formatDate(student.motherBirth)} />}
              {student.motherProf  && <InfoRow label="Profesioni"  value={student.motherProf} />}
              {student.motherPhone && <InfoRow label="Telefoni"    value={student.motherPhone} icon={<Phone className="w-3.5 h-3.5 text-slate-400" />} />}
              {student.motherEmail && <InfoRow label="E-mail"      value={student.motherEmail} />}
            </div>
          )}

          {/* Fallback nëse nuk ka baba/nënë të regjistruar */}
          {!student.fatherName && !student.fatherPhone && !student.motherName && !student.motherPhone && student.parentName && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prindi</h4>
              <InfoRow label="Emri"    value={student.parentName} icon={<User className="w-3.5 h-3.5 text-slate-400" />} />
              <InfoRow label="Telefoni" value={student.parentPhone} icon={<Phone className="w-3.5 h-3.5 text-slate-400" />} />
            </div>
          )}

          {student.guardian && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <InfoRow label="Kujdestari" value={student.guardian} />
            </div>
          )}
          {student.address && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <InfoRow label="Adresa" value={student.address} icon={<MapPin className="w-3.5 h-3.5 text-slate-400" />} />
            </div>
          )}

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
              {categoryGroups.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">Asnjë pagesë e regjistruar</p>
              ) : categoryGroups.map(g => (
                <div key={g.categoryName} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{g.categoryName}</p>
                    {CATEGORY_LINKS[g.categoryName] && (
                      <Link href={CATEGORY_LINKS[g.categoryName]} className="text-primary-600 hover:underline text-xs font-medium">
                        Modifiko →
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Çmimi bazë</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(g.baseAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Me zbritje</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(g.finalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Pagesa</p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(g.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Data e pagesës</p>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {g.lastPaidDate ? formatDate(g.lastPaidDate) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Borxhi i mbetur</p>
                      <p className={`text-sm font-bold ${g.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-500"}`}>
                        {g.balance > 0 ? formatCurrency(g.balance) : "✓ Pa borxh"}
                      </p>
                    </div>
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
    </>
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
