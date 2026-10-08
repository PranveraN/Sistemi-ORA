import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { paymentStatus, remainingOf } from "@/lib/shpenzimPagesat";

// Pagesat pjesë-pjesë të një fature/shpenzimi (p.sh. 2.200 € nga 17.600 €).
// GET  → fatura, pagesat, sa është paguar, sa mbetet, statusi
// POST { shuma, data, metoda, shenim } → shton një pagesë (s'kalon shumën e mbetur)
// Rregulli i llogaritjes: src/lib/shpenzimPagesat.ts

const METODAT = new Set(["CASH", "BANK", "CARD"]);

async function load(id: number) {
  const s = await prisma.shpenzim.findUnique({
    where: { id },
    select: { id: true, shuma: true, paguar: true, mePagesa: true, deletedAt: true, kategoriId: true, nrFature: true, emriBiznesit: true, pershkrim: true },
  });
  if (!s) return null;
  const pagesat = await prisma.shpenzimPagese.findMany({ where: { shpenzimId: id }, orderBy: [{ data: "asc" }, { id: "asc" }] });
  const paid = pagesat.reduce((sum, p) => sum + p.shumaCents, 0) / 100;
  return { s, pagesat, paid };
}

function summary(x: NonNullable<Awaited<ReturnType<typeof load>>>) {
  return {
    shpenzim: x.s,
    pagesat: x.pagesat.map(p => ({ ...p, shuma: p.shumaCents / 100 })),
    paguar: Math.round(x.paid * 100) / 100,
    mbetur: remainingOf(x.s, x.paid),
    statusi: paymentStatus(x.s, x.paid),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const x = await load(parseInt((await params).id) || 0);
  if (!x) return NextResponse.json({ error: "Shpenzimi s'u gjet." }, { status: 404 });
  return NextResponse.json(summary(x));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id) || 0;
  const x = await load(id);
  if (!x) return NextResponse.json({ error: "Shpenzimi s'u gjet." }, { status: 404 });
  if (x.s.deletedAt) return NextResponse.json({ error: "Ky shpenzim është fshirë." }, { status: 400 });
  if (!x.s.mePagesa && x.s.paguar) {
    return NextResponse.json({ error: "Kjo faturë është shënuar \"E paguar\" e tëra. Për ta paguar pjesë-pjesë, shënojeni së pari \"E papaguar\"." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const shuma = typeof body.shuma === "number" ? body.shuma : parseFloat(String(body.shuma ?? "").replace(",", "."));
  const cents = Math.round(shuma * 100);
  const metoda = String(body.metoda ?? "");
  const data = body.data ? new Date(body.data) : new Date();
  const remainingCents = Math.round(remainingOf({ ...x.s, mePagesa: true }, x.paid) * 100);
  if (!Number.isFinite(shuma) || cents <= 0) return NextResponse.json({ error: "Shkruani shumën e pagesës." }, { status: 400 });
  if (cents > remainingCents) return NextResponse.json({ error: `Pagesa s'mund të jetë më e madhe se pjesa e mbetur (${(remainingCents / 100).toFixed(2)} €).` }, { status: 400 });
  if (!METODAT.has(metoda)) return NextResponse.json({ error: "Zgjidhni metodën e pagesës (Cash ose Bankë)." }, { status: 400 });
  if (isNaN(data.getTime())) return NextResponse.json({ error: "Data e pavlefshme." }, { status: 400 });

  const u = session.user as { id?: string; name?: string | null };
  const fullyPaid = cents >= remainingCents;
  await prisma.$transaction(async tx => {
    await tx.shpenzimPagese.create({
      data: {
        shpenzimId: id, kategoriId: x.s.kategoriId, shumaCents: cents, data, metoda,
        shenim: typeof body.shenim === "string" && body.shenim.trim() ? body.shenim.trim().slice(0, 500) : null,
        createdById: parseInt(u.id ?? "") || null, createdByName: u.name ?? null,
      },
    });
    await tx.shpenzim.update({ where: { id }, data: { mePagesa: true, paguar: fullyPaid } });
  });
  await logAction(session, "CREATE", "ShpenzimPagese", id,
    `Pagesë ${(cents / 100).toFixed(2)} € (${metoda}) për faturën ${x.s.nrFature ?? `#${id}`} ${x.s.emriBiznesit ?? ""} — mbetet ${((remainingCents - cents) / 100).toFixed(2)} €`);
  return NextResponse.json(summary((await load(id))!), { status: 201 });
}
