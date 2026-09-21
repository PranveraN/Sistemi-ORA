import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TYPES = ["TEXT", "TEXTAREA", "NUMBER", "SELECT", "CHECKBOX"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ("label" in body) data.label = String(body.label).trim();
  if ("type" in body) {
    if (!TYPES.includes(body.type)) return NextResponse.json({ message: "Lloj i panjohur." }, { status: 400 });
    data.type = body.type;
  }
  if ("options" in body) data.options = Array.isArray(body.options) ? JSON.stringify(body.options.filter(Boolean)) : null;
  if ("required" in body) data.required = !!body.required;
  if ("order" in body) data.order = Number(body.order) || 0;
  if ("active" in body) data.active = !!body.active;

  const field = await prisma.enrollmentFormField.update({ where: { id: parseInt(id) }, data });
  return NextResponse.json({ ...field, options: field.options ? JSON.parse(field.options) : null });
}

// Fshirje e butë — mban etiketën për aplikimet e vjetra që tashmë kanë
// përgjigje te EnrollmentApplication.customAnswers.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.enrollmentFormField.update({ where: { id: parseInt(id) }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
