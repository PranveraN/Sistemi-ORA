import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// Muajt shqip → numër
const MUAJT: [string[], number][] = [
  [["jan"],          1],  [["shk","feb"],   2],  [["mar"],         3],
  [["pri","apr"],    4],  [["maj","may"],    5],  [["qer","jun"],   6],
  [["kor","jul"],    7],  [["gus","aug"],    8],  [["sht","sep"],   9],
  [["tet","okt","oct"],10],[["nen","nën","nov"],11],[["dhe","dec"],  12],
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form    = await req.formData();
    const file    = form.get("file") as File;
    const year    = parseInt(form.get("year") as string || String(new Date().getFullYear()));

    if (!file) return NextResponse.json({ error: "Skedari mungon" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb  = XLSX.read(buf, { type: "buffer", cellDates: false });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][];

    if (!raw.length) return NextResponse.json({ error: "Skedari është bosh" }, { status: 400 });

    // Gjej rreshtin e headerit (rreshi i parë me 4+ muaj)
    let hRow = -1;
    let monthCols: { col: number; month: number }[] = [];

    for (let ri = 0; ri < Math.min(5, raw.length); ri++) {
      const row = raw[ri] as unknown[];
      const found: { col: number; month: number }[] = [];
      for (let c = 0; c < row.length; c++) {
        const m = parseMonth(String(row[c] ?? ""));
        if (m) found.push({ col: c, month: m });
      }
      if (found.length >= 4) { hRow = ri; monthCols = found; break; }
    }

    if (hRow === -1 || monthCols.length === 0) {
      const sample = raw[0] ? (raw[0] as unknown[]).slice(0, 6).map(c => String(c ?? "")).join(" | ") : "";
      return NextResponse.json({
        error: `Nuk u gjetën muajt. Headeri: "${sample}". Sigurohu që rreshti i parë ka emrat e muajve (Janar, Shkurt...)`
      }, { status: 400 });
    }

    let created = 0, skipped = 0, errors = 0;

    for (let ri = hRow + 1; ri < raw.length; ri++) {
      const row = raw[ri] as unknown[];
      if (!row || row.length === 0) continue;

      const katEmriRaw = String(row[0] ?? "").trim();
      if (!katEmriRaw) continue;
      const lower = katEmriRaw.toLowerCase();
      if (lower.includes("total") || lower.includes("gjithsej")) continue;

      // Gjej ose krijo kategorinë (case-insensitive)
      const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM ShpenzimKategori WHERE lower(trim(emri)) = lower(trim(?)) LIMIT 1`,
        katEmriRaw
      );

      let katId: number;
      if (existing.length > 0) {
        katId = existing[0].id;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO ShpenzimKategori (emri, ngjyra, ikona, createdAt) VALUES (?, '#64748b', '', datetime('now'))`,
          katEmriRaw
        );
        const [nk] = await prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM ShpenzimKategori ORDER BY id DESC LIMIT 1`
        );
        katId = nk.id;
      }

      for (const { col, month } of monthCols) {
        const amount = parseAmount(row[col]);
        if (!amount) { skipped++; continue; }

        // Data si tekst i pastër: YYYY-MM-15
        const mm    = String(month).padStart(2, "0");
        const data  = `${year}-${mm}-15`;
        const ym    = `${year}-${mm}`;

        // Shmang duplikat (e njëjta kategori + muaj)
        const dup = await prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM Shpenzim WHERE kategoriId = ? AND substr(data,1,7) = ? LIMIT 1`,
          katId, ym
        );
        if (dup.length > 0) { skipped++; continue; }

        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO Shpenzim (kategoriId, shuma, pershkrim, marres, data, metoda, docType, referenca, createdAt, updatedAt)
             VALUES (?, ?, 'Import Excel', NULL, ?, 'BANK', 'FATURE', NULL, datetime('now'), datetime('now'))`,
            katId, amount, data
          );
          created++;
        } catch {
          errors++;
        }
      }
    }

    return NextResponse.json({
      created, skipped, errors,
      message: `✓ U importuan ${created} shpenzime${skipped > 0 ? ` (${skipped} bosh/duplikat)` : ""}${errors > 0 ? ` — ${errors} gabime` : ""}`
    });

  } catch (e) {
    return NextResponse.json({ error: `Gabim: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}
