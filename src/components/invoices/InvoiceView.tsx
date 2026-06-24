"use client";

import Link from "next/link";
import { ChevronLeft, Printer, Download, Send } from "lucide-react";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { useRef, useState } from "react";

interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: number;
  number: string;
  type: string;
  status: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  dueDate: string | null;
  createdAt: string;
  notes: string | null;
  items: InvoiceItem[];
  student: {
    id: number;
    firstName: string;
    lastName: string;
    parentName: string;
    parentPhone: string;
    address: string | null;
    personalNumber: string;
    class: { name: string; level: string } | null;
  };
}

export default function InvoiceView({ invoice }: { invoice: Invoice }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdatingStatus(false);
    window.location.reload();
  }

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();

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
    } catch { /* fallback to text */ }

    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.setFont("helvetica", "bold");
    doc.text("AKADEMIA ORA", 38, 19);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text("Shkollë Private", 38, 25);
    doc.text("Tel: +383 46 505 055", 38, 31);

    // Invoice type
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    const typeLabel = invoice.type === "INVOICE" ? "FATURË" : invoice.type === "PROFORMA" ? "PROFATURË" : "OFERTË";
    doc.text(typeLabel, 150, 25, { align: "right" });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Nr: ${invoice.number}`, 190, 32, { align: "right" });
    doc.text(`Data: ${formatDate(invoice.createdAt)}`, 190, 38, { align: "right" });
    if (invoice.dueDate) {
      doc.text(`Afati: ${formatDate(invoice.dueDate)}`, 190, 44, { align: "right" });
    }

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 50, 190, 50);

    // Student info
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("NXËNËSI:", 20, 60);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(`${invoice.student.firstName} ${invoice.student.lastName}`, 20, 67);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Prindi: ${invoice.student.parentName}`, 20, 73);
    doc.text(`Tel: ${invoice.student.parentPhone}`, 20, 79);
    if (invoice.student.address) doc.text(`Adresa: ${invoice.student.address}`, 20, 85);
    if (invoice.student.class) {
      doc.text(`Klasa: ${invoice.student.class.name}`, 20, 91);
    }

    // Status
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("STATUSI:", 140, 60);
    doc.setTextColor(15, 23, 42);
    doc.text(getStatusLabel(invoice.status), 140, 67);

    // Table
    autoTable(doc, {
      startY: 100,
      head: [["Përshkrimi", "Sasia", "Çmimi (€)", "Totali (€)"]],
      body: invoice.items.map(item => [
        item.description,
        item.quantity.toString(),
        item.unitPrice.toLocaleString(),
        item.total.toLocaleString(),
      ]),
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 10, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 20, right: 20 },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Totals
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("Nëntotali:", 140, finalY);
    doc.setTextColor(15, 23, 42);
    doc.text(`${invoice.subtotal.toLocaleString()} €`, 190, finalY, { align: "right" });

    if (invoice.vatRate > 0) {
      doc.setTextColor(100, 116, 139);
      doc.text(`TVSH (${invoice.vatRate}%):`, 140, finalY + 6);
      doc.setTextColor(15, 23, 42);
      doc.text(`${invoice.vatAmount.toLocaleString()} €`, 190, finalY + 6, { align: "right" });
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(140, finalY + 10, 190, finalY + 10);

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.setFont("helvetica", "bold");
    doc.text("TOTALI:", 140, finalY + 17);
    doc.text(`${invoice.total.toLocaleString()} €`, 190, finalY + 17, { align: "right" });

    if (invoice.notes) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Shënime:", 20, finalY + 30);
      doc.setTextColor(15, 23, 42);
      doc.text(invoice.notes, 20, finalY + 36);
    }

    doc.save(`${invoice.number}.pdf`);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/invoices" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{getStatusLabel(invoice.type)} #{invoice.number}</h1>
              <span className={`badge ${getStatusColor(invoice.status)}`}>{getStatusLabel(invoice.status)}</span>
            </div>
            <p className="text-sm text-slate-400">
              {formatDate(invoice.createdAt)}
              {invoice.dueDate && ` • Afati: ${formatDate(invoice.dueDate)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "DRAFT" && (
            <button
              onClick={() => updateStatus("SENT")}
              disabled={updatingStatus}
              className="btn-secondary"
            >
              <Send className="w-4 h-4" />
              Shëno si Dërguar
            </button>
          )}
          {invoice.status === "SENT" && (
            <button
              onClick={() => updateStatus("PAID")}
              disabled={updatingStatus}
              className="btn-primary"
            >
              Shëno si Paguar
            </button>
          )}
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="w-4 h-4" />
            Printo
          </button>
          <button onClick={exportPDF} className="btn-primary">
            <Download className="w-4 h-4" />
            Shkarko PDF
          </button>
        </div>
      </div>

      {/* Invoice document */}
      <div ref={printRef} className="card p-8 print:shadow-none print:border-none">
        {/* Invoice header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img src="/logo.png" alt="Akademia Ora" className="h-12 w-auto object-contain" onError={e => { e.currentTarget.style.display = "none"; }} />
              <div>
                <h2 className="text-xl font-bold text-primary-600">AKADEMIA ORA</h2>
                <p className="text-xs text-slate-400">Shkollë Private</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">Tel: +383 46 505 055</p>
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">
              {invoice.type === "INVOICE" ? "FATURË" : invoice.type === "PROFORMA" ? "PROFATURË" : "OFERTË"}
            </h3>
            <p className="text-slate-500 text-sm font-mono">#{invoice.number}</p>
            <p className="text-slate-400 text-xs mt-1">Data: {formatDate(invoice.createdAt)}</p>
            {invoice.dueDate && (
              <p className="text-slate-400 text-xs">Afati: {formatDate(invoice.dueDate)}</p>
            )}
          </div>
        </div>

        {/* Student info */}
        <div className="grid grid-cols-2 gap-6 mb-8 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">NXËNËSI</p>
            <p className="font-bold text-slate-900 dark:text-white text-lg">
              {invoice.student.firstName} {invoice.student.lastName}
            </p>
            <p className="text-sm text-slate-500">Prindi: {invoice.student.parentName}</p>
            <p className="text-sm text-slate-500">Tel: {invoice.student.parentPhone}</p>
            {invoice.student.address && (
              <p className="text-sm text-slate-500">{invoice.student.address}</p>
            )}
            {invoice.student.class && (
              <p className="text-sm text-slate-500">Klasa: {invoice.student.class.name}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">STATUSI</p>
            <span className={`badge text-sm ${getStatusColor(invoice.status)}`}>
              {getStatusLabel(invoice.status)}
            </span>
            <p className="text-xs text-slate-400 mt-2">Nr. Personal: {invoice.student.personalNumber}</p>
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
          <table className="w-full">
            <thead className="bg-primary-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Përshkrimi</th>
                <th className="px-4 py-3 text-center text-sm font-semibold w-20">Sasia</th>
                <th className="px-4 py-3 text-right text-sm font-semibold w-36">Çmimi</th>
                <th className="px-4 py-3 text-right text-sm font-semibold w-36">Totali</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {invoice.items.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-800/30"}>
                  <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-center text-slate-600 dark:text-slate-300">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
                    {item.unitPrice.toLocaleString()} €
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800 dark:text-slate-200">
                    {item.total.toLocaleString()} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Nëntotali:</span>
              <span>{invoice.subtotal.toLocaleString()} €</span>
            </div>
            {invoice.vatRate > 0 && (
              <div className="flex justify-between text-sm text-slate-500">
                <span>TVSH ({invoice.vatRate}%):</span>
                <span>{invoice.vatAmount.toLocaleString()} €</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-primary-600 border-t border-slate-200 dark:border-slate-600 pt-2">
              <span>TOTALI:</span>
              <span>{invoice.total.toLocaleString()} €</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">SHËNIME</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{invoice.notes}</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
          <p className="text-xs text-slate-400">
            Akademia Ora • Sistemi i Menaxhimit • {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
