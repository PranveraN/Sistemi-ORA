import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { SCOPE_SETTING, loadCashScope } from "@/lib/audit/cashClosing";

// Cilat kategori pagesash hyjnë në arkën që mbyllet çdo ditë (parazgjedhje:
// vetëm Shkollimi). Vetëm Super Admin e ndryshon. PUT { categoryIds: number[] }
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "SUPERADMIN") return NextResponse.json({ error: "Vetëm Super Admin." }, { status: 403 });
  const orgId = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json().catch(() => ({}));
  const valid = new Set((await prisma.paymentCategory.findMany({ where: { organizationId: orgId }, select: { id: true } })).map(c => c.id));
  const ids: number[] = Array.isArray(body.categoryIds) ? [...new Set<number>(body.categoryIds.map((x: unknown) => parseInt(String(x))))].filter(id => valid.has(id)) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Zgjidhni të paktën një kategori." }, { status: 400 });
  const value = JSON.stringify({ categoryIds: ids });
  await prisma.setting.upsert({ where: { key: SCOPE_SETTING }, update: { value }, create: { key: SCOPE_SETTING, value } });
  const scope = await loadCashScope(prisma, orgId);
  await logAction(session, "UPDATE", "CashClosingScope", null, `Arka ditore përfshin: ${scope.categoryNames.join(", ")}`);
  return NextResponse.json({ categoryIds: scope.categoryIds, categoryNames: scope.categoryNames });
}
