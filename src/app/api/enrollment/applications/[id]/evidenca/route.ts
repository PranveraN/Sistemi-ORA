import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { recordApplicationStatus } from "@/lib/enrollmentRules";

// Historiku i Evidencave për një APLIKIM (jo ende nxënës) — mundëson testin e
// evidencës PARA vendimit Prano/Refuzo. Kur aplikimi pranohet, këto rreshta
// migrohen te StudentEvidenca e nxënësit të krijuar (shih approve/route.ts).
//
// Rrjedha: hapja e evidencës kalon aplikimin "Për shqyrtim" → "Evidenca"
// (gjendja "Në plotësim"); "Ruaj si të plotë" e bën "E plotësuar". Aplikimi
// mbetet te "Evidenca" derisa të pranohet/refuzohet.

const OPEN = ["PENDING", "EVIDENCA"];

async function moveToEvidenca(applicationId: number, orgId: number, session: unknown, state: "IN_PROGRESS" | "DONE") {
  const app = await prisma.enrollmentApplication.findFirst({ where: { id: applicationId, organizationId: orgId }, select: { id: true, status: true, evidencaState: true } });
  if (!app) return { error: "Nuk u gjet", status: 404 as const };
  if (!OPEN.includes(app.status)) return { error: "Aplikimi është vendosur tashmë.", status: 409 as const };
  // "E plotësuar" s'kthehet mbrapsht në "Në plotësim" kur thjesht rihapet formulari
  const nextState = app.evidencaState === "DONE" && state === "IN_PROGRESS" ? "DONE" : state;
  await prisma.$transaction(async tx => {
    await tx.enrollmentApplication.update({ where: { id: app.id }, data: { status: "EVIDENCA", evidencaState: nextState } });
    if (app.status !== "EVIDENCA") await recordApplicationStatus(tx, session, app.id, app.status, "EVIDENCA", "Evidenca u hap");
    else if (nextState === "DONE" && app.evidencaState !== "DONE") await recordApplicationStatus(tx, session, app.id, "EVIDENCA", "EVIDENCA", "Evidenca u plotësua");
  });
  return { ok: true as const, evidencaState: nextState };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const { id } = await params;

  const records = await prisma.applicationEvidenca.findMany({
    where: { applicationId: parseInt(id) },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(records);
}

// PATCH { action: "START" } — "Plotëso evidencën" / "Evidencë": kalon në statusin Evidenca
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.action !== "START") return NextResponse.json({ error: "Veprim i panjohur" }, { status: 400 });
  const r = await moveToEvidenca(parseInt(id), orgId, session, "IN_PROGRESS");
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const authorId = parseInt((session.user as { id?: string } | undefined)?.id ?? "0");

  const record = await prisma.applicationEvidenca.create({
    data: {
      applicationId: parseInt(id),
      answers: JSON.stringify(answers),
      authorId,
      organizationId: orgId,
    },
    include: { author: { select: { name: true } } },
  });

  // "Ruaj si të plotë" (complete: true) → E plotësuar; përndryshe → Në plotësim
  const moved = await moveToEvidenca(parseInt(id), orgId, session, body.complete === true ? "DONE" : "IN_PROGRESS");

  return NextResponse.json({ ...record, evidencaState: "evidencaState" in moved ? moved.evidencaState : null }, { status: 201 });
}
