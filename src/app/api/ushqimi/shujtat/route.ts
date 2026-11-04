import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { SHUJTA_MODULE, SHUJTA_LABEL, parseShujtaState, setShujtaFrom, shujtaForPeriod, type Shujta } from "@/lib/ushqimiPlan";

// Shujtat e nxënësit (Mëngjes + Drekë / Vetëm mëngjes / Vetëm drekë) për çdo vit shkollor.
// Ruhet te StudentTag (module "USHQIMI_SHUJTA") — pa tabelë të re. Pagesat s'preken.
// GET ?year → { [studentId]: ShujtaState } · PUT { year, studentId, shujta, nga }

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
    where: { module: SHUJTA_MODULE, schoolYear: year, organizationId: g.user!.orgId },
    select: { studentId: true, label: true },
  });
  return NextResponse.json(Object.fromEntries(rows.map(r => [r.studentId, parseShujtaState(r.label)])));
}

export async function PUT(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const year = parseInt(String(body.year)) || 0;
  const studentId = parseInt(String(body.studentId)) || 0;
  const shujta: Shujta | null = ["TE_DYJA", "MENGJES", "DREKE"].includes(body.shujta) ? body.shujta : null;
  const nga = parseInt(String(body.nga));
  if (!year || !studentId || !shujta || !(nga >= 0 && nga < PERIUDHAT.length)) {
    return NextResponse.json({ error: "Të dhëna të mangëta." }, { status: 400 });
  }
  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId: g.user!.orgId }, select: { firstName: true, lastName: true } });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet." }, { status: 404 });

  const where = { studentId_module_schoolYear: { studentId, module: SHUJTA_MODULE, schoolYear: year } };
  const existing = await prisma.studentTag.findUnique({ where });
  const after = setShujtaFrom(parseShujtaState(existing?.label), nga, shujta);
  const label = JSON.stringify(after);
  await prisma.studentTag.upsert({
    where,
    update: { label },
    create: { studentId, module: SHUJTA_MODULE, schoolYear: year, label, organizationId: g.user!.orgId, createdById: g.user!.id, createdByName: g.user!.name },
  });
  await logAction(g.session!, "UPDATE", "UshqimiShujtat", studentId,
    `Ushqimi ${year}–${year + 1}: ${student.firstName} ${student.lastName} — ${SHUJTA_LABEL[shujta]} nga ${PERIUDHAT[nga]} (${PERIUDHAT.map((p, i) => `${p}: ${SHUJTA_LABEL[shujtaForPeriod(after, i)]}`).join(", ")})`);
  return NextResponse.json(after);
}
