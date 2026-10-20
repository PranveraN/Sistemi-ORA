import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getDbDir } from "./storage-dir";

// Fotot e produkteve të uniformave — i njëjti volum si databaza (si fotot e
// nxënësve). Emri i ruajtur te UniProduct.photo: "<id>-<hex>.<ext>" (emër i ri
// për çdo ngarkim, që shfletuesi të mos tregojë foton e vjetër nga cache).

export const MAX_UNIFORM_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const SAFE = /^\d+-[a-f0-9]{12}\.(jpg|png|webp)$/;

export function getUniformPhotosDir(): string {
  return path.join(getDbDir(), "uniform-photos");
}

export function isSafeUniformPhoto(name: string | null | undefined): name is string {
  return !!name && SAFE.test(name);
}

export async function saveUniformPhoto(productId: number, buffer: Buffer, mimeType: string): Promise<string> {
  const ext = EXT[mimeType];
  if (!ext) throw new Error("Lejohen vetëm foto JPG, PNG ose WebP.");
  const dir = getUniformPhotosDir();
  await fs.mkdir(dir, { recursive: true });
  const name = `${productId}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, name), buffer);
  return name;
}

export async function readUniformPhoto(name: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isSafeUniformPhoto(name)) return null;
  try {
    return { buffer: await fs.readFile(path.join(getUniformPhotosDir(), name)), contentType: TYPES[name.split(".").pop()!] };
  } catch {
    return null;
  }
}

export async function deleteUniformPhoto(name: string | null | undefined): Promise<void> {
  if (!isSafeUniformPhoto(name)) return;
  try { await fs.unlink(path.join(getUniformPhotosDir(), name)); } catch { /* mund të mos ekzistojë */ }
}
