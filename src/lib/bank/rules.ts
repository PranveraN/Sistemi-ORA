import type { PrismaClient } from "@prisma/client";

// Zërat dhe rregullat e klasifikimit të lëvizjeve bankare.

export const ZER_LLOJET = {
  E_HYRE:   "E hyrë",
  SHPENZIM: "Shpenzim",
  KTHIM:    "Kthim (zbritet nga të hyrat)",
  FINANCIM: "Financim (jashtë bilancit)",
  JASHTE:   "Jashtë bilancit",
} as const;
export type ZerLloji = keyof typeof ZER_LLOJET;
export const isZerLloji = (v: unknown): v is ZerLloji => typeof v === "string" && v in ZER_LLOJET;

export interface RuleLite { id: number; fjala: string; drejtimi: string | null; zerId: number | null; prioriteti: number }
export interface MoveLite { lloji: string | null; pala: string | null; pershkrimi: string | null; drejtimi: "HYRJE" | "DALJE" }

/** Teksti mbi të cilin kontrollohen rregullat (pa dallim shkronjash). */
export const ruleText = (m: Omit<MoveLite, "drejtimi">) => `${m.lloji ?? ""} ${m.pala ?? ""} ${m.pershkrimi ?? ""}`.toUpperCase();

/** Rregulli i parë (sipas prioritetit) që përputhet; `*` = çdo rresht i atij drejtimi. */
export function matchRule(m: MoveLite, rules: RuleLite[]): RuleLite | null {
  const t = ruleText(m);
  for (const r of rules) {
    if (r.drejtimi && r.drejtimi !== m.drejtimi) continue;
    const f = r.fjala.trim().toUpperCase();
    if (f === "*" || (f && t.includes(f))) return r;
  }
  return null;
}

export async function loadRules(db: PrismaClient, orgId: number): Promise<RuleLite[]> {
  return db.bankRregull.findMany({
    where: { organizationId: orgId, aktiv: true },
    orderBy: [{ prioriteti: "asc" }, { id: "asc" }],
    select: { id: true, fjala: true, drejtimi: true, zerId: true, prioriteti: true },
  });
}

// ── Zërat dhe rregullat fillestare (nga analiza e ekstraktit BKT 2021) ─────────
const DEFAULT_ZERAT: { emri: string; lloji: ZerLloji }[] = [
  { emri: "Shkollimi – transfer nga prindi", lloji: "E_HYRE" },
  { emri: "Shkollimi – TIMI Invest",          lloji: "E_HYRE" },
  { emri: "Shkollimi – depozitë cash",        lloji: "E_HYRE" },
  { emri: "Kthim i pagesës te prindi",        lloji: "KTHIM" },
  { emri: "Paga",                             lloji: "SHPENZIM" },
  { emri: "Qiraja",                           lloji: "SHPENZIM" },
  { emri: "Transporti (gira)",                lloji: "SHPENZIM" },
  { emri: "Furnitorë",                        lloji: "SHPENZIM" },
  { emri: "Rryma (KEDS)",                     lloji: "SHPENZIM" },
  { emri: "Uji (KUR)",                        lloji: "SHPENZIM" },
  { emri: "Telefon / Internet",               lloji: "SHPENZIM" },
  { emri: "Sigurimi i shkollës",              lloji: "SHPENZIM" },
  { emri: "Komisione bankare",                lloji: "SHPENZIM" },
  { emri: "Tërheqje cash",                    lloji: "JASHTE" },
];
// [fjala, drejtimi, zëri (null = Të paklasifikuara), prioriteti]
const DEFAULT_RREGULLAT: [string, "HYRJE" | "DALJE" | null, string | null, number][] = [
  ["COMMISSION", "DALJE", "Komisione bankare", 10],
  ["KOMISION", "DALJE", "Komisione bankare", 11],
  ["EMRI I PERF GABIM", "DALJE", "Kthim i pagesës te prindi", 20],
  ["EMRI I PERFITUESIT ESHTE GABIM", "DALJE", "Kthim i pagesës te prindi", 21],
  ["1971897927031194", null, null, 30],
  ["KALIM", "HYRJE", null, 31],
  ["MJETEVE", "HYRJE", null, 32],
  ["TRANSFER PER PAGESA", "HYRJE", null, 33],
  ["CASH WITHDRAWAL", "DALJE", "Tërheqje cash", 40],
  ["KEDS", "DALJE", "Rryma (KEDS)", 50],
  ["KUR PRISHTINA", "DALJE", "Uji (KUR)", 51],
  ["TELEKOM", "DALJE", "Telefon / Internet", 52],
  ["RROG", "DALJE", "Paga", 60],
  ["ROGES", "DALJE", "Paga", 61],
  ["OGES PER", "DALJE", "Paga", 62],
  ["QIRAN", "DALJE", "Qiraja", 70],
  ["SECURITY", "DALJE", "Sigurimi i shkollës", 71],
  ["PER GIRA", "DALJE", "Transporti (gira)", 72],
  ["FATUR", "DALJE", "Furnitorë", 80],
  ["GALANTERI", "DALJE", "Furnitorë", 81],
  ["TIMI INVEST", "HYRJE", "Shkollimi – TIMI Invest", 90],
  ["CASH DEPOSIT", "HYRJE", "Shkollimi – depozitë cash", 91],
  ["*", "HYRJE", "Shkollimi – transfer nga prindi", 900],
];

