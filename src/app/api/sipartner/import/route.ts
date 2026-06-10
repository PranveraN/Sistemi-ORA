import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Skedari mungon" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    function col(row: Record<string, unknown>, ...keys: string[]): string {
      const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
      for (const key of keys) {
        const v = lower[key.toLowerCase().trim()];
        if (v !== undefined && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    }

    let ok = 0, skip = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const emri     = col(row, "EMRI", "emri", "Emri i Biznesit", "Business Name");
      const nrFiskal = col(row, "NR. FISKAL", "NR FISKAL", "NUMRI FISKAL", "nrFiskal", "Fiscal Number");
      const adresa   = col(row, "ADRESA", "adresa", "Address");
      const telefoni = col(row, "TELEFONI", "telefoni", "Phone");
      const email    = col(row, "EMAIL", "email");

      if (!emri) { skip++; continue; }

      try {
        // Upsert — nëse ekziston me të njëjtin emër, përditëso
        const existing = await prisma.sipartner.findFirst({ where: { emri: { equals: emri } } });
        if (existing) {
          await prisma.sipartner.update({
            where: { id: existing.id },
            data: { nrFiskal: nrFiskal || existing.nrFiskal, adresa: adresa || existing.adresa, telefoni: telefoni || existing.telefoni, email: email || existing.email },
          });
        } else {
          await prisma.sipartner.create({
            data: { emri, nrFiskal: nrFiskal || null, adresa: adresa || null, telefoni: telefoni || null, email: email || null },
          });
        }
        ok++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Rreshti ${i + 2}: ${emri} — ${msg}`);
      }
    }

    return NextResponse.json({
      message: `U importuan/përditësuan ${ok} partnerë${skip > 0 ? `, ${skip} rreshta bosh u kapërcyen` : ""}${errors.length > 0 ? `, ${errors.length} gabime` : ""}.`,
      ok,
      skip,
      errors,
    });
  } catch {
    return NextResponse.json({ error: "Gabim gjatë leximit të skedarit." }, { status: 500 });
  }
}
