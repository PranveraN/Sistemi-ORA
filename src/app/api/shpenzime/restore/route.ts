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

interface ExcelRow { kategoriEmri: string; month: number; lloji: "ZYRE" | "BANKE"; amount: number }

/** Njëjta logjikë skanimi/formati si /api/shpenzime/import — vetëm kthen rreshtat, s'shkruan në DB. */
function parseShpenzimExcel(buf: Buffer): ExcelRow[] {
  const wb  = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][];
  if (!raw.length) throw new Error("Skedari është bosh");

  let hRow = -1;
  for (let ri = 0; ri < Math.min(5, raw.length); ri++) {
    const row = raw[ri] as unknown[];
    let found = 0;
    for (let c = 0; c < row.length; c++) if (parseMonth(String(row[c] ?? ""))) found++;
    if (found >= 4) { hRow = ri; break; }
  }
  if (hRow === -1) throw new Error("Nuk u gjetën muajt në skedar. Sigurohu që rreshti i parë ka emrat e muajve.");

  const subRow = (raw[hRow + 1] ?? []) as unknown[];
  const isZyreBanke = subRow.some(cell => {
    const v = String(cell ?? "").toLowerCase().trim();
    return v.includes("zyre") || v.includes("zyres") || v.includes("banke") || v.includes("bankes");
  });

  let monthCols: { col: number; month: number; lloji: "ZYRE" | "BANKE" }[] = [];
  let dataStartRow: number;

  if (isZyreBanke) {
    const monthRow = raw[hRow] as unknown[];
    let lastMonth = 0;
    for (let c = 0; c < subRow.length; c++) {
      const v = String(subRow[c] ?? "").toLowerCase().trim();
      const m = parseMonth(String(monthRow[c] ?? ""));
      if (m) lastMonth = m;
      if (v.includes("zyre") || v.includes("zyres")) monthCols.push({ col: c, month: lastMonth, lloji: "ZYRE" });
      else if (v.includes("banke") || v.includes("bankes")) monthCols.push({ col: c, month: lastMonth, lloji: "BANKE" });
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
  if (monthCols.length === 0) throw new Error("Nuk u gjetën kolona muajsh.");

  const firstMonthCol = Math.min(...monthCols.map(m => m.col));
  const catCol = Math.max(0, firstMonthCol - 1);

  const out: ExcelRow[] = [];
  for (let ri = dataStartRow; ri < raw.length; ri++) {
    const row = raw[ri] as unknown[];
    if (!row || row.length === 0) continue;
    const katEmriRaw = String(row[catCol] ?? "").trim();
    if (!katEmriRaw) continue;
    const lower = katEmriRaw.toLowerCase();
    if (lower.includes("total") || lower.includes("gjithsej")) continue;
    const isIncome = ["hyrat", "të hyrat", "te hyrat", "suficit", "deficit",
                      "terheqeje", "tërheqje", "arke", "arkë", "fitim"].some(w => lower.includes(w));
    if (isIncome) continue;

    for (const { col, month, lloji } of monthCols) {
      const amount = parseAmount(row[col]);
      if (!amount) continue;
      out.push({ kategoriEmri: katEmriRaw, month, lloji, amount });
    }
  }
  return out;
}

interface MatchRow {
  id: number; data: string; shuma: number; lloji: string;
  currentKategoriEmri: string;
  matchedKategoriEmri: string | null;
  candidates: string[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund ta kryejnë këtë veprim" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const kategoriaGabuar = String(form.get("kategoriaGabuar") || "").trim();
  const apply = form.get("apply") === "true";

  if (!file) return NextResponse.json({ error: "Skedari mungon" }, { status: 400 });
  if (!kategoriaGabuar) return NextResponse.json({ error: "Zgjidh kategorinë e gabuar" }, { status: 400 });

  let excelRows: ExcelRow[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    excelRows = parseShpenzimExcel(buf);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  const kategoriGabuarRow = await prisma.shpenzimKategori.findFirst({
    where: { emri: { equals: kategoriaGabuar } },
  });
  if (!kategoriGabuarRow) {
    return NextResponse.json({ error: `Kategoria "${kategoriaGabuar}" nuk u gjet` }, { status: 400 });
  }

  const allKategori = await prisma.shpenzimKategori.findMany();
  const affected = await prisma.shpenzim.findMany({
    where: { kategoriId: kategoriGabuarRow.id },
    orderBy: { data: "asc" },
  });

  const results: MatchRow[] = affected.map(row => {
    const month = row.data.getMonth() + 1;
    const candidateNames = [...new Set(
      excelRows
        .filter(r => r.month === month && r.lloji === row.lloji && Math.abs(r.amount - row.shuma) < 0.01)
        .map(r => r.kategoriEmri)
    )];
    return {
      id: row.id,
      data: row.data.toISOString().slice(0, 10),
      shuma: row.shuma,
      lloji: row.lloji,
      currentKategoriEmri: kategoriGabuarRow.emri,
      matchedKategoriEmri: candidateNames.length === 1 ? candidateNames[0] : null,
      candidates: candidateNames,
    };
  });

  if (!apply) {
    return NextResponse.json({ results, total: affected.length });
  }

  // ── Apliko ndryshimet ──
  const userId = parseInt((session.user as { id?: string })?.id ?? "0");
  const toApply = results.filter(r => r.matchedKategoriEmri && r.matchedKategoriEmri !== r.currentKategoriEmri);

  if (!toApply.length) {
    return NextResponse.json({ changed: 0, bulkActionId: null });
  }

  try {
    const bulkActionId = await prisma.$transaction(async tx => {
      const idsToChange = toApply.map(r => r.id);
      const snapshotRows = await tx.shpenzim.findMany({ where: { id: { in: idsToChange } } });

      const bulkAction = await tx.shpenzimBulkAction.create({
        data: {
          userId,
          action: "RESTORE",
          snapshot: JSON.stringify(snapshotRows),
          count: snapshotRows.length,
        },
      });

      for (const r of toApply) {
        let kat = allKategori.find(k => k.emri.trim().toLowerCase() === r.matchedKategoriEmri!.trim().toLowerCase());
        if (!kat) {
          kat = await tx.shpenzimKategori.create({ data: { emri: r.matchedKategoriEmri!, ngjyra: "#64748b", ikona: "" } });
          allKategori.push(kat);
        }
        await tx.shpenzim.update({ where: { id: r.id }, data: { kategoriId: kat.id } });
      }

      return bulkAction.id;
    });

    return NextResponse.json({ changed: toApply.length, bulkActionId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