/** Krijon zërat dhe rregullat fillestare vetëm nëse organizata s'ka ende asnjë zë. */
export async function ensureBankDefaults(db: PrismaClient, orgId: number): Promise<void> {
  if (!(await db.bankZer.count({ where: { organizationId: orgId } }))) {
    const ids = new Map<string, number>();
    for (const [i, z] of DEFAULT_ZERAT.entries()) {
      const row = await db.bankZer.create({ data: { organizationId: orgId, emri: z.emri, lloji: z.lloji, renditja: i } });
      ids.set(z.emri, row.id);
    }
    await db.bankRregull.createMany({
      data: DEFAULT_RREGULLAT.map(([fjala, drejtimi, zer, prioriteti]) => ({ organizationId: orgId, fjala, drejtimi, zerId: zer ? ids.get(zer)! : null, prioriteti })),
    });
  }
  await applyUpgrades(db, orgId);
}

// ── Shtesat e mëvonshme (një herë për organizatë; versioni ruhet te Setting) ──────────
// v2 (09.11.2026): kalimet mes llogarive të Akademisë Ora (…1291 ↔ …1194) — Financim,
// jashtë bilancit; para rregullit të vjetër që i linte "Të paklasifikuara".
const UPGRADES: { v: number; zerat: { emri: string; lloji: ZerLloji }[]; rregullat: [string, "HYRJE" | "DALJE" | null, string, number][] }[] = [
  {
    v: 2,
    zerat: [
      { emri: "Kalim mjetesh nga llogaria tjetër e Akademisë Ora", lloji: "FINANCIM" },
      { emri: "Kalim mjetesh te llogaria tjetër e Akademisë Ora", lloji: "FINANCIM" },
    ],
    rregullat: [
      ["BY ORDER OF AKADEMIA ORA", "HYRJE", "Kalim mjetesh nga llogaria tjetër e Akademisë Ora", 25],
      ["1971897927031194", "DALJE", "Kalim mjetesh te llogaria tjetër e Akademisë Ora", 26],
    ],
  },
];

async function applyUpgrades(db: PrismaClient, orgId: number) {
  const key = `bankDefaultsVersion:${orgId}`;
  const current = parseInt((await db.setting.findUnique({ where: { key } }))?.value ?? "1");
  for (const u of UPGRADES.filter(u => u.v > current)) {
    const max = (await db.bankZer.aggregate({ where: { organizationId: orgId }, _max: { renditja: true } }))._max.renditja ?? 0;
    const ids = new Map<string, number>();
    for (const [i, z] of u.zerat.entries()) {
      const ex = await db.bankZer.findFirst({ where: { organizationId: orgId, emri: z.emri } });
      ids.set(z.emri, ex?.id ?? (await db.bankZer.create({ data: { organizationId: orgId, emri: z.emri, lloji: z.lloji, renditja: max + 1 + i } })).id);
    }
    for (const [fjala, drejtimi, zer, prioriteti] of u.rregullat) {
      if (await db.bankRregull.findFirst({ where: { organizationId: orgId, fjala, drejtimi, zerId: ids.get(zer) } })) continue;
      await db.bankRregull.create({ data: { organizationId: orgId, fjala, drejtimi, zerId: ids.get(zer)!, prioriteti } });
    }
    await db.setting.upsert({ where: { key }, update: { value: String(u.v) }, create: { key, value: String(u.v) } });
  }
}
