import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  schoolName:    "Akademia Ora",
  schoolPhone:   "+383 XX XXX XXX",
  schoolAddress: "",
};

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings = { ...DEFAULTS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Record<string, string> = await req.json();
  const allowed = ["schoolName", "schoolPhone", "schoolAddress"];

  await Promise.all(
    allowed
      .filter((key) => key in body)
      .map((key) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: body[key] ?? "" },
          create: { key, value: body[key] ?? "" },
        })
      )
  );

  return NextResponse.json({ ok: true });
}
