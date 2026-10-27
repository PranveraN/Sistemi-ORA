import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminLirimi } from "@/lib/lirimiAuth";
import { STATUSET, logLirim, njoftoPrindin } from "@/lib/lirimi";

// Detajet + historiku i një kërkese.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const id = parseInt((await params).id);
  const r = await prisma.lirimKerkese.findFirst({ where: { id, organizationId: a.orgId } });
  if (!r) return NextResponse.json({ error: "Kërkesa nuk u gjet." }, { status: 404 });
  const log = await prisma.lirimLog.findMany({ where: { kerkeseId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ...r, log });
}

// Administrata e ndryshon vendimin (edhe pas kujdestares) — regjistrohet te historiku,
// prindi njoftohet me SMS kur vendimi bëhet Aprovuar/Refuzuar.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const id = parseInt((await params).id);
  const b = await req.json().catch(() => ({}));
  const statusi = String(b.statusi ?? "");
  const arsye = String(b.arsyeRefuzimi ?? "").trim().slice(0, 300);
  if (!STATUSET[statusi]) return NextResponse.json({ error: "Statusi i pavlefshëm." }, { status: 400 });
  if (statusi === "REFUZUAR" && arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen e refuzimit." }, { status: 400 });

  const r = await prisma.lirimKerkese.findFirst({ where: { id, organizationId: a.orgId } });
  if (!r) return NextResponse.json({ error: "Kërkesa nuk u gjet." }, { status: 404 });
  if (r.statusi === statusi && (statusi !== "REFUZUAR" || r.arsyeRefuzimi === arsye)) return NextResponse.json({ ok: true });

  const u = await prisma.lirimKerkese.update({
    where: { id },
    data: {
      statusi,
      arsyeRefuzimi: statusi === "REFUZUAR" ? arsye : null,
      ...(statusi === "APROVUAR" || statusi === "REFUZUAR" ? { vendosiId: a.userId, vendosiEmri: a.emri, vendosurAt: new Date() } : {}),
    },
  });
  await logLirim(id, "NDRYSHIM", `${STATUSET[r.statusi]} → ${STATUSET[statusi]}${statusi === "REFUZUAR" ? ` (arsyeja: ${arsye})` : ""}`, `${a.emri} (administrata)`, a.userId);
  if (statusi === "APROVUAR" || statusi === "REFUZUAR") await njoftoPrindin(u);
  return NextResponse.json({ ok: true });
}
