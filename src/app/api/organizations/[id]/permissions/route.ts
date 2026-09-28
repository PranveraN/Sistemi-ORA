import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MODULES, CONFIGURABLE_ROLES, DEFAULT_ALLOWED } from "@/lib/modules";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "SUPERADMIN") return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const organizationId = parseInt(id);

  const rows = await prisma.roleModulePermission.findMany({ where: { organizationId } });
  const overrides = new Map(rows.map(r => [`${r.role}:${r.moduleKey}`, r.allowed]));

  const matrix: Record<string, Record<string, boolean>> = {};
  for (const role of CONFIGURABLE_ROLES) {
    matrix[role] = {};
    for (const m of MODULES) {
      const key = `${role}:${m.key}`;
      matrix[role][m.key] = overrides.has(key) ? overrides.get(key)! : DEFAULT_ALLOWED[role].includes(m.key);
    }
  }

  return NextResponse.json({ modules: MODULES, roles: CONFIGURABLE_ROLES, matrix });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const organizationId = parseInt(id);
  const body = await req.json();
  const matrix = body.matrix as Record<string, Record<string, boolean>>;
  if (!matrix) return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });

  const moduleKeys = new Set(MODULES.map(m => m.key));
  const ops = [];
  for (const role of CONFIGURABLE_ROLES) {
    const roleRow = matrix[role];
    if (!roleRow) continue;
    for (const [moduleKey, allowed] of Object.entries(roleRow)) {
      if (!moduleKeys.has(moduleKey)) continue;
      ops.push(
        prisma.roleModulePermission.upsert({
          where: { organizationId_role_moduleKey: { organizationId, role, moduleKey } },
          update: { allowed: !!allowed },
          create: { organizationId, role, moduleKey, allowed: !!allowed },
        })
      );
    }
  }
  await prisma.$transaction(ops);

  return NextResponse.json({ success: true });
}
