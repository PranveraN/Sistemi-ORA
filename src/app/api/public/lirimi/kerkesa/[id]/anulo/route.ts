import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lexoToken, logLirim } from "@/lib/lirimi";

// Prindi e anulon kërkesën e vet — vetëm derisa është "Në pritje".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const phone = lexoToken(req.headers.get("x-lirim-token"));
  if (!phone) return NextResponse.json({ error: "Sesioni ka skaduar. Verifikoni numrin përsëri." }, { status: 401 });

  const id = parseInt((await params).id);
  const r = await prisma.lirimKerkese.updateMany({ where: { id, telefoni: phone, statusi: "NE_PRITJE" }, data: { statusi: "ANULUAR" } });
  if (!r.count) return NextResponse.json({ error: "Kjo kërkesë s'mund të anulohet (është vendosur tashmë)." }, { status: 409 });
  await logLirim(id, "ANULIM", "U anulua nga prindi", `Prindi (${phone})`);
  return NextResponse.json({ ok: true });
}
