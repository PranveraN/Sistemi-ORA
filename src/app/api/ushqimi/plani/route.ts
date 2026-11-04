import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { PLAN_MODULE, parsePlanState, setPlanFrom, planForPeriod, type UshqimiPlan } from "@/lib/ushqimiPlan";

// Plani i pagesës së ushqimit (Dymujor/Mujor) për çdo nxënës dhe vit shkollor.
// Ruhet te StudentTag (module "USHQIMI_PLAN") — pa tabelë të re. Pagesat s'preken.
// GET ?year → { [studentId]: PlanState } · PUT { year, studentId, plan, nga }

const PERIUDHAT = ["Shtator/Tetor", "Nëntor/Dhjetor", "Janar/Shkurt", "Mars/Prill", "Maj/Qershor"];

async function guard() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!sessionHasModule(session, "ushqimi")) return { error: NextResponse.json({ error: "Nuk ke leje" }, { status: 403 }) };
  const u = session.user as { id?: string; name?: string | null; organizationId?: number };
  return { session, user: { id: parseInt(u.id ?? "") || null, name: u.name ?? null, orgId: u.organizationId ?? 1 } };
}

export async function GET(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || 0;
  const rows = await prisma.studentTag.findMany({
    where: { module: PLAN_MODULE, schoolYear: year, organizationId: g.user!.orgId },
    select: { studentId: true, label: true },
  });
  return NextResponse.json(Object.fromEntries(rows.map(r => [r.studentId, parsePlanState(r.label)])));
}

export async function PUT(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const year = parseInt(String(body.year)) || 0;
  const studentId = parseInt(String(body.studentId)) || 0;
  const plan: UshqimiPlan | null = body.plan === "MUJOR" ? "MUJOR" : body.plan === "DYMUJOR" ? "DYMUJOR" : null;
  const nga = parseInt(String(body.nga));
  if (!year || !studentId || !plan || !(nga >= 0 && nga < PERIUDHAT.length)) {
    return NextResponse.json({ error: "Të dhëna të mangëta." }, { status: 400 });
  }
  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId: g.user!.orgId }, select: { firstName: true, lastName: true } });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet." }, { status: 404 });

  const where = { studentId_module_schoolYear: { studentId, module: PLAN_MODULE, schoolYear: year } };
  const existing = await prisma.studentTag.findUnique({ where });
  const before = parsePlanState(existing?.label);
  const after = setPlanFrom(before, nga, plan);
  const label = JSON.stringify(after);
  await prisma.studentTag.upsert({
    where,
    update: { label },
    create: { studentId, module: PLAN_MODULE, schoolYear: year, label, organizationId: g.user!.orgId, createdById: g.user!.id, createdByName: g.user!.name },
  });
  const pershkrim = PERIUDHAT.map((p, i) => `${p}: ${planForPeriod(after, i) === "MUJOR" ? "Mujor" : "Dymujor"}`).join(", ");
  await logAction(g.session!, "UPDATE", "UshqimiPlan", studentId,
    `Ushqimi ${year}–${year + 1}: ${student.firstName} ${student.lastName} — plani ${plan === "MUJOR" ? "Mujor" : "Dymujor"} nga ${PERIUDHAT[nga]} (${pershkrim})`);
  return NextResponse.json(after);
}
