import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Gjej të gjithë nxënësit e dublikuar sipas emrit+mbiemrit
  const dupRows = await prisma.$queryRawUnsafe<{ firstName: string; lastName: string; cnt: number; ids: string }[]>(`
    SELECT firstName, lastName, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id) as ids
    FROM Student
    GROUP BY LOWER(TRIM(firstName)), LOWER(TRIM(lastName))
    HAVING COUNT(*) > 1
    ORDER BY lastName, firstName
  `);

  const report: { name: string; kept: number; deleted: number[]; merged: string[] }[] = [];
  let totalDeleted = 0;
  let totalMerged = 0;

  for (const row of dupRows) {
    const ids = String(row.ids).split(",").map(Number).sort((a, b) => a - b);
    const origId = ids[0];       // Rekordi i vjetër = ID më i vogël
    const dupIds = ids.slice(1); // Të gjitha të tjerat janë dublikata

    const orig = await prisma.student.findUnique({ where: { id: origId } });
    if (!orig) continue;

    const merged: string[] = [];

    for (const dupId of dupIds) {
      const dup = await prisma.student.findUnique({ where: { id: dupId } });
      if (!dup) continue;

      const upd: Record<string, unknown> = {};

      // Kopjo nr. personal nga dublikata → origjinalin nëse origjinali nuk ka
      if (!orig.personalNumber && dup.personalNumber) {
        upd.personalNumber = dup.personalNumber;
        merged.push(`nr.personal: ${dup.personalNumber}`);
      }

      // Kopjo datëlindjen nëse origjinali nuk ka ose ka placeholder 01.01.2015
      const origBirthIsPlaceholder = orig.birthDate &&
        (orig.birthDate.toISOString().startsWith("2015-01-01") ||
         orig.birthDate.toISOString().startsWith("2015-01-02"));
      if (dup.birthDate && (!orig.birthDate || origBirthIsPlaceholder)) {
        upd.birthDate = dup.birthDate;
        merged.push(`datëlindja: ${dup.birthDate.toLocaleDateString("sq-AL")}`);
      }

      // Kopjo fushat e tjera bosh
      if (!orig.motherName  && dup.motherName)  { upd.motherName  = dup.motherName;  merged.push("nëna"); }
      if (!orig.motherPhone && dup.motherPhone) { upd.motherPhone = dup.motherPhone; }
      if (!orig.motherEmail && dup.motherEmail) { upd.motherEmail = dup.motherEmail; }
      if (!orig.motherProf  && dup.motherProf)  { upd.motherProf  = dup.motherProf;  }
      if (!orig.motherBirth && dup.motherBirth) { upd.motherBirth = dup.motherBirth; }
      if (!orig.fatherName  && dup.fatherName)  { upd.fatherName  = dup.fatherName;  merged.push("baba"); }
      if (!orig.fatherPhone && dup.fatherPhone) { upd.fatherPhone = dup.fatherPhone; }
      if (!orig.fatherEmail && dup.fatherEmail) { upd.fatherEmail = dup.fatherEmail; }
      if (!orig.fatherProf  && dup.fatherProf)  { upd.fatherProf  = dup.fatherProf;  }
      if (!orig.fatherBirth && dup.fatherBirth) { upd.fatherBirth = dup.fatherBirth; }
      if (!orig.address     && dup.address)     { upd.address     = dup.address;     }
      if (!orig.parentName  && dup.parentName)  { upd.parentName  = dup.parentName;  }
      if (!orig.parentPhone && dup.parentPhone) { upd.parentPhone = dup.parentPhone; }

      // Përditëso origjinalin me të dhënat e dublikatës
      if (Object.keys(upd).length > 0) {
        await prisma.student.update({ where: { id: origId }, data: upd });
        Object.assign(orig, upd); // sync origjinalin lokalisht
        totalMerged++;
      }

      // Transfero pagesat e dublikatës tek origjinali (nëse ka)
      await prisma.payment.updateMany({ where: { studentId: dupId }, data: { studentId: origId } });
      await prisma.invoice.updateMany({ where: { studentId: dupId }, data: { studentId: origId } });

      // Fshi dublikatën
      await prisma.student.delete({ where: { id: dupId } });
      totalDeleted++;
    }

    report.push({
      name: `${orig.firstName} ${orig.lastName}`,
      kept: origId,
      deleted: dupIds,
      merged,
    });
  }

  if (totalDeleted > 0) {
    await logAction(session, "DELETE", "Student", null,
      `Bashkoi ${dupRows.length} grupe nxënësish të dublikuar — fshiu ${totalDeleted} rreshta, transferoi të dhëna te ${totalMerged}`);
  }

  return NextResponse.json({
    ok: true,
    totalGroups: dupRows.length,
    totalDeleted,
    totalMerged,
    report,
  });
}
