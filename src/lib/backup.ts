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

/** Krijon një backup për herë të parë sot, nëse nuk ekziston ende. */
export async function runDailyBackupIfNeeded() {
  const dest = path.join(getBackupDir(), `akademia-ora-${todayStamp()}.db`);
  if (fs.existsSync(dest)) return;
  await vacuumInto(dest);
  await pruneOldBackups();
}

/** Krijon një backup manual, gjithmonë, pavarësisht nëse ka një të sotmin. */
export async function createManualBackup(): Promise<string> {
  const now = new Date();
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const filename = `akademia-ora-${todayStamp(now)}_${time}-manual.db`;
  const dest = path.join(getBackupDir(), filename);
  await vacuumInto(dest);
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
