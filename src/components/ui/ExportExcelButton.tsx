"use client";

import { Download } from "lucide-react";
import { exportToExcel, type ExportColumn } from "@/lib/exportExcel";

// Butoni i përbashkët "Eksporto Excel" — eksporton rreshtat e dhënë (lista siç shfaqet).
export default function ExportExcelButton<T>({ fileName, columns, rows, sheet, className = "btn-secondary text-sm", label = "Eksporto Excel" }: {
  fileName: string;
  columns: ExportColumn<T>[];
  rows: T[];
  sheet?: string;
  className?: string;
  label?: string;
}) {
  return (
    <button type="button" onClick={() => exportToExcel(fileName, columns, rows, sheet)} disabled={!rows.length}
      className={className} title="Eksporto listën siç shfaqet (me filtrat aktivë)">
      <Download className="w-4 h-4" aria-hidden /> {label}
    </button>
  );
}
