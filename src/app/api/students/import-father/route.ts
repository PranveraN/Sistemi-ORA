import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseDate(v: unknown): Date | null {
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

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rows: Record<string, string>[] = body.rows;

  if (!rows?.length) return NextResponse.json({ error: "Asnjë rresht nuk u dërgua" }, { status: 400 });

  const results = { updated: 0, skipped: 0, notFound: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Gjej nxënësin me nr. personal ose emër + mbiemër
      let student = null;

      const personalNumber = str(row.personalNumber)?.replace(/\s/g, "");
      if (personalNumber) {
        student = await prisma.student.findUnique({ where: { personalNumber } });
      }

      if (!student && (row.firstName || row.lastName)) {
        const candidates = await prisma.student.findMany({
          where: {
            firstName: { contains: str(row.firstName) || "" },
            lastName:  { contains: str(row.lastName)  || "" },
          },
          take: 1,
        });
        student = candidates[0] ?? null;
      }

      if (!student) {
        results.notFound++;
        results.errors.push(
          `Rreshti ${i + 2}: Nxënësi "${row.firstName || ""} ${row.lastName || ""}" (${personalNumber || "pa nr. personal"}) nuk u gjet`
        );
        continue;
      }

      // Përditëso vetëm fushat e babait që janë bosh ose mungojnë
      const updateData: Record<string, unknown> = {};

      if (str(row.fatherName)  && !student.fatherName)  updateData.fatherName  = str(row.fatherName);
      if (str(row.fatherPhone) && !student.fatherPhone) updateData.fatherPhone = str(row.fatherPhone);
      if (str(row.fatherProf)  && !student.fatherProf)  updateData.fatherProf  = str(row.fatherProf);
      if (str(row.fatherEmail) && !student.fatherEmail) updateData.fatherEmail = str(row.fatherEmail);

      const fatherBirth = parseDate(row.fatherBirth);
      if (fatherBirth && !student.fatherBirth) updateData.fatherBirth = fatherBirth;

      // Përditëso parentName nëse mungon
      if (str(row.fatherName) && !student.parentName)  updateData.parentName  = str(row.fatherName);
      if (str(row.fatherPhone) && !student.parentPhone) updateData.parentPhone = str(row.fatherPhone);

      if (Object.keys(updateData).length === 0) {
        results.skipped++;
        continue;
      }

      await prisma.student.update({ where: { id: student.id }, data: updateData });
      results.updated++;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Rreshti ${i + 2}: ${msg}`);
    }
  }

  return NextResponse.json(results);
}
