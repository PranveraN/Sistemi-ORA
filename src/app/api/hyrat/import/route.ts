import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const MUAJT: [string[], number][] = [
  [["jan"],              1], [["shk","feb"],      2], [["mar"],            3],
  [["pri","apr"],        4], [["maj","may"],       5], [["qer","jun"],      6],
  [["kor","jul"],        7], [["gus","aug"],       8], [["sht","sep"],      9],
  [["tet","okt","oct"], 10], [["nen","nën","nov"], 11], [["dhj","dhe","dec"], 12],
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
    const form = await req.formData();
    const file = form.get("file") as File;
    const vit  = parseInt(form.get("vit") as string || String(new Date().getFullYear()));
    const onlyMuaj = form.get("muaj") ? parseInt(form.get("muaj") as string) : null;

    if (!file) return NextResponse.json({ error: "Skedari mungon" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb  = XLSX.read(buf, { type: "buffer", cellDates: false });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][];

    if (!raw.length) return NextResponse.json({ error: "Skedari është bosh" }, { status: 400 });

    // Gjej rreshtin e header-it me muajt
    let hRow = -1;
    let monthCols: { col: number; month: number }[] = [];

    for (let ri = 0; ri < Math.min(5, raw.length); ri++) {
      const row = raw[ri] as unknown[];
      const found: { col: number; month: number }[] = [];
      for (let c = 0; c < row.length; c++) {
        const m = parseMonth(String(row[c] ?? ""));
        if (m) found.push({ col: c, month: m });
      }
      if (found.length >= 2) { hRow = ri; monthCols = found; break; }
    }

    if (hRow === -1) {
      return NextResponse.json({
        error: "Nuk u gjetën muajt. Sigurohu që headeri ka emrat e muajve (Janar, Shkurt...)."
      }, { status: 400 });
    }

    const firstMonthCol = Math.min(...monthCols.map(m => m.col));
    const catCol = Math.max(0, firstMonthCol - 1);

    let created = 0, skipped = 0, errors = 0;

    for (let ri = hRow + 1; ri < raw.length; ri++) {
      const row = raw[ri] as unknown[];
      if (!row || row.length === 0) continue;

      const paguesit = String(row[catCol] ?? "").trim();
      if (!paguesit) continue;
      const lower = paguesit.toLowerCase();
      if (lower.includes("total") || lower.includes("gjithsej") || lower.includes("totali")) continue;

      for (const { col, month } of monthCols) {
        if (onlyMuaj !== null && month !== onlyMuaj) { skipped++; continue; }

        const amount = parseAmount(row[col]);
        if (!amount) { skipped++; continue; }

        // Kalo duplikatin (e njëjta pagë e paguesit për këtë muaj+vit)
        const dup = await prisma.hyra.findFirst({
          where: { paguesit, muaj: month, vit },
        });
        if (dup) { skipped++; continue; }

        try {
          await prisma.hyra.create({
            data: {
              paguesit,
              shuma:     amount,
              kategoria: "SHKOLLIMI",
              muaj:      month,
              vit,
              metoda:    "BANK",
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
      message: `✓ U importuan ${created} të hyra${skipped > 0 ? ` (${skipped} bosh/duplikat)` : ""}${errors > 0 ? ` — ${errors} gabime` : ""}`,
    });

  } catch (e) {
    return NextResponse.json({ error: `Gabim: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}
