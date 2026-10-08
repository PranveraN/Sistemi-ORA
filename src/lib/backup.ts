import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;
const FILENAME_RE = /^akademia-ora-\d{4}-\d{2}-\d{2}(?:_\d{6}-manual)?\.db$/;

function getDbPath(): string {
  const url = process.env.DATABASE_URL || "";
  const raw = url.replace(/^file:/, "");
  // Prisma resolves relative sqlite paths relative to the prisma/ folder.
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), "prisma", raw);
}

function getBackupDir(): string {
  return path.join(path.dirname(getDbPath()), "backups");
}

function todayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function pruneOldBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(dir)) {
    if (!FILENAME_RE.test(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
  }
}

async function vacuumInto(destPath: string) {
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  const escaped = destPath.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
}

/**
 * Kopje e veçantë e gjurmës së auditimit (FinAuditLog) jashtë databazës:
 * `backups/finauditlog.ndjson`, një rresht JSON për çdo ndryshim, vetëm shtim
 * (shtohen vetëm rreshtat e rinj që nga eksporti i fundit). S'fshihet nga
 * pastrimi 30-ditor — gjurma mbetet edhe nëse databaza rikthehet nga një
 * backup më i vjetër. (Backup-et .db e përfshijnë gjithsesi tabelën.)
 */
export async function exportFinAuditLog(): Promise<number> {
  const dir = getBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "finauditlog.ndjson");
  const stateFile = path.join(dir, "finauditlog.lastid");
  let lastId = 0;
  try { lastId = parseInt(fs.readFileSync(stateFile, "utf8"), 10) || 0; } catch { /* eksporti i parë */ }
  let total = 0;
  for (;;) {
    const rows = await prisma.finAuditLog.findMany({ where: { id: { gt: lastId } }, orderBy: { id: "asc" }, take: 5000 });
    if (rows.length === 0) break;
    fs.appendFileSync(file, rows.map(r => JSON.stringify(r)).join("\n") + "\n");
    lastId = rows[rows.length - 1].id;
    fs.writeFileSync(stateFile, String(lastId));
    total += rows.length;
  }
  return total;
}

/** Krijon një backup për herë të parë sot, nëse nuk ekziston ende. */
export async function runDailyBackupIfNeeded() {
  const dest = path.join(getBackupDir(), `akademia-ora-${todayStamp()}.db`);
  if (fs.existsSync(dest)) return;
  await vacuumInto(dest);
  await exportFinAuditLog().catch(err => console.error("[backup] eksporti i FinAuditLog dështoi:", err));
  await pruneOldBackups();
}

/** Krijon një backup manual, gjithmonë, pavarësisht nëse ka një të sotmin. */
export async function createManualBackup(): Promise<string> {
  const now = new Date();
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const filename = `akademia-ora-${todayStamp(now)}_${time}-manual.db`;
  const dest = path.join(getBackupDir(), filename);
  await vacuumInto(dest);
  await exportFinAuditLog().catch(err => console.error("[backup] eksporti i FinAuditLog dështoi:", err));
  await pruneOldBackups();
  return filename;
}

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
  manual: boolean;
}

export function listBackups(): BackupInfo[] {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(name => FILENAME_RE.test(name))
    .map(name => {
      const stat = fs.statSync(path.join(dir, name));
      return {
        filename: name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        manual: name.includes("-manual"),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBackupFilePath(filename: string): string | null {
  if (!FILENAME_RE.test(filename)) return null;
  const full = path.join(getBackupDir(), filename);
  return fs.existsSync(full) ? full : null;
}

/**
 * Backup me emër të veçantë para një veprimi të madh (p.sh. migrimi i shpenzimeve).
 * S'fshihet nga pastrimi automatik (30 ditë) — ruhet derisa ta fshijë dikush me dorë.
 * Kthen emrin dhe shtegun e plotë (në server: /data/backups/...).
 */
export async function createNamedBackup(label: string): Promise<{ filename: string; path: string }> {
  const now = new Date();
  const stamp = `${todayStamp(now)}_${now.toISOString().slice(11, 19).replace(/:/g, "")}`;
  const filename = `akademia-ora-${label.replace(/[^a-z0-9-]/gi, "-")}-${stamp}.db`;
  const dest = path.join(getBackupDir(), filename);
  await vacuumInto(dest);
  return { filename, path: dest };
}

let schedulerStarted = false;

/** Niset një herë kur nis serveri: backup i menjëhershëm nëse mungon, pastaj kontroll çdo orë. */
export function startBackupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  runDailyBackupIfNeeded().catch(err => console.error("[backup] gabim fillestar:", err));

  const interval = setInterval(() => {
    runDailyBackupIfNeeded().catch(err => console.error("[backup] gabim i planifikuar:", err));
  }, 60 * 60 * 1000);
  interval.unref();
}
