import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { getGradeNumber } from "@/lib/school-cycles";
import { classHasRoom } from "@/lib/classCapacity";
import { resolveFieldConfig } from "@/lib/enrollmentFieldConfig";

// Endpoint PUBLIK (pa auth) — ushqen formularin e aplikimit të regjistrimit
// (src/app/apliko) me klasat ekzistuese + a janë "hapur" aplikimet. Vetëm
// fusha të domosdoshme për formularin ekspozohen — jo mësuesi/organizationId etj.
export async function GET() {
  const orgId = 1; // single-tenant për tani, njësoj si teacher-auth/register

  const [classes, openSetting, fieldConfigSetting, customFields] = await Promise.all([
    prisma.class.findMany({
      // Vetëm paralelet AKTIVE — një paralele e shënuar joaktive (bosh,
      // e pahapur këtë vit) s'duhet të bëjë grupin të duket "me vend" te
      // kontrolli i kapacitetit më poshtë (shih Class.active te schema).
      where: { organizationId: orgId, active: true },
      select: {
        id: true,
        name: true,
        level: true,
        capacity: true,
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({ where: { key: "enrollmentOpen" } }),
    prisma.setting.findUnique({ where: { key: "enrollmentFieldConfig" } }),
    prisma.enrollmentFormField.findMany({ where: { organizationId: orgId, active: true }, orderBy: { order: "asc" } }),
  ]);

  return NextResponse.json({
    enrollmentOpen: (openSetting?.value ?? "true") !== "false",
    // Viti aktual + ai i ardhshëm — jo ACADEMIC_YEARS (mbahet dorazi dhe s'e
    // ka ende vitin e ardhshëm kur hapen aplikimet prill/maj).
    schoolYears: [
      { value: `${DEFAULT_ACADEMIC_YEAR}-${DEFAULT_ACADEMIC_YEAR + 1}`, label: `${DEFAULT_ACADEMIC_YEAR}–${DEFAULT_ACADEMIC_YEAR + 1}` },
      { value: `${DEFAULT_ACADEMIC_YEAR + 1}-${DEFAULT_ACADEMIC_YEAR + 2}`, label: `${DEFAULT_ACADEMIC_YEAR + 1}–${DEFAULT_ACADEMIC_YEAR + 2}` },
    ],
    defaultSchoolYear: `${DEFAULT_ACADEMIC_YEAR + 1}-${DEFAULT_ACADEMIC_YEAR + 2}`,
    // Prindi zgjedh vetëm NUMRIN e klasës (p.sh. "6"), jo paralelen konkrete
    // (6A/6B) — ndarja në paralele bëhet nga administrata gjatë pranimit.
    // Një numër klase konsiderohet "plot" vetëm nëse TË GJITHA paralelet e
    // asaj klase janë plot (nëse një paralele ka vend, klasa ka vend).
    grades: (() => {
      const byGrade = new Map<number, boolean>(); // grade -> ka vend të lirë diku
      for (const c of classes) {
        const grade = getGradeNumber(c.name);
        if (grade == null) continue;
        const hasRoom = classHasRoom(c.capacity, c._count.students);
        byGrade.set(grade, (byGrade.get(grade) ?? false) || hasRoom);
      }
      return Array.from(byGrade.entries())
        .sort(([a], [b]) => a - b)
        .map(([grade, hasRoom]) => ({ grade, label: `Klasa ${grade}`, isFull: !hasRoom }));
    })(),
    existingFieldConfig: resolveFieldConfig(fieldConfigSetting?.value),
    customFields: customFields.map(f => ({
      id: f.id, label: f.label, type: f.type, required: f.required,
      options: f.options ? JSON.parse(f.options) : null,
    })),
  });
}
