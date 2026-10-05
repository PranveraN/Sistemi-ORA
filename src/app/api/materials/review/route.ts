import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { buildIndex, matchPhrase, normalizeKey, cleanItemName, splitSegments } from "@/lib/materialMatcher";
import { loadCatalogEntries } from "@/lib/materialRequestText";
import { REVIEW_CATEGORY_NAME } from "@/lib/materialConfig";

// Rishikimi i artikujve të rinj nga teksti i mësuesve (Katalogu i Materialeve).
// GET: artikujt "Pa rishikuar" + pjesët e tekstit pa artikull, me tekstin
// origjinal, mësuesin, klasën, emrin e sugjeruar dhe artikullin më të ngjashëm.
// POST { action, … }: approve | merge | delete | createFromText | linkText | ignoreText.
// Çdo ndryshim reflektohet kudo, sepse kërkesat/raportet lidhen me ID-në e artikullit.

async function guard() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !["ADMIN", "SUPERADMIN", "FINANCE"].includes(role ?? "")) return null;
  return session;
}
const orgOf = (s: { user?: unknown }) => (s.user as { organizationId?: number }).organizationId ?? 1;

/** Emri i sugjeruar: hapësira, shkronja e parë e madhe, ë/ç të zakonshme. */
function suggestName(s: string): string {
  const fixes: [RegExp, string][] = [
    [/\bshkelqim/gi, "shkëlqim"], [/\bleter\b/gi, "letër"], [/\bngjyre\b/gi, "ngjyrë"], [/\bgershere/gi, "gërshërë"], [/\bplastelin/gi, "plastelinë"],
    [/\bshkumes/gi, "shkumës"], [/\btabele\b/gi, "tabelë"], [/\bper\b/gi, "për"], [/\bcope\b/gi, "copë"], [/\bshirite?\b/gi, "shirit"],
  ];
  let t = s;
  for (const [re, to] of fixes) t = t.replace(re, to);
  return cleanItemName(t);
}

