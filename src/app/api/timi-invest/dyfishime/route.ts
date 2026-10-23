import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grupetDyfishe, bashko, ndaje } from "@/lib/timiRakordim";

// Dyfishimet e lidhjeve TIMI (Faza 4). GET → grupet (shikim paraprak) + të bashkuarat.
// POST { mbaj, bashko: [ids], arsye } → bashkon (soft: active=false, bashkuarMe). PATCH { ndaj, arsye } → kthen.
// Asnjë rresht s'fshihet; pagesat janë te nxënësi, jo te lidhja, ndaj s'preken.
const READ = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];
const WRITE = ["ADMIN", "SUPERADMIN", "FINANCE"];

function who(session: unknown) {
  const u = (session as { user?: { id?: string; name?: string | null; role?: string; organizationId?: number } }).user;
  return { role: u?.role ?? "", orgId: u?.organizationId ?? 1, actor: { id: parseInt(u?.id ?? "") || null, name: u?.name ?? null } };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!READ.includes(who(session).role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const bashkuar = await prisma.timiInvestStudent.findMany({ where: { bashkuarMe: { not: null } }, orderBy: { bashkuarAt: "desc" } });
  return NextResponse.json({
    grupet: await grupetDyfishe(prisma),
    bashkuar: bashkuar.map(l => ({ id: l.id, emri: `${l.firstName} ${l.lastName}`.trim(), prindi: l.parentName, bashkuarMe: l.bashkuarMe, bashkuarAt: l.bashkuarAt })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, orgId, actor } = who(session);
  if (!WRITE.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const arsye = typeof b.arsye === "string" ? b.arsye.trim() : "";
  if (arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen (të paktën 3 shenja)." }, { status: 400 });
  if (!Number.isInteger(b.mbaj) || !Array.isArray(b.bashko) || !b.bashko.length) return NextResponse.json({ error: "Zgjidhni çka mbahet dhe çka bashkohet." }, { status: 400 });
  try {
    const n = await bashko(prisma, orgId, actor, b.mbaj, b.bashko.filter((x: unknown) => Number.isInteger(x)), arsye);
    return NextResponse.json({ ok: true, bashkuar: n });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, orgId, actor } = who(session);
  if (!WRITE.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const arsye = typeof b.arsye === "string" ? b.arsye.trim() : "";
  if (arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen (të paktën 3 shenja)." }, { status: 400 });
  try {
    await ndaje(prisma, orgId, actor, parseInt(b.ndaj), arsye);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
