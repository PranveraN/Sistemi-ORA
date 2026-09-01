import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  schoolName:    "Akademia Ora",
  schoolPhone:   "+383 XX XXX XXX",
  schoolAddress: "",
  schoolEmail:   "",
  schoolNipt:    "",
  schoolYear:    "2025/2026",
  schoolWebsite: "",
  timiInvestEnabled: "true",
  furnitoriOraEmail: "",
  ushqimiPrice2Meals: "4",
  transportLocations: JSON.stringify([
    { label: "Prishtinë",    price: 65 },
    { label: "Fushë Kosovë", price: 55 },
    { label: "Lipjan",       price: 55 },
    { label: "Graçanicë",    price: 55 },
    { label: "Drenas",       price: 65 },
    { label: "Podujevo",     price: 70 },
    { label: "Tjetër",       price: 0  },
  ]),
};

const ALLOWED = Object.keys(DEFAULTS);

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

  await Promise.all(
    ALLOWED
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
