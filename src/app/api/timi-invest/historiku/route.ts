import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Historiku i ndryshimeve të modulit TIMI (Faza 2) — VETËM LEXIM. ?q=&action=&limit=
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") || "";
  const limit = Math.min(1000, parseInt(sp.get("limit") ?? "") || 300);
  const rows = await prisma.timiAuditLog.findMany({
    where: { organizationId: u.organizationId ?? 1, ...(action ? { action } : {}) },
    orderBy: { id: "desc" }, take: limit,
  });
  // Emrat e fëmijëve (nga lidhja TIMI ose nxënësi)
  const tiIds = [...new Set(rows.map(r => r.tiId).filter((x): x is number => !!x))];
  const sIds = [...new Set(rows.map(r => r.studentId).filter((x): x is number => !!x))];
  const [links, studs] = await Promise.all([
    prisma.timiInvestStudent.findMany({ where: { id: { in: tiIds } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.student.findMany({ where: { id: { in: sIds } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const emri = (r: (typeof rows)[number]) => {
    const l = links.find(x => x.id === r.tiId); if (l) return `${l.firstName} ${l.lastName}`.trim();
    const s = studs.find(x => x.id === r.studentId); return s ? `${s.firstName} ${s.lastName}`.trim() : null;
  };
  return NextResponse.json({ rows: rows.map(r => ({ ...r, emri: emri(r) })) });
}
