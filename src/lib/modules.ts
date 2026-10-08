// Regjistri qendror i "moduleve" të panelit të stafit — përdoret nga faqja e
// re e administrimit të lejeve (/superadmin/[id], skeda "Lejet e Moduleve"),
// nga middleware (kontrolli i qasjes në faqe) dhe nga auth.ts (llogaritja e
// listës së moduleve të lejuara, e ngulitur në JWT në momentin e kyçjes).
//
// PA PËRFSHIRË: rolet SUPERADMIN (gjithmonë qasje e plotë, jashtë këtij
// sistemi) dhe TEACHER (portal krejt i veçantë, /kerkesa-material, jashtë
// grupit (dashboard) — restriksioni i tij mbetet i vetin, i pandryshuar).

export interface ModuleDef {
  key: string;
  label: string;
  /** Prefikset e shtegut (pathname) që i përkasin këtij moduli. */
  pathPrefixes: string[];
}

export const MODULES: ModuleDef[] = [
  { key: "dashboard",       label: "Dashboard",                 pathPrefixes: ["/dashboard"] },
  { key: "students",        label: "Nxënësit",                  pathPrefixes: ["/students"] },
  { key: "shkollimi",       label: "Shkollimi",                 pathPrefixes: ["/shkollimi"] },
  { key: "eshkollori",      label: "Eshkollori",                pathPrefixes: ["/eshkollori"] },
  { key: "ushqimi",         label: "Ushqimi",                   pathPrefixes: ["/ushqimi"] },
  { key: "uniforma",        label: "Uniformat",                 pathPrefixes: ["/uniforma"] },
  { key: "librat",          label: "Librat e Anglishtes",       pathPrefixes: ["/librat"] },
  { key: "payments",        label: "Pagesat (listë e përgjithshme)", pathPrefixes: ["/payments"] },
  { key: "invoices",        label: "Faturat",                   pathPrefixes: ["/invoices"] },
  { key: "faturat-rregullta", label: "Faturat e Rregullta",     pathPrefixes: ["/faturat-rregullta"] },
  { key: "kerkesat",        label: "Kërkesat për Materiale",     pathPrefixes: ["/materialet", "/kerkesat"] },
  { key: "materiale",       label: "Materialet (Inventari)",    pathPrefixes: ["/materiale"] },
  { key: "sms",             label: "SMS",                       pathPrefixes: ["/sms"] },
  { key: "classes",         label: "Klasat",                    pathPrefixes: ["/classes"] },
  { key: "regjistrimet",    label: "Regjistrimet (Aplikimet)",  pathPrefixes: ["/regjistrimet"] },
  { key: "levizjet",        label: "Lëvizjet e Nxënësve",        pathPrefixes: ["/levizjet"] },
  { key: "shpenzime",       label: "Shpenzimet e Përgjithshme", pathPrefixes: ["/shpenzime"] },
  { key: "dorezimet",       label: "Dorëzimet",                 pathPrefixes: ["/dorezimet"] },
  { key: "hyrat",           label: "Të Hyra Tjera",              pathPrefixes: ["/hyrat"] },
  { key: "sekretaria",      label: "Sekretaria",                pathPrefixes: ["/sekretaria"] },
  { key: "families",        label: "Familjet",                  pathPrefixes: ["/families"] },
  { key: "dokumentet",      label: "Dokumentet",                pathPrefixes: ["/dokumentet"] },
  { key: "reports",         label: "Raportet",                  pathPrefixes: ["/reports"] },
  { key: "bilanci",         label: "Bilanci",                   pathPrefixes: ["/bilanci"] },
  { key: "arkiva",          label: "Arkiva",                    pathPrefixes: ["/arkiva"] },
  { key: "fletorja",        label: "Fletorja",                  pathPrefixes: ["/fletorja"] },
  { key: "investime",       label: "Investimet",                pathPrefixes: ["/investime"] },
  { key: "arka",            label: "Numërimi i Arkave",         pathPrefixes: ["/arka"] },
  { key: "historiku",       label: "Historiku (Audit Log)",     pathPrefixes: ["/historiku"] },
  { key: "settings",        label: "Cilësimet",                 pathPrefixes: ["/settings"] },
];

export const MODULE_KEYS = MODULES.map(m => m.key);

/** Rolet që kanë lejet e tyre të konfigurueshme te ky sistem. */
export const CONFIGURABLE_ROLES = ["ADMIN", "FINANCE", "SECRETARY", "PEDAGOGIA"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

/**
 * Parazgjedhjet — përdoren VETËM kur s'ekziston ende një rresht eksplicit në
 * RoleModulePermission për kombinimin (rol, modul). Kjo garanton që instalimi
 * ekzistues të mos ndryshojë sjellje deri sa dikush të prekë faqen e re të
 * administrimit — vlerat riprodhojnë saktësisht atë çka ishte E NËNKUPTUAR
 * deri tani nga menyja anësore (Sidebar.tsx), e cila fshihte lidhje sipas
 * rolit, por pa e zbatuar KURRË vërtet në middleware/API (shih gjetjen: Admin
 * dhe Financë/Sekretari ishin praktikisht të pambrojtura nga njëra-tjetra).
 * Tani ajo ndarje bëhet REALE, jo më vetëm kozmetike.
 */
const FINANCE_MODULES = [
  "shkollimi", "eshkollori", "ushqimi", "uniforma", "librat",
  "payments", "invoices", "faturat-rregullta", "kerkesat", "materiale",
  "shpenzime", "dorezimet", "hyrat", "bilanci", "investime", "reports", "arka",
];
const SECRETARY_MODULES = ["sms", "sekretaria", "dokumentet"];
const SHARED_MODULES = ["dashboard", "students", "families", "levizjet", "regjistrimet", "classes", "arkiva", "fletorja"];
const PEDAGOGIA_MODULES = ["classes", "regjistrimet", "levizjet"];

export const DEFAULT_ALLOWED: Record<ConfigurableRole, string[]> = {
  ADMIN:     MODULE_KEYS,
  FINANCE:   [...SHARED_MODULES, ...FINANCE_MODULES],
  SECRETARY: [...SHARED_MODULES, ...SECRETARY_MODULES],
  PEDAGOGIA: PEDAGOGIA_MODULES,
};

export function isConfigurableRole(role: string): role is ConfigurableRole {
  return (CONFIGURABLE_ROLES as readonly string[]).includes(role);
}

/** Gjen modulin që i përgjigjet një shtegu (pathname) të dhënë, nëse ka. */
export function moduleForPath(pathname: string): ModuleDef | null {
  for (const m of MODULES) {
    if (m.pathPrefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))) return m;
  }
  return null;
}

/** Shtegu i parë i lejuar për një listë modulesh — përdoret si destinacion
 * "shtëpie" kur dikush provon të hapë një faqe që s'i lejohet. */
export function firstAllowedPath(allowedModules: string[]): string | null {
  for (const m of MODULES) {
    if (allowedModules.includes(m.key)) return m.pathPrefixes[0];
  }
  return null;
}
