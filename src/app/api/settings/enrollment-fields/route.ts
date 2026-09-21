import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXISTING_FIELDS, resolveFieldConfig, type FieldConfigMap } from "@/lib/enrollmentFieldConfig";

const SETTING_KEY = "enrollmentFieldConfig";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  return NextResponse.json({ fields: EXISTING_FIELDS, config: resolveFieldConfig(row?.value) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const config: FieldConfigMap = body.config ?? {};

  // Ruaj vetëm çelësat e njohur — mbron nga fusha të rreme/të vjetruara.
  const clean: FieldConfigMap = {};
  for (const f of EXISTING_FIELDS) {
    if (config[f.key]) {
      clean[f.key] = { visible: !!config[f.key].visible, required: !!config[f.key].required };
    }
  }

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: SETTING_KEY, value: JSON.stringify(clean) },
  });

  return NextResponse.json({ ok: true });
}
