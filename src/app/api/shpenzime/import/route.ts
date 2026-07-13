import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const MUAJT: [string[], number][] = [
  [["jan"],          1],  [["shk","feb"],   2],  [["mar"],         3],
  [["pri","apr"],    4],  [["maj","may"],    5],  [["qer","jun"],   6],
  [["kor","jul"],    7],  [["gus","aug"],    8],  [["sht","sep"],   9],
  [["tet","okt","oct"],10],[["nen","nën","nov"],11],[["dhj","dhe","dec"],12],
];

function parseMonth(header: string): number | null {
  if (!header) return null;
  const clean = header.toLowerCase().replace(/[0-9\s\.\-\/]/g, "").replace(/[^a-zëç]/g, "").slice(0, 4);
  if (!clean) return null;
  for (const [prefixes, num] of MUAJT) {
    for (const p of prefixes) {
      if (clean.startsWith(p)) return num;
    }
  }
  return null;
}

function parseAmount(val: unknown): number | null {
  if (val === null || val === undefined || String(val).trim() === "") return null;
  const s = String(val).replace(/[€\s]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100;
}

function colIdx(headers: string[], ...keys: string[]): number {
  for (const key of keys) {
    const i = headers.findIndex(h => h.includes(key));
    if (i !== -1) return i;
  }
  return -1;
}

function strVal(row: unknown[], i: number): string | null {
  if (i < 0) return null;
  const v = String(row[i] ?? "").trim();
  return v && v !== "—" ? v : null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const year = parseInt(form.get("year") as string || String(new Date().getFullYear()));
    const onlyMonth = form.get("month") ? parseInt(form.get("month") as string) : null;

    if (!file) return NextResponse.json({ error: "Skedari mungon" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb  = XLSX.read(buf, { type: "buffer", cellDates: false });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][];

    if (!raw.length) return NextResponse.json({ error: "Skedari është bosh" }, { status: 400 });

    // Detekto formatin — nëse rreshti i parë ka kolonë "Data" + "Kategoria" = format listë-faturash
    const firstRowHeaders = (raw[0] as unknown[]).map(h => String(h ?? "").toLowerCase().trim());
    const hasDataCol     = firstRowHeaders.some(h => h === "data" || h === "date");
    const hasKategoriCol = firstRowHeaders.some(h => h.startsWith("kategori") || h === "category");

    if (hasDataCol && hasKategoriCol) {
      return importListFormat(raw, firstRowHeaders);
    } else {
      return importBudgetFormat(raw, year, onlyMonth);
    }
  } catch (e) {
    return NextResponse.json({ error: `Gabim: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}

// ── Format listë-faturash ────────────────────────────────────────────────────
// Rreshti 1 = headers: Data | Kategoria | Nr.Fiskal | Nr.Faturës | EmriBiznesit | Shuma | Metoda | Lloji | Pershkrim
async function importListFormat(raw: unknown[][], headers: string[]): Promise<NextResponse> {
  const iData    = colIdx(headers, "data", "date");
  const iKat     = colIdx(headers, "kategori");
  const iShuma   = colIdx(headers, "shuma", "amount");
  const iFiskal  = colIdx(headers, "fiskal");
  const iFature  = colIdx(headers, "fatur");
  const iEmri    = colIdx(headers, "emri biznesit", "emri", "furnitor");
  const iMetoda  = colIdx(headers, "metoda", "method");
  const iLloji   = colIdx(headers, "lloji", "type");
  const iPersh   = colIdx(headers, "pershkrim", "pershkrimi", "description");
  const iDocType = colIdx(headers, "lloji dokumentit", "doctype");

  if (iData < 0 || iKat < 0 || iShuma < 0) {
    return NextResponse.json({ error: "Kolona të detyrueshme mungojnë: Data, Kategoria, Shuma" }, { status: 400 });
  }

  const allKategori = await prisma.shpenzimKategori.findMany();
  let created = 0, skipped = 0, errors = 0;

  for (let ri = 1; ri < raw.length; ri++) {
    const row = raw[ri] as unknown[];
    if (!row || row.length === 0) continue;

    const katEmri = strVal(row, iKat);
    const amount  = parseAmount(row[iShuma]);
    if (!katEmri || !amount) { skipped++; continue; }

    // Data — mund të jetë string ose numër serial Excel
    let dataVal = row[iData];
    let date: Date;
    if (typeof dataVal === "number") {
      // Excel serial date
      date = XLSX.SSF.parse_date_code(dataVal) as unknown as Date;
      const d = XLSX.SSF.parse_date_code(dataVal) as { y: number; m: number; d: number };
      date = new Date(d.y, d.m - 1, d.d);
    } else {
      dataVal = String(dataVal ?? "").replace(/\//g, "-");
      date = new Date(dataVal as string);
      if (isNaN(date.getTime())) { skipped++; continue; }
    }

    let kategori = allKategori.find(k => k.emri.trim().toLowerCase() === katEmri.toLowerCase());
    if (!kategori) {
      kategori = await prisma.shpenzimKategori.create({ data: { emri: katEmri, ngjyra: "#64748b", ikona: "" } });
      allKategori.push(kategori);
    }

    const metodaRaw = strVal(row, iMetoda)?.toUpperCase() || "CASH";
    const metoda    = ["CASH","BANK","CARD","ONLINE"].includes(metodaRaw) ? metodaRaw : "CASH";
    const llojiRaw  = strVal(row, iLloji)?.toUpperCase() || "ZYRE";
    const lloji     = llojiRaw.includes("BANK") ? "BANKE" : "ZYRE";
    const docTypeRaw = strVal(row, iDocType)?.toUpperCase() || "FATURE";
    const docType   = ["FATURE","KUPON"].includes(docTypeRaw) ? docTypeRaw : "FATURE";

    try {
      await prisma.shpenzim.create({
        data: {
          kategoriId:   kategori.id,
          shuma:        Math.round(amount * 100) / 100,
          pershkrim:    strVal(row, iPersh) || "Import Excel",
          data:         date,
          metoda,
          docType,
          lloji,
          nrFiskal:     strVal(row, iFiskal),
          nrFature:     strVal(row, iFature),
          emriBiznesit: strVal(row, iEmri),
        },
      });
      created++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    created, skipped, errors,
    message: `✓ U importuan ${created} fatura${skipped > 0 ? ` (${skipped} bosh/kalohen)` : ""}${errors > 0 ? ` — ${errors} gabime` : ""}`,
  });
}

// ── Format buxhet (ekzistues) ────────────────────────────────────────────────
async function importBudgetFormat(raw: unknown[][], year: number, onlyMonth: number | null): Promise<NextResponse> {
  let hRow = -1;
  let monthCols: { col: number; month: number; lloji: "ZYRE" | "BANKE" }[] = [];
  let dataStartRow = -1;

  for (let ri = 0; ri < Math.min(5, raw.length); ri++) {
    const row = raw[ri] as unknown[];
    const found: { col: number; month: number }[] = [];
    for (let c = 0; c < row.length; c++) {
      const m = parseMonth(String(row[c] ?? ""));
      if (m) found.push({ col: c, month: m });
    }
    if (found.length >= 4) { hRow = ri; break; }
  }

  if (hRow === -1) {
    const sample = raw[0] ? (raw[0] as unknown[]).slice(0, 6).map(c => String(c ?? "")).join(" | ") : "";
    return NextResponse.json({
      error: `Nuk u gjetën muajt. Headeri: "${sample}". Sigurohu që rreshti i parë ka emrat e muajve.`
    }, { status: 400 });
  }

  const subRow = (raw[hRow + 1] ?? []) as unknown[];
  const isZyreBanke = subRow.some(cell => {
    const v = String(cell ?? "").toLowerCase().trim();
    return v.includes("zyre") || v.includes("zyres") || v.includes("banke") || v.includes("bankes");
  });

  if (isZyreBanke) {
    const monthRow = raw[hRow] as unknown[];
    let lastMonth = 0;
    for (let c = 0; c < subRow.length; c++) {
      const v = String(subRow[c] ?? "").toLowerCase().trim();
      const m = parseMonth(String(monthRow[c] ?? ""));
      if (m) lastMonth = m;
      if (v.includes("zyre") || v.includes("zyres")) {
        monthCols.push({ col: c, month: lastMonth, lloji: "ZYRE" });
      } else if (v.includes("banke") || v.includes("bankes")) {
        monthCols.push({ col: c, month: lastMonth, lloji: "BANKE" });
      }
    }
    dataStartRow = hRow + 2;
  } else {
    const row = raw[hRow] as unknown[];
    for (let c = 0; c < row.length; c++) {
      const m = parseMonth(String(row[c] ?? ""));
      if (m) monthCols.push({ col: c, month: m, lloji: "ZYRE" });
    }
    dataStartRow = hRow + 1;
  }

  if (monthCols.length === 0) {
    return NextResponse.json({ error: "Nuk u gjetën kolona muajsh." }, { status: 400 });
  }

  const firstMonthCol = Math.min(...monthCols.map(m => m.col));
  const catCol = Math.max(0, firstMonthCol - 1);

  const allKategori = await prisma.shpenzimKategori.findMany();
  let created = 0, skipped = 0, errors = 0;

  for (let ri = dataStartRow; ri < raw.length; ri++) {
    const row = raw[ri] as unknown[];
    if (!row || row.length === 0) continue;

    const katEmriRaw = String(row[catCol] ?? "").trim();
    if (!katEmriRaw) continue;
    const lower = katEmriRaw.toLowerCase();
    if (lower.includes("total") || lower.includes("gjithsej")) continue;

    const isIncome = ["hyrat", "të hyrat", "te hyrat", "suficit", "deficit",
                      "terheqeje", "tërheqje", "arke", "arkë", "fitim"].some(w => lower.includes(w));
    if (isIncome) { skipped++; continue; }

    let kategori = allKategori.find(k => k.emri.trim().toLowerCase() === katEmriRaw.toLowerCase());
    if (!kategori) {
      kategori = await prisma.shpenzimKategori.create({ data: { emri: katEmriRaw, ngjyra: "#64748b", ikona: "" } });
      allKategori.push(kategori);
    }

    for (const { col, month, lloji } of monthCols) {
      if (onlyMonth !== null && month !== onlyMonth) { skipped++; continue; }

      const amount = parseAmount(row[col]);
      if (!amount) { skipped++; continue; }

      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth   = new Date(year, month,     0, 23, 59, 59);

      const dup = await prisma.shpenzim.findFirst({
        where: { kategoriId: kategori.id, lloji, data: { gte: startOfMonth, lte: endOfMonth } },
      });
      if (dup) { skipped++; continue; }

      try {
        await prisma.shpenzim.create({
          data: {
            kategoriId: kategori.id,
            shuma:      Math.round(amount * 100) / 100,
            pershkrim:  "Import Excel",
            data:       new Date(year, month - 1, 15),
            metoda:     lloji === "BANKE" ? "BANK" : "CASH",
            docType:    "FATURE",
            lloji,
          },
        });
        created++;
      } catch {
        errors++;
      }
    }
  }

  return NextResponse.json({
    created, skipped, errors,
    message: `✓ U importuan ${created} shpenzime${skipped > 0 ? ` (${skipped} bosh/duplikat)` : ""}${errors > 0 ? ` — ${errors} gabime` : ""}`,
  });
}
