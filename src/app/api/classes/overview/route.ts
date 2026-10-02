import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CAPACITY, currentAcademicYear } from "@/lib/classYears";
import { computeStudentFinanceRows } from "@/lib/studentFinanceRows";
import { activeInAcademicYear, canViewSpecialCare, sessionHasModule } from "@/lib/specialCarePermissions";

// Pasqyra e Klasave për një vit akademik — VETËM LEXIM.
//   • Viti aktual  → klasat reale (të editueshme), me numrat e tanishëm.
//   • Vit i kaluar → fotografitë e ruajtura në kalimin e vitit (ClassYearSnapshot),
//                    ose — për vitet para këtij ndryshimi — nga StudentYearHistory
//                    (emri i klasës + numri i nxënësve, pa mësues).
//   • Vit i ardhshëm → bosh ("Kalo në vitin e ri").
// "Me borxh" vjen nga computeStudentFinanceRows (i njëjti burim si faqja Nxënësit).
// Numri i "kujdesit të veçantë" kthehet VETËM për rolet me leje.

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const role = (session.user as { role?: string }).role;
  const showCare = canViewSpecialCare(role);
  // Numri "me borxh" është e dhënë financiare — vetëm me modulin "Nxënësit"
  const showDebt = sessionHasModule(session, "students");

  const current = await currentAcademicYear(orgId);
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || current;

  if (year > current) {
    return NextResponse.json({ year, current, mode: "future", debtVisible: showDebt, classes: [], specialCareVisible: showCare });
  }

  if (year === current) {
    const [classes, finance, care] = await Promise.all([
      prisma.class.findMany({ where: { organizationId: orgId } }),
      computeStudentFinanceRows({ organizationId: orgId, status: "ACTIVE" }, { year, yearType: "academic" }),
      showCare
        ? prisma.studentSpecialCare.findMany({
            where: { organizationId: orgId, student: { status: "ACTIVE" } },
            select: { startDate: true, endDate: true, student: { select: { classId: true } } },
          })
        : Promise.resolve([]),
    ]);
    const stats = new Map<number, { students: number; debt: number }>();
    for (const r of finance.rows) {
      if (r.classId == null) continue;
      const s = stats.get(r.classId) ?? { students: 0, debt: 0 };
      s.students++;
      if (r.payStatus === "UNPAID" || r.payStatus === "PARTIAL") s.debt++;
      stats.set(r.classId, s);
    }
    const careByClass = new Map<number, number>();
    for (const c of care) {
      if (c.student.classId == null || !activeInAcademicYear(c, year)) continue;
      careByClass.set(c.student.classId, (careByClass.get(c.student.classId) ?? 0) + 1);
    }
    return NextResponse.json({
      year, current, mode: "current", debtVisible: showDebt,
      specialCareVisible: showCare,
      unassigned: finance.rows.filter(r => r.classId == null).length,
      classes: classes.map(c => ({
        id: c.id,
        name: c.name,
        level: c.level,
        teacher: c.teacher,
        capacity: c.capacity,
        effectiveCapacity: c.capacity ?? DEFAULT_CAPACITY,
        active: c.active,
        students: stats.get(c.id)?.students ?? 0,
        debt: showDebt ? (stats.get(c.id)?.debt ?? 0) : 0,
        specialCare: showCare ? (careByClass.get(c.id) ?? 0) : undefined,
      })),
    });
  }

  // ── Vit i kaluar (vetëm lexim) ──
  const snapshots = await prisma.classYearSnapshot.findMany({ where: { organizationId: orgId, academicYear: year } });
  const label = `${year}-${year + 1}`;
  const history = await prisma.studentYearHistory.findMany({
    where: { schoolYear: { organizationId: orgId, label: { contains: String(year) } } },
    select: { studentId: true, className: true, classLevel: true, schoolYear: { select: { label: true } } },
  });
  const hist = history.filter(h => (h.schoolYear.label.match(/(\d{4})/)?.[1] ?? "") === String(year));
  const finance = hist.length
    ? await computeStudentFinanceRows({ organizationId: orgId, id: { in: hist.map(h => h.studentId) } }, { year, yearType: "academic" })
    : { rows: [] };
  const payById = new Map(finance.rows.map(r => [r.id, r.payStatus]));
  const byName = new Map<string, { level: string | null; students: number; debt: number }>();
  for (const h of hist) {
    const name = h.className ?? "Pa klasë";
    const s = byName.get(name) ?? { level: h.classLevel ?? null, students: 0, debt: 0 };
    s.students++;
    const st = payById.get(h.studentId);
    if (st === "UNPAID" || st === "PARTIAL") s.debt++;
    byName.set(name, s);
  }
  const names = new Set([...snapshots.map(s => s.className), ...byName.keys()]);
  const classes = Array.from(names).map((name, i) => {
    const snap = snapshots.find(s => s.className === name);
    const h = byName.get(name);
    return {
      id: snap?.classId ?? -(i + 1),
      name,
      level: snap?.level ?? h?.level ?? `Klasa ${name.match(/\d+/)?.[0] ?? ""}`,
      teacher: snap?.teacher ?? null,
      capacity: snap?.capacity ?? null,
      effectiveCapacity: snap?.capacity ?? DEFAULT_CAPACITY,
      active: snap?.active ?? true,
      students: h?.students ?? snap?.studentCount ?? 0,
      debt: showDebt ? (h?.debt ?? 0) : 0,
    };
  });
  return NextResponse.json({ year, current, mode: "past", debtVisible: showDebt, label, specialCareVisible: false, classes });
}
