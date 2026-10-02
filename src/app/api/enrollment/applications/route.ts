import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import {
  getEnrollmentRules, effectiveEvidencaState, getClassSeats, gradeSeats, findDuplicates, ageYears,
} from "@/lib/enrollmentRules";

// Lista e Regjistrimeve — filtrimi, renditja, faqosja dhe numrat bëhen KËTU
// (në server). Vetëm stafi me modulin "Regjistrimet".
//   ?tab=PENDING|EVIDENCA|APPROVED|REJECTED|ALL (ose ?status=… si më parë)
//   &q=&grade=&year=&sort=old|new&page=&limit=&export=1

const TABS = ["PENDING", "EVIDENCA", "APPROVED", "REJECTED", "ALL"] as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const tabRaw = (sp.get("tab") || sp.get("status") || "PENDING").toUpperCase();
  const tab = (TABS as readonly string[]).includes(tabRaw) ? tabRaw : "PENDING";
  const q = (sp.get("q") || "").trim();
  const grade = parseInt(sp.get("grade") || "");
  const year = (sp.get("year") || "").trim();
  const sort = sp.get("sort") || (tab === "PENDING" || tab === "EVIDENCA" ? "old" : "new");
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "20")));
  const exportAll = sp.get("export") === "1";

  // Filtrat e përbashkët (vlejnë edhe për numrat e tabave/kartave)
  const base: Record<string, unknown> = { organizationId: orgId };
  if (Number.isFinite(grade)) base.desiredGrade = grade;
  if (year) base.schoolYear = year;
  if (q) {
    const parts = q.split(/\s+/);
    base.OR = [
      { firstName: { contains: q } }, { lastName: { contains: q } },
      { motherName: { contains: q } }, { fatherName: { contains: q } }, { guardianOtherName: { contains: q } },
      { motherPhone: { contains: q } }, { fatherPhone: { contains: q } }, { guardianOtherPhone: { contains: q } },
      { referenceNumber: { contains: q } },
      ...(parts.length >= 2 ? [{ AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] }] : []),
    ];
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [rules, seats, grouped, newThisWeek, yearsRaw] = await Promise.all([
    getEnrollmentRules(),
    getClassSeats(orgId),
    prisma.enrollmentApplication.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.enrollmentApplication.count({ where: { ...base, status: "PENDING", submittedAt: { gte: weekAgo } } }),
    prisma.enrollmentApplication.findMany({ where: { organizationId: orgId }, select: { schoolYear: true }, distinct: ["schoolYear"] }),
  ]);
  const countOf = (s: string) => grouped.find(g => g.status === s)?._count._all ?? 0;
  const counts = {
    PENDING: countOf("PENDING"),
    EVIDENCA: countOf("EVIDENCA"),
    APPROVED: countOf("APPROVED"),
    REJECTED: countOf("REJECTED"),
    ALL: grouped.reduce((s, g) => s + g._count._all, 0),
  };

  const where = { ...base, ...(tab !== "ALL" ? { status: tab } : {}) };
  const dateOrder = sort === "new" ? "desc" : "asc";
  const [total, apps] = await Promise.all([
    prisma.enrollmentApplication.count({ where }),
    prisma.enrollmentApplication.findMany({
      where,
      include: {
        class: { select: { name: true } },
        documents: { select: { docType: true } },
      },
      orderBy: [{ submittedAt: dateOrder }, { createdAt: dateOrder }],
      ...(exportAll ? {} : { skip: (page - 1) * limit, take: limit }),
    }),
  ]);

  const dups = await findDuplicates(orgId, apps);
  const now = Date.now();
  const rows = apps.map(a => {
    const applied = a.submittedAt ?? a.createdAt;
    const daysWaiting = Math.floor((now - new Date(applied).getTime()) / 86400000);
    const gs = gradeSeats(seats, a.desiredGrade);
    return {
      ...a,
      evidencaState: effectiveEvidencaState(a, rules),
      // Aplikim i vjetër i vendosur pa gjendje të ruajtur → shfaqet "—" (s'ka fakt për të treguar)
      evidencaLegacy: !a.evidencaState && !["PENDING", "EVIDENCA"].includes(a.status),
      evidencaStateStored: a.evidencaState,
      age: ageYears(a.birthDate),
      daysWaiting,
      overdue: a.status === "PENDING" && daysWaiting > rules.delayDays,
      gradeSeats: gs ? { free: gs.free, capacity: gs.capacity } : null,
      duplicate: dups.get(a.id) ?? null,
    };
  });

  return NextResponse.json({
    rows, total, page, limit, tab, sort,
    counts, newThisWeek,
    rules,
    seats: seats.filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name, "sq", { numeric: true })),
    years: yearsRaw.map(y => y.schoolYear).filter(Boolean).sort(),
  });
}
