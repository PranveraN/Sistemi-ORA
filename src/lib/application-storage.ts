import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getDbDir } from "./storage-dir";

// Një dosje më vete për secilin aplikim (ndryshe nga material-attachment-storage.ts,
// që ruan gjithçka të sheshtë) — kështu fshirja e një aplikimi mund ta pastrojë
// krejt dosjen e tij me një `fs.rm(recursive:true)`, pa pasur nevojë të gjurmojë
// çdo skedar veç e veç.
export function getApplicationDir(applicationId: number): string {
  return path.join(getDbDir(), "enrollment-applications", String(applicationId));
}

const ALLOWED_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_EXT[mimeType] ?? null;
}

// Vetëm emra në formën "<hex>.<ext>" prodhuar nga vetë funksioni më poshtë —
// çdo gjë tjetër (p.sh. që përmban "..", "/") refuzohet për siguri.
const SAFE_FILENAME = /^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/;

export function isSafeApplicationFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename);
}

export async function saveApplicationDocument(applicationId: number, buffer: Buffer, mimeType: string): Promise<{ fileName: string }> {
  const ext = extensionForMimeType(mimeType);
  if (!ext) throw new Error("Lloj skedari i palejuar");

  const dir = getApplicationDir(applicationId);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), buffer);
  return { fileName };
}

export async function readApplicationDocument(applicationId: number, fileName: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isSafeApplicationFilename(fileName)) return null;
  const ext = fileName.split(".").pop()!;
  const contentType = Object.entries(ALLOWED_EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  try {
    const buffer = await fs.readFile(path.join(getApplicationDir(applicationId), fileName));
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function deleteApplicationDocument(applicationId: number, fileName: string): Promise<void> {
  if (!isSafeApplicationFilename(fileName)) return;
  await fs.unlink(path.join(getApplicationDir(applicationId), fileName)).catch(() => {});
}

export async function deleteApplicationDir(applicationId: number): Promise<void> {
  await fs.rm(getApplicationDir(applicationId), { recursive: true, force: true }).catch(() => {});
}
