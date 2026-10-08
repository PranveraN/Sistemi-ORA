import { AUDITED_TABLES, type AuditedTable } from "./tables";

// Triggers e SQLite që shkruajnë FinAuditLog për çdo INSERT/UPDATE/DELETE në
// tabelat financiare — në nivel databaze, ndaj kapin edhe ndryshimet që s'kalojnë
// nga kodi (SQL i papërpunuar, import, mjete të jashtme). Përdoruesi/IP/arsyeja
// merren nga FinAuditContext (id=1), që shtresa e kodit (src/lib/prisma.ts) e
// vendos brenda të njëjtit transaksion; pa të, rreshti shënohet source="DB".
//
// Prisma (db push) s'i menaxhon triggers, prandaj krijohen/rikrijohen në çdo
// nisje të serverit (src/instrumentation.ts). Kur një tabelë merr kolona të
// reja, SQL-i ndryshon dhe trigger-i rikrijohet vetvetiu.

type RawDb = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

const NOW_MS = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";
const PREFIX = "finaudit_";
const id = (s: string) => `"${s.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

function jsonOf(row: "NEW" | "OLD", cols: string[]): string {
  // json_object pranon deri 127 argumente (2 për kolonë)
  if (cols.length > 63) throw new Error(`Auditimi: tabela ka ${cols.length} kolona — më shumë se 63 s'mbështeten`);
  return `json_object(${cols.map(c => `${lit(c)}, ${row}.${id(c)}`).join(", ")})`;
}

function logInsert(table: string, action: string, recordExpr: string, oldJson: string, newJson: string): string {
  return `INSERT INTO "FinAuditLog" ("tableName","recordId","action","oldValues","newValues","userId","userName","ip","userAgent","reason","source","createdAt")
    SELECT ${lit(table)}, ${recordExpr}, ${lit(action)}, ${oldJson}, ${newJson}, c."userId", c."userName", c."ip", c."userAgent", c."reason",
      CASE WHEN c."id" IS NULL THEN 'DB' ELSE 'APP' END, ${NOW_MS}
    FROM (SELECT 1) AS one LEFT JOIN "FinAuditContext" AS c ON c."id" = 1;`;
}

/** SQL-i i tri triggers (krijim, ndryshim, fshirje) për një tabelë me kolonat e dhëna. */
export function buildTableTriggers(t: AuditedTable, tableCols: string[]): { name: string; sql: string }[] {
  const cols = t.columns ? t.columns.filter(c => tableCols.includes(c)) : tableCols;
  const tracked = cols.filter(c => c !== "updatedAt");
  const withId = tableCols.includes("id") && !cols.includes("id") ? ["id", ...cols] : cols;
  const T = t.table;
  const changed = tracked.map(c => `OLD.${id(c)} IS NOT NEW.${id(c)}`).join(" OR ");
  const updateOf = t.columns ? ` OF ${tracked.map(id).join(", ")}` : "";
  return [
    {
      name: `${PREFIX}${T}_ins`,
      sql: `CREATE TRIGGER ${id(`${PREFIX}${T}_ins`)} AFTER INSERT ON ${id(T)} BEGIN
  ${logInsert(T, "CREATE", "NEW.\"id\"", "NULL", jsonOf("NEW", withId))}
END`,
    },
    {
      name: `${PREFIX}${T}_upd`,
      sql: `CREATE TRIGGER ${id(`${PREFIX}${T}_upd`)} AFTER UPDATE${updateOf} ON ${id(T)} WHEN ${changed} BEGIN
  ${logInsert(T, "UPDATE", "NEW.\"id\"", jsonOf("OLD", withId), jsonOf("NEW", withId))}
END`,
    },
    {
      name: `${PREFIX}${T}_del`,
      sql: `CREATE TRIGGER ${id(`${PREFIX}${T}_del`)} AFTER DELETE ON ${id(T)} BEGIN
  ${logInsert(T, "DELETE", "OLD.\"id\"", jsonOf("OLD", withId), "NULL")}
END`,
    },
  ];
}

/** Bllokimi: FinAuditLog vetëm shtim — asnjë UPDATE/DELETE, për asnjë rol. */
export const GUARD_TRIGGERS: { name: string; sql: string }[] = [
  {
    name: `${PREFIX}guard_upd`,
    sql: `CREATE TRIGGER "${PREFIX}guard_upd" BEFORE UPDATE ON "FinAuditLog" BEGIN
  SELECT RAISE(ABORT, 'FinAuditLog: gjurma e auditimit nuk mund të ndryshohet');
END`,
  },
  {
    name: `${PREFIX}guard_del`,
    sql: `CREATE TRIGGER "${PREFIX}guard_del" BEFORE DELETE ON "FinAuditLog" BEGIN
  SELECT RAISE(ABORT, 'FinAuditLog: gjurma e auditimit nuk mund të fshihet');
END`,
  },
];

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Krijon ose rikrijon (vetëm kur SQL-i ka ndryshuar) të gjitha triggers e
 * auditimit. Idempotente — e sigurt për t'u thirrur në çdo nisje.
 */
export async function ensureAuditTriggers(db: RawDb): Promise<{ created: number; unchanged: number; skipped: string[] }> {
  const existing = await db.$queryRawUnsafe<{ name: string; sql: string }[]>(
    `SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE '${PREFIX}%'`,
  );
  const current = new Map(existing.map(r => [r.name, r.sql]));
  const hasLog = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('FinAuditLog', 'FinAuditContext')`);
  if (Number(hasLog[0]?.n) < 2) throw new Error("Auditimi: tabelat FinAuditLog/FinAuditContext mungojnë (s'është bërë db push)");

  const wanted: { name: string; sql: string }[] = [...GUARD_TRIGGERS];
  const skipped: string[] = [];
  for (const t of AUDITED_TABLES) {
    const info = await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info(${id(t.table)})`);
    if (info.length === 0) { skipped.push(t.table); continue; }
    wanted.push(...buildTableTriggers(t, info.map(c => c.name)));
  }

  let created = 0, unchanged = 0;
  for (const w of wanted) {
    const have = current.get(w.name);
    if (have && norm(have) === norm(w.sql)) { unchanged++; continue; }
    if (have) await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${id(w.name)}`);
    await db.$executeRawUnsafe(w.sql);
    created++;
  }
  return { created, unchanged, skipped };
}
