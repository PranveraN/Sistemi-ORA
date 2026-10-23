import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { rakordo, permbledhjaMujore, type RreshtBanke } from "@/lib/timiRakordim";
import { logTimi } from "@/lib/timiAudit";

// Rakordimi mujor me bankën (moduli TIMI, Faza 4).
// GET ?viti=2026&muaji=10 → krahasimi i një muaji · GET ?vitiShkollor=2026 → 12 muajt
// POST { viti, muaji, rreshtat: [{data, cents, pershkrim}], emriSkedarit } → ngarkon ekstraktin (vetëm muaj i hapur)
// PATCH { viti, muaji, veprimi: SHENO | HIQ_SHENIM | MBYLL | RIHAP, celes?, arsye? }
// Asnjë pagesë s'krijohet/ndryshohet këtu — vetëm krahasim, shënime dhe mbyllje e muajit.
const READ = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];
const WRITE = ["ADMIN", "SUPERADMIN", "FINANCE"];

function who(session: unknown) {
  const u = (session as { user?: { id?: string; name?: string | null; role?: string; organizationId?: number } }).user;
  return { role: u?.role ?? "", orgId: u?.organizationId ?? 1, actor: { id: parseInt(u?.id ?? "") || null, name: u?.name ?? null } };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, orgId } = who(session);
  if (!READ.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const vs = parseInt(sp.get("vitiShkollor") ?? "");
  if (vs) return NextResponse.json({ muajt: await permbledhjaMujore(prisma, orgId, vs) });
  const viti = parseInt(sp.get("viti") ?? "") || new Date().getFullYear();
  const muaji = parseInt(sp.get("muaji") ?? "") || new Date().getMonth() + 1;
  return NextResponse.json({ ...(await rakordo(prisma, orgId, viti, muaji)), vitiShkollorParazgjedhur: currentSchoolYearStart() });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, orgId, actor } = who(session);
  if (!WRITE.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const viti = parseInt(b.viti), muaji = parseInt(b.muaji);
  if (!viti || !(muaji >= 1 && muaji <= 12)) return NextResponse.json({ error: "Muaj i pavlefshëm." }, { status: 400 });
  const rreshtat: RreshtBanke[] = (Array.isArray(b.rreshtat) ? b.rreshtat : [])
    .filter((r: RreshtBanke) => /^\d{4}-\d{2}-\d{2}$/.test(r?.data) && Number.isInteger(r?.cents) && r.cents > 0)
    .map((r: RreshtBanke) => ({ data: r.data, cents: r.cents, pershkrim: String(r.pershkrim ?? "").slice(0, 300) }))
    .filter((r: RreshtBanke) => { const d = new Date(`${r.data}T00:00:00Z`); return d.getUTCFullYear() === viti && d.getUTCMonth() + 1 === muaji; });
  const ex = await prisma.timiRakordim.findUnique({ where: { organizationId_viti_muaji: { organizationId: orgId, viti, muaji } } });
  if (ex?.statusi === "MBYLLUR") return NextResponse.json({ error: "Muaji është i mbyllur — rihapeni (me arsye) para se të ngarkoni ekstrakt të ri." }, { status: 409 });
  const data = { rreshtat: JSON.stringify(rreshtat), emriSkedarit: typeof b.emriSkedarit === "string" ? b.emriSkedarit.slice(0, 200) : null, ngarkuarAt: new Date(), ngarkuarNga: actor.name };
  if (ex) await prisma.timiRakordim.update({ where: { id: ex.id }, data: { ...data, shenimet: "{}" } });
  else await prisma.timiRakordim.create({ data: { organizationId: orgId, viti, muaji, ...data } });
  return NextResponse.json({ ok: true, rreshta: rreshtat.length });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, orgId, actor } = who(session);
  if (!WRITE.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const viti = parseInt(b.viti), muaji = parseInt(b.muaji);
  const arsye = typeof b.arsye === "string" ? b.arsye.trim().slice(0, 500) : "";
  if (!viti || !(muaji >= 1 && muaji <= 12)) return NextResponse.json({ error: "Muaj i pavlefshëm." }, { status: 400 });
  const ex = await prisma.timiRakordim.findUnique({ where: { organizationId_viti_muaji: { organizationId: orgId, viti, muaji } } })
    ?? await prisma.timiRakordim.create({ data: { organizationId: orgId, viti, muaji } });
  const muajTxt = `${String(muaji).padStart(2, "0")}/${viti}`;

  if (b.veprimi === "SHENO" || b.veprimi === "HIQ_SHENIM") {
    if (ex.statusi === "MBYLLUR") return NextResponse.json({ error: "Muaji është i mbyllur." }, { status: 409 });
    if (typeof b.celes !== "string" || !b.celes) return NextResponse.json({ error: "Rreshti mungon." }, { status: 400 });
    if (b.veprimi === "SHENO" && arsye.length < 3) return NextResponse.json({ error: "Shkruani pse është në rregull (të paktën 3 shenja)." }, { status: 400 });
    const sh: Record<string, string> = JSON.parse(ex.shenimet);
    if (b.veprimi === "SHENO") sh[b.celes] = arsye; else delete sh[b.celes];
    await prisma.timiRakordim.update({ where: { id: ex.id }, data: { shenimet: JSON.stringify(sh) } });
    return NextResponse.json({ ok: true });
  }
  if (b.veprimi === "MBYLL" || b.veprimi === "RIHAP") {
    if (arsye.length < 3 && b.veprimi === "RIHAP") return NextResponse.json({ error: "Rihapja kërkon arsye (të paktën 3 shenja)." }, { status: 400 });
    const mbyll = b.veprimi === "MBYLL";
    await prisma.timiRakordim.update({ where: { id: ex.id }, data: mbyll ? { statusi: "MBYLLUR", mbyllurAt: new Date(), mbyllurNga: actor.name } : { statusi: "HAPUR", mbyllurAt: null, mbyllurNga: null } });
    await logTimi(prisma, orgId, actor, [{ action: "UPDATE", entity: "TimiPagese", entityId: ex.id, field: "rakordimi", oldValue: `${muajTxt} ${ex.statusi}`, newValue: `${muajTxt} ${mbyll ? "MBYLLUR" : "HAPUR"}`, reason: arsye || null }]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Veprim i panjohur." }, { status: 400 });
}
