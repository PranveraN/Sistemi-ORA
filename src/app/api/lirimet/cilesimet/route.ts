import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminLirimi } from "@/lib/lirimiAuth";
import { SETTING_ADMIN_TEL, normPhone } from "@/lib/lirimi";

// Telefoni i administratës — merr SMS kur kujdestarja s'përgjigjet brenda 30 minutave.
export async function GET() {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const s = await prisma.setting.findUnique({ where: { key: SETTING_ADMIN_TEL } });
  return NextResponse.json({ adminTelefoni: s?.value ?? "" });
}

export async function PUT(req: NextRequest) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const raw = String(b.adminTelefoni ?? "").trim();
  const tel = raw ? normPhone(raw) : "";
  if (raw && !tel) return NextResponse.json({ error: "Numër telefoni i pavlefshëm." }, { status: 400 });
  await prisma.setting.upsert({ where: { key: SETTING_ADMIN_TEL }, update: { value: tel }, create: { key: SETTING_ADMIN_TEL, value: tel } });
  return NextResponse.json({ adminTelefoni: tel });
}
