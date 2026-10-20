import * as XLSX from "xlsx";

// Porosia e uniformave (draft në shfletues) → Excel ose pamje për printim.
// Asgjë nga porosia s'ndryshon stokun, hyrjet apo shitjet.

export interface OrderLine { product: string; size: string; stock: number; qty: number }
export interface OrderMeta { date: string; supplier: string; note: string } // date: YYYY-MM-DD

/** Vetëm rreshtat me sasi > 0, të grupuar sipas produktit (radha e katalogut). */
export function groupOrder(lines: OrderLine[]) {
  const groups: { product: string; lines: OrderLine[]; total: number }[] = [];
  for (const l of lines.filter(x => x.qty > 0)) {
    let g = groups.find(x => x.product === l.product);
    if (!g) { g = { product: l.product, lines: [], total: 0 }; groups.push(g); }
    g.lines.push(l);
    g.total += l.qty;
  }
  return { groups, total: groups.reduce((s, g) => s + g.total, 0), count: groups.reduce((s, g) => s + g.lines.length, 0) };
}

const dmy = (ymd: string) => { const [y, m, d] = ymd.split("-"); return `${d}/${m}/${y}`; };

/** Rreshtat e fletës (përdoren edhe nga testet). */
export function orderSheetRows(lines: OrderLine[], meta: OrderMeta): (string | number)[][] {
  const { groups, total } = groupOrder(lines);
  const rows: (string | number)[][] = [
    ["Akademia Ora – Porosi uniformash"],
    ["Data:", dmy(meta.date)],
    ["Furnitori:", meta.supplier],
    ["Shënimi:", meta.note],
    [],
    ["Nr.", "Produkti", "Numri/Madhësia", "Stoku aktual", "Sasia", "Shënim"],
  ];
  let nr = 0;
  for (const g of groups) {
    for (const l of g.lines) rows.push([++nr, l.product, l.size, l.stock, l.qty, ""]);
    rows.push(["", `Nëntotali — ${g.product}`, "", "", g.total, ""]);
  }
  rows.push(["", "TOTALI", "", "", total, ""]);
  return rows;
}

export function downloadOrderExcel(lines: OrderLine[], meta: OrderMeta): void {
  const ws = XLSX.utils.aoa_to_sheet(orderSheetRows(lines, meta));
  ws["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 16 }, { wch: 13 }, { wch: 10 }, { wch: 28 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Porosia");
  XLSX.writeFile(wb, `Porosi_uniforma_${meta.date}.xlsx`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Pamja A4 e pastër (dritare e re) — gati për printim ose "Ruaj si PDF". */
export function printOrder(lines: OrderLine[], meta: OrderMeta): void {
  const { groups, total } = groupOrder(lines);
  let nr = 0;
  const body = groups.map(g => g.lines.map(l => `<tr><td>${++nr}</td><td>${esc(l.product)}</td><td>${esc(l.size)}</td><td class="r">${l.stock}</td><td class="r"><b>${l.qty}</b></td><td></td></tr>`).join("")
    + `<tr class="sub"><td></td><td colspan="3">Nëntotali — ${esc(g.product)}</td><td class="r">${g.total}</td><td></td></tr>`).join("");
  const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>Porosi uniformash ${esc(meta.date)}</title>
<style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#1e293b;font-size:12px}h1{font-size:18px;margin:0 0 4px}
.meta{margin:8px 0 14px;line-height:1.6}table{width:100%;border-collapse:collapse}th,td{border:1px solid #94a3b8;padding:5px 6px;text-align:left}
th{background:#ede9fe}.r{text-align:right}.sub td{background:#f8fafc;font-weight:bold}.tot td{background:#ede9fe;font-weight:bold;font-size:13px}
.foot{margin-top:28px;display:flex;justify-content:space-between}</style></head><body>
<h1>Akademia Ora – Porosi uniformash</h1>
<div class="meta">Data: <b>${dmy(meta.date)}</b>${meta.supplier ? `<br>Furnitori: <b>${esc(meta.supplier)}</b>` : ""}${meta.note ? `<br>Shënimi: ${esc(meta.note)}` : ""}</div>
<table><thead><tr><th>Nr.</th><th>Produkti</th><th>Numri/Madhësia</th><th class="r">Stoku aktual</th><th class="r">Sasia</th><th>Shënim</th></tr></thead>
<tbody>${body}<tr class="tot"><td></td><td colspan="3">TOTALI</td><td class="r">${total}</td><td></td></tr></tbody></table>
<div class="foot"><span>Përgatiti: ____________________</span><span>Nënshkrimi: ____________________</span></div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Lejo dritaret pop-up për të printuar."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
