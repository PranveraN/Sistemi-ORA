import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { currentAcademicYear } from "@/lib/classYears";
import { computeStudentAllFinance, sumFinance } from "@/lib/studentCategoryFinance";
import { familyLabel, searchMatches } from "@/lib/families";

// Lista e familjeve (majtas te "Familjet") — kërkimi, filtrat, faqosja dhe
// numrat bëhen KËTU. Vetëm fëmijët AKTIVË numërohen (2+ fëmijë, borxhi).
//   ?q=&filter=all|debt|multi&classId=&year=&page=&limit=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "families")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const showFinance = sessionHasModule(session, "students");

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") || "") || await currentAcademicYear(orgId);
  const q = (sp.get("q") || "").trim();
  const filter = sp.get("filter") || "all";
  const classId = parseInt(sp.get("classId") || "");
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "30")));

  const families = await prisma.family.findMany({
    where: { organizationId: orgId, students: { some: { status: "ACTIVE" } } },
    include: {
      students: {
        where: { status: "ACTIVE" },
        select: {
          id: true, firstName: true, lastName: true, classId: true,
          parentName: true, parentPhone: true, fatherName: true, fatherPhone: true, motherName: true, motherPhone: true,
          class: { select: { name: true } },
        },
        orderBy: { firstName: "asc" },
      },
    },
  });
  const unlinked = await prisma.student.count({ where: { organizationId: orgId, status: "ACTIVE", familyRefId: null } });

  const allIds = families.flatMap(f => f.students.map(s => s.id));
  const finance = showFinance ? await computeStudentAllFinance(orgId, allIds, year) : new Map();

  const collator = new Intl.Collator("sq", { sensitivity: "base" });
  const rows = families.map(f => {
    const kids = f.students;
    const first = kids[0];
    const totals = showFinance ? sumFinance(kids.map(k => finance.get(k.id)!).filter(Boolean)) : null;
    const contactName = f.primaryContact === "FATHER" ? first.fatherName : f.primaryContact === "MOTHER" ? first.motherName : first.parentName;
    return {
      id: f.id,
      label: familyLabel(f.displayName, kids.map(k => k.lastName)),
      contactName: contactName || first.parentName || first.fatherName || first.motherName || null,
      children: kids.map(k => ({ id: k.id, firstName: k.firstName, className: k.class?.name ?? null, classId: k.classId })),
      childCount: kids.length,
      debt: totals?.balance ?? null,
      _search: {
        texts: [f.displayName, ...kids.flatMap(k => [k.firstName, k.lastName, `${k.firstName} ${k.lastName}`, k.parentName, k.fatherName, k.motherName])],
        phones: kids.flatMap(k => [k.parentPhone, k.fatherPhone, k.motherPhone]),
      },
    };
  });

  // Numrat (kartat) — mbi të gjitha familjet, para filtrave të listës
  const counts = {
    total: rows.length,
    multi: rows.filter(r => r.childCount >= 2).length,
    debt: rows.filter(r => (r.debt ?? 0) > 0.005).length,
  };

  let list = rows;
  if (q) list = list.filter(r => searchMatches(q, r._search.texts, r._search.phones));
  if (filter === "debt") list = list.filter(r => (r.debt ?? 0) > 0.005);
  else if (filter === "multi") list = list.filter(r => r.childCount >= 2);
  if (Number.isFinite(classId)) list = list.filter(r => r.children.some(c => c.classId === classId));
  list.sort((a, b) => collator.compare(a.label, b.label));

  const total = list.length;
  const pageRows = list.slice((page - 1) * limit, page * limit).map(({ _search, ...r }) => r);
  return NextResponse.json({ rows: pageRows, total, page, limit, counts, year, unlinked, showFinance });
}
