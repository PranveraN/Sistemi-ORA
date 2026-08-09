import path from "path";
import fs from "fs/promises";

// Reuses the same directory as the SQLite database (DATABASE_URL="file:...")
// so student photos live on the same persistent Docker volume as the DB —
// no separate volume mount needed, and photos survive rebuilds/redeploys
// exactly like the database file does.
function getDbDir(): string {
  const url = process.env.DATABASE_URL || "file:./akademia-ora.db";
  const filePath = url.replace(/^file:/, "");
  if (path.isAbsolute(filePath)) return path.dirname(filePath);
  // Prisma resolves relative SQLite URLs relative to prisma/schema.prisma,
  // not process.cwd() — match that so photos land next to the actual DB file.
  return path.dirname(path.resolve(process.cwd(), "prisma", filePath));
}

export function getPhotosDir(): string {
  return path.join(getDbDir(), "student-photos");
}

const EXTENSIONS: [string, string][] = [
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
];

// Whether a student has a photo is determined purely by file presence on disk —
// no DB field to keep in sync, so it can never drift out of date.
export async function findStudentPhoto(studentId: number): Promise<{ path: string; contentType: string } | null> {
  const dir = getPhotosDir();
  for (const [ext, contentType] of EXTENSIONS) {
    const filePath = path.join(dir, `${studentId}.${ext}`);
    try {
      await fs.access(filePath);
      return { path: filePath, contentType };
    } catch {
      // try next extension
    }
  }
  return null;
}

export async function saveStudentPhoto(studentId: number, buffer: Buffer, ext: string): Promise<void> {
  const dir = getPhotosDir();
  await fs.mkdir(dir, { recursive: true });
  // Remove any existing photo under a different extension so re-uploads don't leave orphans.
  const existing = await findStudentPhoto(studentId);
  if (existing) await fs.unlink(existing.path).catch(() => {});
  await fs.writeFile(path.join(dir, `${studentId}.${ext}`), buffer);
}

export async function deleteStudentPhoto(studentId: number): Promise<void> {
  const existing = await findStudentPhoto(studentId);
  if (existing) await fs.unlink(existing.path).catch(() => {});
}