export async function GET() {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Nuk ke leje." }, { status: 403 });
  const orgId = orgOf(session);

  const [pending, textParts, categories, catalog] = await Promise.all([
    prisma.material.findMany({
      where: { organizationId: orgId, active: true, reviewStatus: "pending" },
      select: {
        id: true, name: true, defaultUnit: true, createdAt: true, createdFromRequestId: true,
        requestItems: { select: { id: true, sourceText: true, quantity: true, request: { select: { id: true, createdAt: true, teacher: { select: { name: true } }, class: { select: { name: true } } } } }, take: 5, orderBy: { id: "asc" } },
        _count: { select: { requestItems: true, orderItems: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.materialRequestItem.findMany({
      where: { isCustom: true, materialId: null, matchType: "new", status: { not: "REJECTED" }, request: { organizationId: orgId, status: { notIn: ["REJECTED", "DELIVERED"] } } },
      select: { id: true, customItemName: true, sourceText: true, quantity: true, unit: true, request: { select: { id: true, createdAt: true, teacher: { select: { name: true } }, class: { select: { name: true } } } } },
      orderBy: { id: "asc" },
    }),
    prisma.materialCategory.findMany({ where: { organizationId: orgId, active: true, NOT: { name: REVIEW_CATEGORY_NAME } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    loadCatalogEntries(orgId),
  ]);
  // "Ngjashëm në katalog" — vetëm artikujt e aprovuar, me përqindjen (prag 50%)
  const approvedIndex = buildIndex(catalog.filter(c => c.reviewStatus !== "pending"));
  const similar = (name: string) => {
    const m = matchPhrase(name, approvedIndex);
    const best = m.item ? { item: m.item, score: m.score } : m.alternatives[0];
    return best && best.score >= 0.5 ? { id: best.item.id, name: best.item.name, percent: Math.round(best.score * 100) } : null;
  };

  return NextResponse.json({
    categories,
    items: pending.map(p => ({
      id: p.id, name: p.name, unit: p.defaultUnit, createdAt: p.createdAt,
      usedIn: p._count.requestItems, inOrders: p._count.orderItems,
      sources: p.requestItems.map(it => ({ text: it.sourceText ?? p.name, quantity: it.quantity, teacher: it.request.teacher.name, className: it.request.class?.name ?? null, date: it.request.createdAt, requestId: it.request.id })),
      suggestedName: suggestName(p.name),
      similar: similar(p.name),
    })),
    textParts: textParts.map(t => ({
      id: t.id, name: t.customItemName ?? "", quantity: t.quantity, unit: t.unit,
      text: t.sourceText ?? t.customItemName ?? "", teacher: t.request.teacher.name, className: t.request.class?.name ?? null, date: t.request.createdAt, requestId: t.request.id,
      suggestedName: suggestName(t.customItemName ?? ""),
      similar: similar(t.customItemName ?? ""),
    })),
  });
}

/** Ruaj tekstin e mësuesit si sinonim të artikullit (sistemi mëson). */
async function addAliases(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], materialId: number, texts: string[], userId: number | null) {
  const target = await tx.material.findUnique({ where: { id: materialId }, select: { name: true } });
  for (const raw of texts) {
    const core = splitSegments(raw)[0]?.core?.trim() || raw.trim();
    const normalized = normalizeKey(core);
    if (!normalized || normalized === normalizeKey(target?.name ?? "")) continue;
    await tx.materialAlias.upsert({
      where: { materialId_normalized: { materialId, normalized } },
      update: {},
      create: { materialId, alias: core.slice(0, 120), normalized, createdById: userId },
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await guard();
  if (!session) return NextResponse.json({ error: "Nuk ke leje." }, { status: 403 });
  const orgId = orgOf(session);
  const userId = parseInt((session.user as { id?: string }).id ?? "") || null;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const id = parseInt(String(body.id ?? "")) || 0;
  const targetId = parseInt(String(body.targetId ?? "")) || 0;
  const name = cleanItemName(String(body.name ?? "").slice(0, 120));
  const categoryId = parseInt(String(body.categoryId ?? "")) || 0;

  const category = categoryId ? await prisma.materialCategory.findFirst({ where: { id: categoryId, organizationId: orgId } }) : null;
  const target = targetId ? await prisma.material.findFirst({ where: { id: targetId, organizationId: orgId, active: true } }) : null;

  // ── Artikujt "Pa rishikuar" ──
  if (["approve", "merge", "delete"].includes(action)) {
    const m = await prisma.material.findFirst({ where: { id, organizationId: orgId, reviewStatus: "pending" }, include: { requestItems: { select: { sourceText: true } }, _count: { select: { requestItems: true, orderItems: true } } } });
    if (!m) return NextResponse.json({ error: "Artikulli nuk u gjet (ndoshta u rishikua tashmë)." }, { status: 404 });

    if (action === "approve") {
      if (name.length < 2) return NextResponse.json({ error: "Shkruaj emrin." }, { status: 400 });
      if (!category) return NextResponse.json({ error: "Zgjidh kategorinë." }, { status: 400 });
      await prisma.material.update({ where: { id: m.id }, data: { name, categoryId: category.id, reviewStatus: "approved" } });
      if (normalizeKey(name) !== normalizeKey(m.name)) await prisma.$transaction(tx => addAliases(tx, m.id, [m.name], userId));
      await logAction(session, "UPDATE", "Material", m.id, `Aprovoi artikullin e ri "${name}" (${category.name})`);
      return NextResponse.json({ ok: true });
    }
    if (action === "merge") {
      if (!target || target.id === m.id) return NextResponse.json({ error: "Zgjidh artikullin me të cilin bashkohet." }, { status: 400 });
      await prisma.$transaction(async tx => {
        await tx.materialRequestItem.updateMany({ where: { materialId: m.id }, data: { materialId: target.id } });
        await tx.materialOrderItem.updateMany({ where: { materialId: m.id }, data: { materialId: target.id } });
        await addAliases(tx, target.id, [m.name, ...m.requestItems.map(r => r.sourceText ?? "").filter(Boolean)], userId);
        await tx.materialAlias.deleteMany({ where: { materialId: m.id } });
        await tx.material.delete({ where: { id: m.id } });
      });
      await logAction(session, "UPDATE", "Material", target.id, `Bashkoi artikullin e ri "${m.name}" me "${target.name}" (${m._count.requestItems} rreshta kërkesash)`);
      return NextResponse.json({ ok: true });
    }
    // delete — vetëm kur s'përdoret askund
    if (m._count.requestItems || m._count.orderItems) return NextResponse.json({ error: "Artikulli përdoret në kërkesa — bashkoje me një artikull ekzistues në vend që ta fshish." }, { status: 409 });
    await prisma.material.delete({ where: { id: m.id } });
    await logAction(session, "DELETE", "Material", m.id, `Fshiu artikullin e ri "${m.name}"`);
    return NextResponse.json({ ok: true });
  }

  // ── Pjesët e tekstit pa artikull (AUTO_CREATE_ITEMS i fikur) ──
  if (["createFromText", "linkText", "ignoreText"].includes(action)) {
    const item = await prisma.materialRequestItem.findFirst({ where: { id, isCustom: true, materialId: null, request: { organizationId: orgId } } });
    if (!item) return NextResponse.json({ error: "Pjesa nuk u gjet (ndoshta u shqyrtua tashmë)." }, { status: 404 });
    if (action === "ignoreText") {
      await prisma.materialRequestItem.update({ where: { id: item.id }, data: { matchType: "ignored" } });
      return NextResponse.json({ ok: true });
    }
    if (action === "createFromText") {
      if (name.length < 2) return NextResponse.json({ error: "Shkruaj emrin." }, { status: 400 });
      if (!category) return NextResponse.json({ error: "Zgjidh kategorinë." }, { status: 400 });
      const created = await prisma.$transaction(async tx => {
        const mat = await tx.material.create({ data: { organizationId: orgId, categoryId: category.id, name, defaultUnit: item.unit, source: "FROM_CUSTOM_REQUEST", reviewStatus: "approved", createdById: userId, createdFromRequestId: item.requestId } });
        await tx.materialRequestItem.update({ where: { id: item.id }, data: { materialId: mat.id, isCustom: false, matchType: "manual", addedToCatalogAsId: mat.id } });
        if (item.sourceText) await addAliases(tx, mat.id, [item.sourceText], userId);
        return mat;
      });
      await logAction(session, "CREATE", "Material", created.id, `Krijoi artikullin "${name}" nga teksti i mësuesit`);
      return NextResponse.json({ ok: true });
    }
    if (!target) return NextResponse.json({ error: "Zgjidh artikullin." }, { status: 400 });
    await prisma.$transaction(async tx => {
      await tx.materialRequestItem.update({ where: { id: item.id }, data: { materialId: target.id, isCustom: false, matchType: "manual" } });
      await addAliases(tx, target.id, [item.sourceText ?? item.customItemName ?? ""], userId);
    });
    await logAction(session, "UPDATE", "Material", target.id, `Lidhi tekstin "${item.customItemName}" me "${target.name}" (u ruajt si sinonim)`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Veprim i panjohur." }, { status: 400 });
}
