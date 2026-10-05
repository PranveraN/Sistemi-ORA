import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNIT_VALUES } from "@/lib/materialConstants";
import { REVIEW_CATEGORY_NAME } from "@/lib/materialConfig";
import { normalizeKey, cleanItemName, keyTokens, type CatalogEntry } from "@/lib/materialMatcher";
import { DEFAULT_SYNONYMS } from "@/lib/materialSynonyms";

// Kërkesat me tekst të lirë (forma e re e mësuesit) — pjesa e serverit:
// katalogu për përputhjen, verifikimi i rreshtave që dërgon klienti dhe
// trajtimi i pjesëve pa përputhje (artikull i ri "Pa rishikuar" ose tekst për
// shqyrtim, sipas çelësit AUTO_CREATE_ITEMS).

/** Katalogu për motorin e përputhjes: artikujt aktivë (të aprovuar + pa rishikuar) me sinonimet. */
export async function loadCatalogEntries(orgId: number): Promise<CatalogEntry[]> {
  const mats = await prisma.material.findMany({
    where: { organizationId: orgId, active: true },
    select: { id: true, name: true, defaultUnit: true, reviewStatus: true, category: { select: { name: true } }, aliases: { select: { alias: true } } },
    orderBy: { name: "asc" },
  });
  return mats.map(m => ({
    id: m.id, name: m.name, unit: m.defaultUnit, categoryName: m.category?.name ?? null,
    reviewStatus: m.reviewStatus,
    // Sinonimet e mësuara (databaza) + ato shqip të parazgjedhura (materialSynonyms.ts)
    aliases: [...m.aliases.map(a => a.alias), ...(DEFAULT_SYNONYMS[m.name] ?? [])],
  }));
}

export interface IncomingTextItem {
  materialId?: number | string | null;
  quantity?: number | string;
  unit?: string;
  sourceText?: string;
  matchType?: string;
  /** Emri i propozuar kur s'ka përputhje (pjesa "core" e tekstit). */
  newName?: string;
}

export interface TextItemRow {
  materialId: number | null;
  isCustom: boolean;
  customItemName: string | null;
  quantity: number;
  unit: string;
  sourceText: string | null;
  matchType: string;
  confirmedByTeacher: boolean;
}

const MATCH_TYPES = new Set(["exact", "alias", "fuzzy", "manual", "catalog"]);
const NON_MATERIAL = /^(\d+|klas\w*|\d{1,2}\s?[a-d])$/i;

/**
 * Verifikon rreshtat e klientit (artikujt ekzistues, sasitë, njësitë, teksti
 * burim). Pjesët pa artikull: me AUTO_CREATE → artikull i ri "Pa rishikuar"
 * (pa dyfishim); pa të → rresht teksti për shqyrtim (isCustom, matchType "new").
 */
