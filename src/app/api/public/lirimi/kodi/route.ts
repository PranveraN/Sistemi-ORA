import { NextRequest, NextResponse } from "next/server";
import { dergoKodin, femijetSipasTelefonit, normPhone } from "@/lib/lirimi";

// Hapi 1 i prindit: numri i telefonit → kod 6-shifror me SMS (vetëm për numra të regjistruar).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normPhone(String(body.telefoni ?? ""));
  if (!phone) return NextResponse.json({ error: "Shkruani një numër telefoni të vlefshëm." }, { status: 400 });

  const femijet = await femijetSipasTelefonit(phone);
  if (!femijet.length) return NextResponse.json({ error: "Ky numër nuk është i regjistruar. Kontaktoni shkollën." }, { status: 404 });

  const r = await dergoKodin(phone);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, ...(r.devKod ? { devKod: r.devKod } : {}) });
}
