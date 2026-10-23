import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { pasqyraTimi } from "@/lib/timiModule";
import { TI_PREFIX, type NdarjaFemije } from "@/lib/timiPagesat";

// Kartela e një fëmije TIMI (Faza 2) — VETËM LEXIM. Shifrat = e njëjta llogaritje si Pasqyra.
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];
const TI_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];

export async function GET(req: NextRequest, { params }: { params: Promise<{ tiId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const orgId = u.organizationId ?? 1;
  const tiId = parseInt((await params).tiId) || 0;
  const viti = parseInt(req.nextUrl.searchParams.get("viti") ?? "") || currentSchoolYearStart();

  const link = await prisma.timiInvestStudent.findUnique({ where: { id: tiId } });
  if (!link) return NextResponse.json({ error: "Fëmija s'u gjet." }, { status: 404 });
  const student = link.studentId ? await prisma.student.findUnique({
    where: { id: link.studentId }, select: { id: true, firstName: true, lastName: true, parentName: true, status: true, class: { select: { name: true } } },
  }) : null;

  const rresht = link.studentId ? (await pasqyraTimi(prisma, orgId, viti)).rreshtat.find(r => r.tiId === tiId) ?? null : null;

  // Pagesat nga TIMI që e përfshijnë këtë fëmijë — edhe të stornuarat (shfaqen të vizatuara)
  const pagesat = link.studentId ? (await prisma.timiPagese.findMany({ where: { organizationId: orgId, statusi: "RUAJTUR" }, orderBy: [{ data: "desc" }, { id: "desc" }] }))
    .map(p => ({ p, f: (JSON.parse(p.ndarja) as NdarjaFemije[]).find(x => x.studentId === link.studentId) }))
    .filter(x => x.f)
    .map(({ p, f }) => ({
      id: p.id, data: p.data, referenca: p.referenca, prindi: p.prindi, vitiShkollor: p.vitiShkollor,
      shumaCents: p.shumaCents, brutoCents: p.brutoCents, komisionCents: p.komisionCents, femijeCents: f!.cents,
      femijeTjere: (JSON.parse(p.ndarja) as NdarjaFemije[]).filter(x => x.studentId !== link.studentId).map(x => x.emri),
      stornuar: !!p.deletedAt, stornuarAt: p.deletedAt, stornuarNga: p.deletedByName, stornoArsye: p.stornoArsye,
      mundRikthim: !!p.deletedAt && !!p.stornoSnapshot, rikthyerAt: p.rikthyerAt, rikthyerNga: p.rikthyerByName,
      createdByName: p.createdByName,
    })) : [];

  const cat = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId }, select: { id: true } });
  const muajt = link.studentId && cat ? (await prisma.payment.findMany({
    where: { organizationId: orgId, categoryId: cat.id, studentId: link.studentId, OR: TI_MONTHS.map((m, i) => ({ month: m, year: i < 4 ? viti : viti + 1 })) },
    select: { id: true, description: true, finalAmount: true, paidAmount: true, dueDate: true, paidDate: true, method: true, month: true, year: true },
  })).sort((a, b) => (a.year! * 100 + a.month!) - (b.year! * 100 + b.month!)) : [];

  const historiku = await prisma.timiAuditLog.findMany({
    where: { organizationId: orgId, OR: [{ tiId }, ...(link.studentId ? [{ studentId: link.studentId }] : [])] },
    orderBy: { id: "desc" }, take: 200,
  });

  return NextResponse.json({ viti, link, student, rresht, pagesat, muajt, tiPrefix: TI_PREFIX, historiku });
}
