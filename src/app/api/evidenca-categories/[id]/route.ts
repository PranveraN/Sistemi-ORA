import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("label" in body) data.label = String(body.label).trim();
  if ("order" in body) data.order = Number(body.order) || 0;
  if ("active" in body) data.active = !!body.active;

  const category = await prisma.evidencaCategory.update({ where: { id: parseInt(id) }, data });
  return NextResponse.json(category);
}

// Fshirje e butë — pikat nën këtë kategori mbeten të pacenuara (nëse ende
// aktive, thjesht kategoria e tyre s'shfaqet më te formulari i ri; evidenca
// e ruajtur më parë vazhdon të shfaqë etiketat siç ishin).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.evidencaCategory.update({ where: { id: parseInt(id) }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
