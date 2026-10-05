import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { oraAccess } from "@/ora/access";
import { studentsMatching } from "@/ora/tools/students";

// "Eksporto" nga përgjigjja e Orës — e njëjta listë nxënësish (filtrat e
// përdorur), si CSV që hapet në Excel. Vetëm me modulin "students".
// Pa telefona apo nr. personal.
export async function GET(req: NextRequest) {
  const access = await oraAccess(await auth());
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!access.ctx.hasModule("students")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  let filters: Record<string, unknown> = {};
  try { filters = JSON.parse(req.nextUrl.searchParams.get("f") ?? "{}"); } catch { /* filtrat parazgjedhje */ }
  const r = await studentsMatching(filters, access.ctx);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });

  const esc = (v: unknown) => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const money = (n: number) => n.toFixed(2).replace(".", ",");
  const lines = [
    ["Nxënësi", "Klasa", "Prindi", "Statusi", "Çmimi", "Paguar", "Mbetja"].join(";"),
    ...r.rows.sort((a, b) => a.name.localeCompare(b.name, "sq")).map(x =>
      [x.name, x.className ?? "", x.parentName ?? "", x.statusLabel, money(x.final), money(x.paid), money(x.balance)].map(esc).join(";")),
    "",
    esc(`Filtrat: ${r.source}`),
  ];
  const body = "﻿" + lines.join("\r\n"); // BOM → Excel i lexon saktë ë/ç
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ora-nxenesit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
