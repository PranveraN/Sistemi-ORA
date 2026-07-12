import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManualBackup } from "@/lib/backup";

type Outcome = "PROMOTED" | "REPEATED" | "GRADUATED" | "LEFT";

interface Decision {
  studentId: number;
  outcome: Outcome;
  targetClassId?: number | null;
  note?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund ta kryejnë kalimin e vitit" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const userId = parseInt((session.user as { id?: string })?.id ?? "0");

  const body = await req.json();
  const toYearId = parseInt(body.toYearId);
  const decisions: Decision[] = Array.isArray(body.decisions) ? body.decisions : [];
  if (!toYearId) return NextResponse.json({ error: "Mungon toYearId" }, { status: 400 });
  if (!decisions.length) return NextResponse.json({ error: "Asnjë vendim i dërguar" }, { status: 400 });

  const toYear = await prisma.schoolYear.findUnique({ where: { id: toYearId } });
  if (!toYear) return NextResponse.json({ error: "Viti destinacion nuk u gjet" }, { status: 404 });

  const alreadyRun = await prisma.promotionRun.findFirst({ where: { toYearId } });
  if (alreadyRun) {
    return NextResponse.json({ error: "Kalimi për këtë vit është kryer tashmë", promotionRunId: alreadyRun.id }, { status: 409 });
  }

  // Validim i detyrueshëm: decisions duhet të mbulojë ÇDO nxënës aktual ACTIVE, jo vetëm një pjesë.
  const activeStudents = await prisma.student.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    include: { class: true },
  });
  const decisionIds = new Set(decisions.map(d => d.studentId));
  const missing = activeStudents.filter(s => !decisionIds.has(s.id));
  if (missing.length) {
    return NextResponse.json({
      error: `Mungojnë vendime për ${missing.length} nxënës`,
      missingStudentIds: missing.map(s => s.id),
    }, { status: 400 });
  }

  const studentMap = new Map(activeStudents.map(s => [s.id, s]));
  const fromYear = await prisma.schoolYear.findFirst({ where: { organizationId: orgId, active: true } });

  // Backup i plotë i databazës PARA se të prekim gjë — rrjeti final i sigurisë.
  try {
    await createManualBackup();
  } catch (e) {
    return NextResponse.json({ error: `Backup-i dështoi, veprimi u ndal: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  try {
    const classesById = new Map((await prisma.class.findMany({ where: { organizationId: orgId } })).map(c => [c.id, c]));

    const result = await prisma.$transaction(async tx => {
      const stillRunning = await tx.promotionRun.findFirst({ where: { toYearId } });
      if (stillRunning) throw new Error("ALREADY_RUN");

      const promotedOrRepeated = decisions.filter(d => d.outcome === "PROMOTED" || d.outcome === "REPEATED");
      const graduatedOrLeft = decisions.filter(d => d.outcome === "GRADUATED" || d.outcome === "LEFT");

      // Grupo nxënësit me destinacion identik — updateMany në vend të qindra shkrimeve individuale.
      const groups = new Map<number, number[]>();
      for (const d of promotedOrRepeated) {
        if (!d.targetClassId) continue;
        const list = groups.get(d.targetClassId) ?? [];
        list.push(d.studentId);
        groups.set(d.targetClassId, list);
      }
      for (const [targetClassId, ids] of groups) {
        await tx.student.updateMany({
          where: { id: { in: ids } },
          data: { classId: targetClassId, status: "ACTIVE" },
        });
      }

      // Diplomim/Largim — shkrim individual sepse shënimet ndryshojnë për secilin.
      for (const d of graduatedOrLeft) {
        const student = studentMap.get(d.studentId);
        if (!student) continue;
        const suffix = d.outcome === "GRADUATED"
          ? `Diplomuar - ${fromYear?.label ?? ""}`
          : `Largua - ${fromYear?.label ?? ""}${d.note ? `: ${d.note}` : ""}`;
        const newNotes = student.notes ? `${student.notes}\n${suffix}` : suffix;
        await tx.student.update({
          where: { id: d.studentId },
          data: { status: "INACTIVE", classId: null, notes: newNotes },
        });
      }
      if (graduatedOrLeft.length) {
        await tx.$executeRawUnsafe(
          `UPDATE Student SET inactiveDate = datetime('now') WHERE id IN (${graduatedOrLeft.map(d => d.studentId).join(",") || "0"})`
        );
      }

      // Arkivo foton PARA-ndryshim për çdo nxënës (nëse ka vit aktiv paraardhës për ta arkivuar).
      if (fromYear) {
        const historyRows = decisions.map(d => {
          const s = studentMap.get(d.studentId)!;
          const cls = s.classId ? classesById.get(s.classId) : null;
          const targetCls = d.targetClassId ? classesById.get(d.targetClassId) : null;
          return {
            studentId: s.id,
            schoolYearId: fromYear.id,
            classId: s.classId,
            className: cls?.name ?? null,
            classLevel: cls?.level ?? null,
            discountPct: s.discountPct,
            status: s.status,
            studentName: `${s.firstName} ${s.lastName}`,
            outcome: d.outcome,
            newClassId: d.targetClassId ?? null,
            newClassName: targetCls?.name ?? null,
          };
        });
        await tx.studentYearHistory.createMany({ data: historyRows });
      }

      // Hap zyrtarisht vitin e ri.
      await tx.schoolYear.updateMany({ where: { organizationId: orgId, active: true }, data: { active: false } });
      await tx.schoolYear.update({ where: { id: toYearId }, data: { active: true } });
      await tx.setting.upsert({
        where: { key: "schoolYear" },
        update: { value: toYear.label },
        create: { key: "schoolYear", value: toYear.label },
      });

      // Pasqyro çmimet e vitit të ri (edituar ndoshta para se të aktivizohej) te PaymentCategory.defaultAmount,
      // që vendet ekzistuese që lexojnë defaultAmount ta shohin çmimin e saktë tani që ky vit është aktiv.
      const yearPrices = await tx.paymentCategoryPrice.findMany({ where: { schoolYearId: toYearId } });
      for (const p of yearPrices) {
        await tx.paymentCategory.update({ where: { id: p.categoryId }, data: { defaultAmount: p.defaultAmount } });
      }

      const counts = {
        promotedCount: decisions.filter(d => d.outcome === "PROMOTED").length,
        repeatedCount: decisions.filter(d => d.outcome === "REPEATED").length,
        graduatedCount: decisions.filter(d => d.outcome === "GRADUATED").length,
        leftCount: decisions.filter(d => d.outcome === "LEFT").length,
      };

      const run = await tx.promotionRun.create({
        data: {
          fromYearId: fromYear?.id ?? null,
          toYearId,
          userId,
          studentCount: decisions.length,
          ...counts,
          requestSnapshot: JSON.stringify(body),
        },
      });

      return { run, counts };
    }, { timeout: 30000 });

    if (userId > 0) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "PROMOTE",
          entity: "SchoolYear",
          entityId: toYearId,
          details: `Kaloi ${decisions.length} nxënës nga ${fromYear?.label ?? "—"} në ${toYear.label}`,
        },
      });
    }

    return NextResponse.json({
      promotionRunId: result.run.id,
      toYear: { id: toYear.id, label: toYear.label },
      counts: result.counts,
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "ALREADY_RUN") {
      return NextResponse.json({ error: "Kalimi për këtë vit është kryer tashmë" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
