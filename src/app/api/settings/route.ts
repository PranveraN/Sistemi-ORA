import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  schoolName:    "Akademia Ora",
  schoolPhone:   "+383 XX XXX XXX",
  schoolAddress: "",
  schoolEmail:   "",
  schoolNipt:    "",
  schoolUniqueNumber: "",
  schoolYear:    "2025/2026",
  schoolWebsite: "",
  timiInvestEnabled: "true",
  enrollmentOpen: "true", // A pranohen aplikime të reja te /apliko (formulari publik i regjistrimit)
  furnitoriOraEmail: "",
  furnitoriOraPhone: "",
  // Afati i përgjithshëm i shkollimit ("MM-DD") — VETËM për statusin "Me vonesë"
  // te moduli i mesazheve (nxënësit pa këste / plan fleksibël). S'prek pagesat.
  tuitionDueDate: "09-30",
  // Kërkesat për materiale (shih src/lib/materialConfig.ts)
  materialAutoCreateItems: "false", // AUTO_CREATE_ITEMS — krijim automatik i artikujve të rinj
  materialRequestLeadDays: "3",     // sa ditë përpara duhet bërë një kërkesë "Normale"
  // Regjistrimet (shih src/lib/enrollmentRules.ts)
  enrollmentEvidencaGrade1: "true",       // Klasa 1: evidenca e detyrueshme para pranimit
  enrollmentEvidencaOtherGrades: "false", // Klasat 2–9: evidenca e detyrueshme?
  enrollmentDelayDays: "10",              // pas sa ditësh "Për shqyrtim" shënohet "vonesë"
  ushqimiPrice2Meals: "4",
  ushqimiPrice2MealsGrade1: "4",
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

  // Rregulli i evidencës së regjistrimeve — vetëm administratorët (Super Admin;
  // roli "Admin" është vetëm-shikim). Rolet e tjera s'mund t'i ndryshojnë.
  const ADMIN_ONLY = ["enrollmentEvidencaGrade1", "enrollmentEvidencaOtherGrades", "enrollmentDelayDays"];
  const isSuperAdmin = (session.user as { role?: string }).role === "SUPERADMIN";
  const requested = ALLOWED.filter((key) => key in body);
  if (!isSuperAdmin && requested.length > 0 && requested.every(k => ADMIN_ONLY.includes(k))) {
    return NextResponse.json({ error: "Vetëm administratorët mund ta ndryshojnë rregullin e evidencës." }, { status: 403 });
  }

  await Promise.all(
    requested
      .filter((key) => isSuperAdmin || !ADMIN_ONLY.includes(key))
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
