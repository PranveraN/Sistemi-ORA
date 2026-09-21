import path from "path";
import fs from "fs/promises";
import { getDbDir } from "./storage-dir";

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
