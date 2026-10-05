import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { oraAccess } from "@/ora/access";

// 👍 / 👎 për një përgjigje — vetëm për pyetjet e vetë përdoruesit.
export async function POST(req: NextRequest) {
  const access = await oraAccess(await auth());
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await req.json().catch(() => ({}));
  const id = parseInt(String(body.queryId ?? "")) || 0;
  const rating = body.rating === 1 ? 1 : body.rating === -1 ? -1 : null;
  if (!id || rating === null) return NextResponse.json({ error: "Të dhëna të pavlefshme." }, { status: 400 });
  const r = await prisma.oraQuery.updateMany({ where: { id, userId: access.ctx.userId ?? -1 }, data: { rating } });
  if (!r.count) return NextResponse.json({ error: "Pyetja nuk u gjet." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
