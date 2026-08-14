import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund ta shohin historikun" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const entity = searchParams.get("entity") || "";
  const action = searchParams.get("action") || "";
  const from   = searchParams.get("from") || "";
  const to     = searchParams.get("to") || "";
  const page   = parseInt(searchParams.get("page")  || "1");
  const limit  = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (userId) where.userId = parseInt(userId);
  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to)   createdAt.lte = new Date(`${to}T23:59:59`);
    where.createdAt = createdAt;
  }

  const [logs, total, users, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);

  return NextResponse.json({
    logs, total, page, limit,
    users,
    entities: entities.map(e => e.entity),
  });
}
