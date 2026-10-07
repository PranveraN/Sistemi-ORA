import * as XLSX from "xlsx";

// Eksporti i përbashkët i listave në Excel — eksporton saktë atë që shihet në
// listë (rreshtat e filtruar), me kolonat e dhëna. Vetëm lexim, në shfletues.

export type Cell = string | number | null | undefined;
export interface ExportColumn<T> { header: string; value: (row: T) => Cell; width?: number }

/** "15/04/2026" — e njëjta formë si në listat e sistemit. */
export function xlDate(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function exportToExcel<T>(fileBase: string, columns: ExportColumn<T>[], rows: T[], sheet = "Lista"): boolean {
  if (!rows.length) {
    alert("Lista është bosh — s'ka asgjë për të eksportuar.");
    return false;
  }
  const data: Cell[][] = [columns.map(c => c.header), ...rows.map(r => columns.map(c => {
    const v = c.value(r);
    return v === null || v === undefined ? "" : v;
  }))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = columns.map(c => ({ wch: c.width ?? Math.min(40, Math.max(10, c.header.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
  const stamp = xlDate(new Date()).replace(/\//g, "-");
  XLSX.writeFile(wb, `${fileBase.replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${stamp}.xlsx`);
  return true;
}
