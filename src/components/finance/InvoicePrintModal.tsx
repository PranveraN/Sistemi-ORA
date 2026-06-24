"use client";

import { useRef, useState } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, getStatusLabel, MONTHS } from "@/lib/utils";

interface Props {
  student: {
    id: number;
    firstName: string;
    lastName: string;
    class: { name: string } | null;
  };
  payment: {
    amount: number;
    finalAmount: number;
    paidAmount: number;
    balance: number;
    discount: number;
    discountType: string | null;
    scholarship: number;
    method: string | null;
    paidDate: string | null;
    dueDate: string;
    status: string;
  } | null;
  categoryName: string;
  month?: number;
  year: number;
  onClose: () => void;
}

export default function InvoicePrintModal({ student, payment, categoryName, month, year, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const invNumber = `FAT-${year}-${String(student.id).padStart(4, "0")}`;
  const today = new Date();
  const periodLabel = month ? `${MONTHS[month - 1]} ${year}` : String(year);

  const amount      = payment?.amount      ?? 0;
  const finalAmount = payment?.finalAmount ?? 0;
  const paidAmount  = payment?.paidAmount  ?? 0;
  const balance     = payment?.balance     ?? 0;
  const discount    = payment?.discount    ?? 0;
  const scholarship = payment?.scholarship ?? 0;
  const discountAmt = payment?.discountType === "percentage"
    ? (amount * discount) / 100
    : discount;

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;

    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const origin = window.location.origin;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="sq">
      <head>
        <meta charset="UTF-8"/>
        <title>Faturë — ${student.firstName} ${student.lastName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #fff; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .logo-wrap { display: flex; align-items: center; gap: 14px; }
          .logo-img { height: 52px; width: auto; object-fit: contain; }
          .school-name { font-size: 22px; font-weight: 800; color: #2563eb; }
          .school-sub  { font-size: 12px; color: #64748b; margin-top: 2px; }
          .inv-meta { text-align: right; }
          .inv-type { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .inv-num  { font-size: 13px; color: #64748b; margin-top: 4px; font-family: monospace; }
          .divider  { border: none; border-top: 2px solid #e2e8f0; margin: 0 0 24px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
          .info-box { background: #f8fafc; border-radius: 12px; padding: 16px; }
          .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
          .info-val   { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 3px; }
          .info-sub   { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          thead tr { background: #2563eb; }
          thead th { color: #fff; padding: 11px 14px; text-align: left; font-size: 12px; font-weight: 600; }
          thead th:last-child { text-align: right; }
          tbody tr:nth-child(even) { background: #f8fafc; }
          tbody td { padding: 11px 14px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
          tbody td:last-child { text-align: right; font-weight: 600; }
          .totals { margin-left: auto; width: 280px; }
          .total-row { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; color: #64748b; }
          .total-row.main { font-size: 16px; font-weight: 800; color: #2563eb; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 5px; }
          .status-box { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; }
          .status-dot { width: 8px; height: 8px; border-radius: 50%; }
          .status-dot.paid { background: #22c55e; }
          .status-dot.pending { background: #f59e0b; }
          .status-dot.partial { background: #3b82f6; }
          .status-dot.overdue { background: #ef4444; }
          .status-text { font-size: 12px; font-weight: 600; }
          .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
          .sig-line { border-top: 1px solid #cbd5e1; width: 160px; text-align: center; padding-top: 6px; font-size: 11px; color: #94a3b8; }
          .footer-note { font-size: 11px; color: #cbd5e1; text-align: center; }
          @media print {
            body { padding: 20px; }
            button { display: none !important; }
          }
        </style>
        <base href="${origin}/">
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  async function handlePDF() {
    setDownloadingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      // Logo
      try {
        const logoImg = await new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image(); img.crossOrigin = "anonymous";
          img.onload = () => res(img); img.onerror = rej;
          img.src = "/logo.png";
        });
        const canvas = document.createElement("canvas");
        canvas.width = logoImg.naturalWidth; canvas.height = logoImg.naturalHeight;
        canvas.getContext("2d")!.drawImage(logoImg, 0, 0);
        const logoH = 14;
        const logoW = Math.min(20, (logoImg.naturalWidth / logoImg.naturalHeight) * logoH);
        doc.addImage(canvas.toDataURL("image/png"), "PNG", 14, 11, logoW, logoH);
      } catch {
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(14, 12, 22, 18, 3, 3, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text("AO", 25, 23, { align: "center" });
      }

      doc.setTextColor(37, 99, 235);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("AKADEMIA ORA", 38, 19);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text("Shkollë Private", 38, 25);
      doc.text("Tel: +383 46 505 055", 38, 31);

      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text("FATURË", 196, 20, { align: "right" });
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text(`Nr: ${invNumber}`, 196, 27, { align: "right" });
      doc.text(`Data: ${formatDate(today)}`, 196, 33, { align: "right" });

      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 42, 196, 42);

      // Info boxes
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 48, 85, 38, 3, 3, "F");
      doc.roundedRect(107, 48, 89, 38, 3, 3, "F");

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "bold");
      doc.text("NXËNËSI", 20, 55);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.text(`${student.firstName} ${student.lastName}`, 20, 63);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      if (student.class) doc.text(`Klasa: ${student.class.name}`, 20, 69);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "bold");
      doc.text("PERIUDHA / DETAJET", 113, 55);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.text(`Kategoria: ${categoryName}`, 113, 63);
      doc.text(`Periudha: ${periodLabel}`, 113, 69);
      doc.text(`Afati: ${payment?.dueDate ? formatDate(payment.dueDate) : "—"}`, 113, 75);

      // Table
      const tableRows: (string | number)[][] = [
        [categoryName, periodLabel, "1", finalAmount.toFixed(2)],
      ];
      if (discountAmt > 0) tableRows.push(["Zbritja", "", "", `-${discountAmt.toFixed(2)}`]);
      if (scholarship  > 0) tableRows.push(["Bursa",   "", "", `-${scholarship.toFixed(2)}`]);

      autoTable(doc, {
        startY: 95,
        head: [["Përshkrimi", "Periudha", "Sasia", "Shuma (€)"]],
        body: tableRows,
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontSize: 10,
          fontStyle: "bold",
          halign: "left",
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 50, halign: "center" },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 36, halign: "right", fontStyle: "bold" },
        },
        bodyStyles: { fontSize: 10, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      const fy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // Totals
      doc.setDrawColor(226, 232, 240);
      doc.line(120, fy, 196, fy);

      if (paidAmount > 0) {
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("E paguar:", 130, fy + 8);
        doc.setTextColor(34, 197, 94);
        doc.setFont("helvetica", "bold");
        doc.text(`${paidAmount.toFixed(2)} €`, 196, fy + 8, { align: "right" });

        if (balance > 0) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text("Borxhi i mbetur:", 130, fy + 15);
          doc.setTextColor(239, 68, 68);
          doc.setFont("helvetica", "bold");
          doc.text(`${balance.toFixed(2)} €`, 196, fy + 15, { align: "right" });
        }
      }

      doc.setFontSize(13);
      doc.setTextColor(37, 99, 235);
      doc.setFont("helvetica", "bold");
      const totalY = paidAmount > 0 ? fy + 24 : fy + 10;
      doc.text("TOTALI:", 130, totalY);
      doc.text(`${finalAmount.toFixed(2)} €`, 196, totalY, { align: "right" });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.setFont("helvetica", "normal");
      doc.text(`Akademia Ora • ${invNumber} • ${formatDate(today)}`, 105, 285, { align: "center" });

      doc.save(`Fatura-${student.lastName}-${invNumber}.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  }

  const statusDotClass = {
    PAID: "paid", PARTIAL: "partial", OVERDUE: "overdue", PENDING: "pending"
  }[payment?.status || "PENDING"] || "pending";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Faturë — {student.firstName} {student.lastName}</span>
            <span className="text-xs font-mono text-slate-400">{invNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePDF}
              disabled={downloadingPdf}
              className="btn-secondary text-xs"
            >
              {downloadingPdf
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              PDF
            </button>
            <button onClick={handlePrint} className="btn-primary text-xs">
              <Printer className="w-3.5 h-3.5" />
              Printo
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice preview */}
        <div className="overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-900 p-4">
          <div ref={printRef} className="bg-white rounded-xl shadow p-8 max-w-[600px] mx-auto">

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Akademia Ora" className="h-14 w-auto object-contain" onError={e => { e.currentTarget.style.display = "none"; }} />
                <div>
                  <p className="font-black text-primary-600 text-xl leading-tight">AKADEMIA ORA</p>
                  <p className="text-xs text-slate-400">Shkollë Private</p>
                  <p className="text-xs text-slate-400">Tel: +383 46 505 055</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-800">FATURË</p>
                <p className="text-xs font-mono text-slate-400 mt-1">{invNumber}</p>
                <p className="text-xs text-slate-400 mt-0.5">Data: {formatDate(today)}</p>
              </div>
            </div>

            <hr className="border-slate-200 mb-5" />

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Nxënësi</p>
                <p className="font-bold text-slate-900 text-base">{student.firstName} {student.lastName}</p>
                {student.class && <p className="text-xs text-slate-500 mt-1">Klasa: {student.class.name}</p>}
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Detajet</p>
                <p className="text-sm text-slate-700 font-medium">{categoryName}</p>
                <p className="text-xs text-slate-500 mt-0.5">Periudha: {periodLabel}</p>
                <p className="text-xs text-slate-500">Afati: {payment?.dueDate ? formatDate(payment.dueDate) : "—"}</p>
                {payment && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-2 h-2 rounded-full bg-${statusDotClass === "paid" ? "green-500" : statusDotClass === "partial" ? "blue-500" : statusDotClass === "overdue" ? "red-500" : "amber-500"}`} />
                    <span className="text-xs font-semibold text-slate-600">{getStatusLabel(payment.status)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 mb-5">
              <table className="w-full text-sm">
                <thead className="bg-primary-600 text-white">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-xs">Përshkrimi</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-xs w-28">Periudha</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-xs w-32">Shuma</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-slate-800 font-medium">{categoryName}</td>
                    <td className="px-4 py-3 text-center text-slate-500 text-xs">{periodLabel}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(amount || finalAmount)}</td>
                  </tr>
                  {discountAmt > 0 && (
                    <tr className="bg-green-50">
                      <td className="px-4 py-2 text-green-700 text-xs" colSpan={2}>Zbritja {payment?.discountType === "percentage" ? `(${discount}%)` : ""}</td>
                      <td className="px-4 py-2 text-right text-green-700 font-semibold text-xs">- {formatCurrency(discountAmt)}</td>
                    </tr>
                  )}
                  {scholarship > 0 && (
                    <tr className="bg-blue-50">
                      <td className="px-4 py-2 text-blue-700 text-xs" colSpan={2}>Bursa</td>
                      <td className="px-4 py-2 text-right text-blue-700 font-semibold text-xs">- {formatCurrency(scholarship)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-60 space-y-1.5">
                {(discountAmt > 0 || scholarship > 0) && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Shuma origjinale:</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                )}
                {paidAmount > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>E paguar:</span>
                    <span className="font-semibold">{formatCurrency(paidAmount)}</span>
                  </div>
                )}
                {balance > 0 && (
                  <div className="flex justify-between text-xs text-red-500">
                    <span>Borxhi i mbetur:</span>
                    <span className="font-semibold">{formatCurrency(balance)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-primary-600 border-t border-slate-200 pt-2 mt-1">
                  <span>TOTALI:</span>
                  <span>{formatCurrency(finalAmount || 0)}</span>
                </div>
                {payment?.method && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Mënyra:</span>
                    <span>{getStatusLabel(payment.method)}</span>
                  </div>
                )}
                {payment?.paidDate && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Data e pagesës:</span>
                    <span>{formatDate(payment.paidDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Signature lines */}
            <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
              <div className="text-center">
                <div className="border-t border-slate-300 w-36 mb-1" />
                <p className="text-xs text-slate-400">Lëshuar nga</p>
              </div>
              <div className="text-center">
                <div className="border-t border-slate-300 w-36 mb-1" />
                <p className="text-xs text-slate-400">Nënshkrimi i Prindit</p>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-[10px] text-slate-300 mt-6">
              Akademia Ora • {invNumber} • {formatDate(today)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
