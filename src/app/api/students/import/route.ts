import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const students: Record<string, string>[] = body.students;

  if (!students?.length) {
    return NextResponse.json({ error: "Asnjë nxënës nuk u dërgua" }, { status: 400 });
  }

  // Merr të gjitha klasat për të bërë match me emrin
  const allClasses = await prisma.class.findMany();

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (let i = 0; i < students.length; i++) {
    const row = students[i];
    try {
      if (!row.firstName && !row.lastName) {
        results.skipped++;
        continue;
      }

      const personalNumber = String(row.personalNumber || "").replace(/\s/g, "").trim() || null;

      // Gjej klasën me emër
      let classId: number | null = null;
      if (row.klasa) {
        const cls = allClasses.find(
          (c) => c.name.toLowerCase() === String(row.klasa).trim().toLowerCase()
        );
        classId = cls?.id ?? null;
      }

      // Parso datën — mbështet: DD/MM/YYYY, D.M.YYYY, DD.MM.YYYY, YYYY-MM-DD
      function parseDate(v: unknown): Date | null {
        if (!v) return null;
        const raw = String(v).trim();
        const sepMatch = raw.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
        if (sepMatch) {
          const dt = new Date(`${sepMatch[3]}-${sepMatch[2].padStart(2, "0")}-${sepMatch[1].padStart(2, "0")}`);
          return isNaN(dt.getTime()) ? null : dt;
        }
        const dt = new Date(raw);
        return isNaN(dt.getTime()) ? null : dt;
      }

      let birthDate: Date | null = parseDate(row.birthDate);

      function str(v: unknown): string | null {
        const s = String(v ?? "").trim();
        return s || null;
      }

      const fatherPhone = str(row.fatherPhone);
      const motherPhone = str(row.motherPhone);
      const fatherName  = str(row.fatherName);
      const motherName  = str(row.motherName);

      // Gjej nxënësin ekzistues:
      // 1. Sipas nr. personal (nëse ka)
      // 2. Fallback sipas emrit+mbiemrit (edhe kur DB nuk ka nr. personal ende)
      let existing = personalNumber
        ? await prisma.student.findUnique({ where: { personalNumber } })
        : null;

      if (!existing) {
        const firstName = String(row.firstName).trim();
        const lastName  = String(row.lastName).trim();
        if (firstName && lastName) {
          existing = await prisma.student.findFirst({
            where: { firstName, lastName },
          });
        }
      }

      if (existing) {
        const upd: Record<string, unknown> = {};
        if (classId && existing.classId !== classId) upd.classId = classId;
        // Nr. personal — plotëso vetëm nëse mungon në DB
        if (personalNumber && !existing.personalNumber) upd.personalNumber = personalNumber;
        // Datëlindja — nëse mungon ose është placeholder 01.01.2015 / 02.01.2015
        const isBirthPlaceholder = existing.birthDate &&
          (existing.birthDate.toISOString().startsWith("2015-01-01") ||
           existing.birthDate.toISOString().startsWith("2015-01-02"));
        if (birthDate && (!existing.birthDate || isBirthPlaceholder)) upd.birthDate = birthDate;
        // Plotëso fushat e tjera bosh
        if (!existing.address     && str(row.address))     upd.address     = str(row.address);
        if (!existing.diaryNumber && str(row.diaryNumber)) upd.diaryNumber = str(row.diaryNumber);
        if (!existing.motherName  && motherName)           upd.motherName  = motherName;
        if (!existing.motherPhone && motherPhone)          upd.motherPhone = motherPhone;
        if (!existing.motherEmail && str(row.motherEmail)) upd.motherEmail = str(row.motherEmail);
        if (!existing.motherProf  && str(row.motherProf))  upd.motherProf  = str(row.motherProf);
        if (!existing.motherBirth && str(row.motherBirth)) upd.motherBirth = parseDate(row.motherBirth);
        if (!existing.fatherName  && fatherName)           upd.fatherName  = fatherName;
        if (!existing.fatherPhone && fatherPhone)          upd.fatherPhone = fatherPhone;
        if (!existing.fatherEmail && str(row.fatherEmail)) upd.fatherEmail = str(row.fatherEmail);
        if (!existing.fatherProf  && str(row.fatherProf))  upd.fatherProf  = str(row.fatherProf);
        if (!existing.fatherBirth && str(row.fatherBirth)) upd.fatherBirth = parseDate(row.fatherBirth);
        if (!existing.parentName  && (fatherName || motherName))     upd.parentName  = fatherName || motherName;
        if (!existing.parentPhone && (fatherPhone || motherPhone))   upd.parentPhone = fatherPhone || motherPhone;

        if (Object.keys(upd).length > 0) {
          await prisma.student.update({ where: { id: existing.id }, data: upd });
          results.created++;
        } else {
          results.skipped++;
        }
        continue;
      }

      await prisma.student.create({
        data: {
          firstName:    String(row.firstName).trim(),
          lastName:     String(row.lastName).trim(),
          parentName:   fatherName || motherName || str(row.parentName),
          birthDate,
          personalNumber,
          classId,
          diaryNumber:  str(row.diaryNumber),
          parentPhone:  fatherPhone || motherPhone || str(row.parentPhone),
          address:      str(row.address),
          status:       String(row.status || "ACTIVE").toLowerCase() === "joaktiv" ? "INACTIVE" : "ACTIVE",
          // Nëna
          motherName,
          motherBirth:  parseDate(row.motherBirth),
          motherProf:   str(row.motherProf),
          motherPhone,
          motherEmail:  str(row.motherEmail),
          // Baba
          fatherName,
          fatherBirth:  parseDate(row.fatherBirth),
          fatherProf:   str(row.fatherProf),
          fatherPhone,
          fatherEmail:  str(row.fatherEmail),
        },
      });

      results.created++;
    } catch {
      results.errors.push(`Rreshti me nr. personal "${row.personalNumber}" dështoi`);
    }
  }

  const userId = parseInt((session?.user as { id?: string } | undefined)?.id ?? "0");
  if (userId > 0) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "IMPORT",
        entity: "Student",
        details: `Import: ${results.created} nxënës u shtuan, ${results.skipped} u kapërcyen`,
      },
    });
  }

  return NextResponse.json(results);
}
