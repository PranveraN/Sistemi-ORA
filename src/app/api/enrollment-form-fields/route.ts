import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/enrollmentFieldConfig";

const TYPES = ["TEXT", "TEXTAREA", "NUMBER", "SELECT", "CHECKBOX"];

// Pyetjet shtesë të konfigurueshme për "/apliko" (Cilësimet → "Formulari i
// Aplikimit"). `includeInactive=1` përfshin edhe ato të fshira-butë (p.sh.
// për t'i shfaqur etiketat te aplikimet e vjetra që tashmë kanë përgjigje).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";

  const fields = await prisma.enrollmentFormField.findMany({
    where: { organizationId: orgId, ...(includeInactive ? {} : { active: true }) },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(fields.map(f => ({ ...f, options: f.options ? JSON.parse(f.options) : null })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json();

  if (!body.label?.trim()) return NextResponse.json({ message: "Etiketa është e domosdoshme." }, { status: 400 });
  if (!TYPES.includes(body.type)) return NextResponse.json({ message: "Lloj i panjohur." }, { status: 400 });

  const maxOrder = await prisma.enrollmentFormField.aggregate({ where: { organizationId: orgId }, _max: { order: true } });

  let key = slugify(body.label);
  // Shmang përplasje me çelës ekzistues (p.sh. dy pyetje me të njëjtën etiketë).
  let suffix = 1;
  while (await prisma.enrollmentFormField.findUnique({ where: { key } })) {
    key = `${slugify(body.label)}-${++suffix}`;
  }

  const field = await prisma.enrollmentFormField.create({
    data: {
      organizationId: orgId,
      key,
      label: body.label.trim(),
      type: body.type,
      options: body.type === "SELECT" && Array.isArray(body.options) ? JSON.stringify(body.options.filter(Boolean)) : null,
      required: !!body.required,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  return NextResponse.json({ ...field, options: field.options ? JSON.parse(field.options) : null });
}
