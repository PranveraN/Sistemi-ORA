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

      // Parso datën (DD/MM/YYYY ose YYYY-MM-DD)
      let birthDate = new Date("2015-01-01");
      if (row.birthDate) {
        const raw = String(row.birthDate).trim();
        if (raw.includes("/")) {
          const [d, m, y] = raw.split("/");
          birthDate = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
        } else {
          birthDate = new Date(raw);
        }
        if (isNaN(birthDate.getTime())) birthDate = new Date("2015-01-01");
      }

      // Nëse ekziston, përditëso vetëm classId (nëse ka klasa)
      const existing = personalNumber
        ? await prisma.student.findUnique({ where: { personalNumber } })
        : null;
      if (existing) {
        if (classId && existing.classId !== classId) {
          await prisma.student.update({
            where: { id: existing.id },
            data: { classId },
          });
          results.created++; // count as processed
        } else {
          results.skipped++;
        }
        continue;
      }

      function str(v: unknown): string | null {
        const s = String(v ?? "").trim();
        return s || null;
      }

      function parseParentDate(v: unknown): Date | null {
        if (!v) return null;
        const raw = String(v).trim();
        if (raw.includes("/")) {
          const [d, m, y] = raw.split("/");
          const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
          return isNaN(dt.getTime()) ? null : dt;
        }
        const dt = new Date(raw);
        return isNaN(dt.getTime()) ? null : dt;
      }

      const fatherPhone = str(row.fatherPhone);
      const motherPhone = str(row.motherPhone);
      const fatherName  = str(row.fatherName);
      const motherName  = str(row.motherName);

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
          motherBirth:  parseParentDate(row.motherBirth),
          motherProf:   str(row.motherProf),
          motherPhone,
          motherEmail:  str(row.motherEmail),
          // Baba
          fatherName,
          fatherBirth:  parseParentDate(row.fatherBirth),
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
