import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Kategoritë e dokumenteve: ato të përdorura te dokumentet + ato të shtuara me "+ Kategori"
// (ruhen te Setting "documentCategories", që të shfaqen edhe pa asnjë dokument).
const KEY = "documentCategories";

async function stored(): Promise<string[]> {
  const s = await prisma.setting.findUnique({ where: { key: KEY } });
  try { const v = JSON.parse(s?.value ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const used = await prisma.schoolDocument.findMany({ where: { organizationId: orgId, category: { not: null } }, select: { category: true }, distinct: ["category"] });
  const all = new Set([...(await stored()), ...used.map(u => u.category!).filter(Boolean)]);
  return NextResponse.json(Array.from(all).sort((a, b) => a.localeCompare(b)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "";
  if (!["ADMIN", "SUPERADMIN", "SECRETARY"].includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "Shkruani emrin e kategorisë." }, { status: 400 });
  const list = await stored();
  if (!list.includes(name)) list.push(name);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(list) }, create: { key: KEY, value: JSON.stringify(list) } });
  return NextResponse.json({ ok: true, name });
}
