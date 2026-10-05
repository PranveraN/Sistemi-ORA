import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSearch } from "@/lib/utils";
import { oraAccess } from "@/ora/access";

// Kërkimi i zakonshëm i fushës "Pyet Orën ose kërko…" — emra nxënësish,
// prindërish dhe stafi, MENJËHERË, pa AI dhe pa rregullat e pyetjeve.
// Nxënësit/prindërit vetëm me modulin "students"; stafi vetëm me "sekretaria".
// Kthen vetëm emra/klasë — asnjë telefon, nr. personal apo shumë.
export async function GET(req: NextRequest) {
  const access = await oraAccess(await auth());
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { ctx } = access;

  const q = normalizeSearch(req.nextUrl.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ students: [], staff: [] });
  const tokens = q.split(" ");
  const hit = (text: string) => { const t = normalizeSearch(text); return tokens.every(x => t.includes(x)); };

  const canStudents = ctx.hasModule("students");
  const canFamilies = ctx.hasModule("families");
  const canStaff = ctx.hasModule("sekretaria");

  const [students, staff] = await Promise.all([
    canStudents
      ? prisma.student.findMany({
          where: { organizationId: ctx.orgId },
          select: { id: true, firstName: true, lastName: true, status: true, fatherName: true, motherName: true, parentName: true, familyRefId: true, class: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canStaff ? prisma.staff.findMany({ select: { id: true, emri: true, lenda: true } }) : Promise.resolve([]),
  ]);

  const studentHits = students
    .map(s => {
      const name = `${s.firstName} ${s.lastName}`;
      const parents = [s.fatherName, s.motherName, s.parentName].filter(Boolean) as string[];
      const byName = hit(name);
      const parent = byName ? null : parents.find(p => hit(p)) ?? null;
      if (!byName && !parent) return null;
      return {
        id: s.id, name, className: s.class?.name ?? null, active: s.status === "ACTIVE",
        matchedParent: parent,
        href: canFamilies && s.familyRefId ? `/families/${s.familyRefId}` : `/students?q=${encodeURIComponent(name)}&st=all`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b!.active) - Number(a!.active) || a!.name.localeCompare(b!.name, "sq"))
    .slice(0, 8);

  const staffHits = staff.filter(m => hit(m.emri)).slice(0, 5)
    .map(m => ({ id: m.id, name: m.emri, role: m.lenda, href: `/sekretaria/stafi?staffId=${m.id}` }));

  return NextResponse.json({ students: studentHits, staff: staffHits });
}
