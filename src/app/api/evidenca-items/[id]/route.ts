import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EVIDENCA_ITEM_TYPES } from "@/lib/evidencaConfig";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("label" in body) data.label = String(body.label).trim();
  if ("type" in body) {
    if (!EVIDENCA_ITEM_TYPES.includes(body.type)) return NextResponse.json({ message: "Lloj i panjohur." }, { status: 400 });
    data.type = body.type;
  }
  if ("options" in body) data.options = Array.isArray(body.options) ? JSON.stringify(body.options.filter(Boolean)) : null;
  if ("hasSpecify" in body) data.hasSpecify = !!body.hasSpecify;
  if ("categoryId" in body) data.categoryId = body.categoryId ? Number(body.categoryId) : null;
  if ("order" in body) data.order = Number(body.order) || 0;
  if ("active" in body) data.active = !!body.active;

  const item = await prisma.evidencaItem.update({ where: { id: parseInt(id) }, data });
  return NextResponse.json({ ...item, options: item.options ? JSON.parse(item.options) : null });
}

// Fshirje e butë — mban etiketën për evidencat e vjetra që kanë përgjigje
// te StudentEvidenca.answers.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.evidencaItem.update({ where: { id: parseInt(id) }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