export async function resolveTextItems(tx: Prisma.TransactionClient, opts: {
  orgId: number; userId: number; requestId: number; originalText: string; items: IncomingTextItem[]; autoCreate: boolean;
}): Promise<{ rows: TextItemRow[]; createdMaterials: number; error?: string }> {
  const { orgId, userId, requestId, originalText, autoCreate } = opts;
  const rows: TextItemRow[] = [];
  let createdMaterials = 0;
  const ids = opts.items.map(i => parseInt(String(i.materialId ?? ""))).filter(n => n > 0);
  const valid = new Map((await tx.material.findMany({ where: { id: { in: ids }, organizationId: orgId, active: true }, select: { id: true, defaultUnit: true } })).map(m => [m.id, m]));

  for (const raw of opts.items) {
    const quantity = Math.min(10_000, Math.max(1, parseInt(String(raw.quantity)) || 1));
    const sourceText = raw.sourceText ? String(raw.sourceText).slice(0, 300) : null;
    // Teksti burim duhet të jetë pjesë e tekstit të mësuesit (s'pranohet tekst i shpikur)
    if (sourceText && !originalText.includes(sourceText)) return { rows: [], createdMaterials: 0, error: "Artikujt nuk përputhen me tekstin — rifresko faqen dhe provo përsëri." };
    const id = parseInt(String(raw.materialId ?? "")) || 0;

    if (id) {
      const m = valid.get(id);
      if (!m) return { rows: [], createdMaterials: 0, error: "Një nga artikujt nuk ekziston më në katalog — rifresko faqen." };
      const unit = UNIT_VALUES.includes(String(raw.unit)) ? String(raw.unit) : m.defaultUnit;
      const matchType = MATCH_TYPES.has(String(raw.matchType)) ? String(raw.matchType) : "manual";
      rows.push({ materialId: id, isCustom: false, customItemName: null, quantity, unit, sourceText, matchType, confirmedByTeacher: true });
      continue;
    }

    // Pjesë pa përputhje
    const name = cleanItemName(String(raw.newName ?? "").slice(0, 120));
    if (name.replace(/[^a-zA-ZëËçÇ]/g, "").length < 3 || NON_MATERIAL.test(name.trim())) continue; // s'është material
    const unit = UNIT_VALUES.includes(String(raw.unit)) ? String(raw.unit) : "copë";

    if (autoCreate) {
      const material = await findOrCreatePending(tx, { orgId, userId, requestId, name, unit });
      if (material.created) createdMaterials++;
      rows.push({ materialId: material.id, isCustom: false, customItemName: null, quantity, unit, sourceText, matchType: "new", confirmedByTeacher: true });
    } else {
      rows.push({ materialId: null, isCustom: true, customItemName: name, quantity, unit, sourceText, matchType: "new", confirmedByTeacher: true });
    }
  }
  return { rows, createdMaterials };
}

/** Artikull "Pa rishikuar" — ripërdor një ekzistues me emër të njëjtë/shumë të ngjashëm (pa dyfishim). */
async function findOrCreatePending(tx: Prisma.TransactionClient, o: { orgId: number; userId: number; requestId: number; name: string; unit: string }): Promise<{ id: number; created: boolean }> {
  const key = normalizeKey(o.name);
  const tokens = keyTokens(o.name).join(" ");
  const existing = await tx.material.findMany({ where: { organizationId: o.orgId, active: true }, select: { id: true, name: true, aliases: { select: { normalized: true } } } });
  const same = existing.find(m => normalizeKey(m.name) === key || keyTokens(m.name).join(" ") === tokens || m.aliases.some(a => a.normalized === key));
  if (same) return { id: same.id, created: false };

  let cat = await tx.materialCategory.findFirst({ where: { organizationId: o.orgId, name: REVIEW_CATEGORY_NAME } });
  if (!cat) cat = await tx.materialCategory.create({ data: { organizationId: o.orgId, name: REVIEW_CATEGORY_NAME } });
  const m = await tx.material.create({
    data: {
      organizationId: o.orgId, categoryId: cat.id, name: o.name, defaultUnit: o.unit,
      source: "FROM_CUSTOM_REQUEST", reviewStatus: "pending", createdById: o.userId, createdFromRequestId: o.requestId,
    },
    select: { id: true },
  });
  return { id: m.id, created: true };
}

/**
 * Sa presin rishikim nga administrata: artikujt "Pa rishikuar" në katalog +
 * pjesët e tekstit pa artikull (kur AUTO_CREATE_ITEMS është i fikur) te
 * kërkesat e pambyllura. Një vend i vetëm për njoftimin dhe numrin te menyja.
 */
export async function countForReview(orgId: number): Promise<{ total: number; pendingItems: number; textParts: number }> {
  const [pendingItems, textParts] = await Promise.all([
    prisma.material.count({ where: { organizationId: orgId, active: true, reviewStatus: "pending" } }),
    prisma.materialRequestItem.count({
      where: { isCustom: true, materialId: null, matchType: "new", status: { not: "REJECTED" }, request: { organizationId: orgId, status: { notIn: ["REJECTED", "DELIVERED"] } } },
    }),
  ]);
  return { total: pendingItems + textParts, pendingItems, textParts };
}
