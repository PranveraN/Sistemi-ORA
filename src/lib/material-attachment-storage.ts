import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// I njëjti volum/direktori si baza SQLite (shih photo-storage.ts) — mbijeton
// rindërtimeve/rideploy-eve pikërisht si baza e të dhënave.
function getDbDir(): string {
  const url = process.env.DATABASE_URL || "file:./akademia-ora.db";
  const filePath = url.replace(/^file:/, "");
  if (path.isAbsolute(filePath)) return path.dirname(filePath);
  return path.dirname(path.resolve(process.cwd(), "prisma", filePath));
}

export function getMaterialAttachmentsDir(): string {
  return path.join(getDbDir(), "material-attachments");
}

// Emri i ruajtur në disk = UUID i rastësishëm + ekstensioni, i pavarur nga emri
// origjinal i skedarit (shmang path-traversal dhe përplasje emrash).
const ALLOWED_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_EXT[mimeType] ?? null;
}

// Vetëm emra në formën "<hex>.<ext>" prodhuar nga kjo vetë funksioni —
// çdo gjë tjetër (p.sh. që përmban "..", "/") refuzohet për siguri.
const SAFE_FILENAME = /^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/;

export function isSafeAttachmentFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename);
}

export async function saveMaterialAttachment(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = extensionForMimeType(mimeType);
  if (!ext) throw new Error("Lloj skedari i palejuar");

  const dir = getMaterialAttachmentsDir();
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return filename;
}

export async function readMaterialAttachment(filename: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isSafeAttachmentFilename(filename)) return null;
  const ext = filename.split(".").pop()!;
  const contentType = Object.entries(ALLOWED_EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  try {
    const buffer = await fs.readFile(path.join(getMaterialAttachmentsDir(), filename));
    return { buffer, contentType };
  } catch {
    return null;
  }
}
