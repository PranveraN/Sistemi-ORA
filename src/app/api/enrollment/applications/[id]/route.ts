import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { getEnrollmentRules, effectiveEvidencaState, findDuplicates, ageYears, REJECT_REASONS } from "@/lib/enrollmentRules";
import { logAction } from "@/lib/audit";
import { deleteApplicationDir } from "@/lib/application-storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const { id } = await params;
  const app = await prisma.enrollmentApplication.findUnique({
    where: { id: parseInt(id) },
    include: {
      class: { select: { name: true, level: true } },
      documents: { select: { id: true, docType: true, originalName: true, contentType: true, size: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [rules, dups] = await Promise.all([getEnrollmentRules(), findDuplicates(app.organizationId, [app])]);
  return NextResponse.json({
    ...app,
    evidencaState: effectiveEvidencaState(app, rules),
    evidencaLegacy: !app.evidencaState && !["PENDING", "EVIDENCA"].includes(app.status),
    age: ageYears(app.birthDate),
    duplicate: dups.get(app.id) ?? null,
    rejectReasonLabel: REJECT_REASONS.find(r => r.key === app.rejectReason)?.label ?? null,
  });
}

// Fshin vetë aplikimin (+ dokumentet e bashkëngjitura, në disk dhe në DB —
// ApplicationDocument fshihet automatikisht me Cascade). NUK prek Student-in
// e krijuar nëse aplikimi ishte pranuar (createdStudentId) — janë të ndara.
//
// KUJDES: dokumentet (certifikatë lindjeje, ID prindi, fletëkalim, etj.) EKZISTOJNË
// VETËM këtu — s'ka asnjë kopje te vetë Student-i. Nëse aplikimi është pranuar
// tashmë (createdStudentId i vendosur), nxënësi është real dhe aktiv në sistem;
// fshirja "rutinë" e aplikimeve të vjetra do t'i shkatërronte përgjithmonë
// dokumentet e tij identifikuese. Bllokohet, veçse me `?force=true` të qëllimshëm.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim." }, { status: 403 });

  const { id } = await params;
  const applicationId = parseInt(id);
  const force = req.nextUrl.searchParams.get("force") === "true";

  const app = await prisma.enrollmentApplication.findUnique({ where: { id: applicationId } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (app.createdStudentId && !force) {
    return NextResponse.json(
      { error: `Ky aplikim është pranuar tashmë (nxënës aktiv #${app.createdStudentId}) — dokumentet e tij (certifikatë lindjeje, ID prindi, etj.) do të humbnin përgjithmonë. Nëse je i sigurt, konfirmo sërish.`, requiresForce: true },
      { status: 409 }
    );
  }

  await deleteApplicationDir(applicationId);
  await prisma.enrollmentApplication.delete({ where: { id: applicationId } });

  await logAction(session, "DELETE", "EnrollmentApplication", applicationId,
    `Fshiu aplikimin e ${app.firstName} ${app.lastName} (${app.referenceNumber ?? `#${applicationId}`})`);

  return NextResponse.json({ ok: true });
}
