import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ARSYET, LIDHJET, KERKESA_MAX_NE_DITE, baseUrl, femijetSipasTelefonit, kerkesatSot, lexoToken, logLirim, njoftoKujdestaren, sotDay,
} from "@/lib/lirimi";

// Prindi (i verifikuar me kod) dërgon kërkesën për lirim të fëmijës së vet.
export async function POST(req: NextRequest) {
  const phone = lexoToken(req.headers.get("x-lirim-token"));
  if (!phone) return NextResponse.json({ error: "Sesioni ka skaduar. Verifikoni numrin përsëri." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const studentId = parseInt(String(b.studentId ?? ""));
  const data = String(b.data ?? "");
  const ora = String(b.ora ?? "");
  const arsyeja = String(b.arsyeja ?? "");
  const shpjegim = String(b.shpjegim ?? "").trim().slice(0, 500) || null;
  const marresEmri = String(b.marresEmri ?? "").trim().slice(0, 120);
  const marresLidhja = String(b.marresLidhja ?? "");

  const femija = (await femijetSipasTelefonit(phone)).find(f => f.id === studentId);
  if (!femija) return NextResponse.json({ error: "Zgjidhni një nga fëmijët tuaj." }, { status: 403 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < sotDay()) return NextResponse.json({ error: "Zgjidhni një datë nga sot e tutje." }, { status: 400 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(ora)) return NextResponse.json({ error: "Shkruani orën (p.sh. 11:30)." }, { status: 400 });
  if (!ARSYET[arsyeja]) return NextResponse.json({ error: "Zgjidhni arsyen." }, { status: 400 });
  if (arsyeja === "TJETER" && !shpjegim) return NextResponse.json({ error: "Shkruani shpjegimin e arsyes." }, { status: 400 });
  if (!marresEmri) return NextResponse.json({ error: "Shkruani emrin e personit që e merr fëmijën." }, { status: 400 });
  if (!LIDHJET[marresLidhja]) return NextResponse.json({ error: "Zgjidhni lidhjen me fëmijën." }, { status: 400 });
  if ((await kerkesatSot(phone)) >= KERKESA_MAX_NE_DITE) {
    return NextResponse.json({ error: `Keni arritur kufirin prej ${KERKESA_MAX_NE_DITE} kërkesash për sot. Kontaktoni shkollën.` }, { status: 429 });
  }

  const k = await prisma.lirimKerkese.create({
    data: { studentId, classId: femija.classId, data, ora, arsyeja, shpjegim, marresEmri, marresLidhja, telefoni: phone },
  });
  await logLirim(k.id, "KRIJIM", `Kërkesë për ${femija.emri} (${femija.klasa ?? "pa klasë"}), ${data} ${ora}`, `Prindi (${phone})`);
  await njoftoKujdestaren(k, baseUrl(req.url));
  return NextResponse.json({ ok: true, id: k.id }, { status: 201 });
}
