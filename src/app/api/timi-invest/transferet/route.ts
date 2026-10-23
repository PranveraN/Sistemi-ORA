import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { TIMI_KOMISION_PCT, type NdarjaFemije } from "@/lib/timiPagesat";

// Lista e transfereve nga TIMI për modulin (Faza 3) — VETËM LEXIM: të ruajtura, të stornuara dhe draftet.
// ?viti=2026  ·  ?id=123 (një draft/transfer i vetëm për magjistarin)
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const id = parseInt(sp.get("id") ?? "");
  const viti = parseInt(sp.get("viti") ?? "") || currentSchoolYearStart();
  const rows = await prisma.timiPagese.findMany({
    where: { organizationId: u.organizationId ?? 1, ...(id ? { id } : { vitiShkollor: viti }) },
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });
  const setting = await prisma.setting.findUnique({ where: { key: "timiKomisionPct" } });
  return NextResponse.json({
    viti, komisionPct: parseFloat(setting?.value ?? "") || TIMI_KOMISION_PCT,
    transferet: rows.map(p => ({
      id: p.id, data: p.data, shumaCents: p.shumaCents, brutoCents: p.brutoCents, komisionCents: p.komisionCents, komisionPct: p.komisionPct,
      vitiShkollor: p.vitiShkollor, referenca: p.referenca, prindi: p.prindi, shenim: p.shenim, banka: p.banka,
      dokumenti: p.dokumenti, dokumentiEmri: p.dokumentiEmri, statusi: p.statusi,
      stornuar: !!p.deletedAt, stornuarAt: p.deletedAt, stornuarNga: p.deletedByName, stornoArsye: p.stornoArsye,
      mundRikthim: !!p.deletedAt && !!p.stornoSnapshot && p.statusi === "RUAJTUR", rikthyerAt: p.rikthyerAt,
      createdByName: p.createdByName, createdAt: p.createdAt,
      femijet: (JSON.parse(p.ndarja) as NdarjaFemije[]).map(f => ({ studentId: f.studentId, emri: f.emri, cents: f.cents })),
      draftData: p.statusi === "DRAFT" ? JSON.parse(p.draftData ?? "null") : null,
    })),
  });
}
