import { NextRequest, NextResponse } from "next/server";
import { krijoToken, normPhone, verifikoKodin } from "@/lib/lirimi";

// Hapi 2 i prindit: kodi → token (2 orë) për të parë vetëm fëmijët e vet.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normPhone(String(body.telefoni ?? ""));
  const kod = String(body.kodi ?? "").replace(/\D/g, "");
  if (!phone || kod.length !== 6) return NextResponse.json({ error: "Shkruani kodin 6-shifror." }, { status: 400 });
  if (!(await verifikoKodin(phone, kod))) {
    return NextResponse.json({ error: "Kodi është i gabuar ose ka skaduar. Kërkoni një kod të ri." }, { status: 401 });
  }
  return NextResponse.json({ token: krijoToken(phone) });
}
