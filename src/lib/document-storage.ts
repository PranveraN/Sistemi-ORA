import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getDbDir } from "./storage-dir";

export function getDocumentsDir(): string {
  return path.join(getDbDir(), "documents");
}

// Emri i ruajtur në disk = UUID i rastësishëm + ekstensioni, i pavarur nga
// emri origjinal i skedarit (shmang path-traversal dhe përplasje emrash),
// njësoj si material-attachment-storage.ts.
const ALLOWED_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15MB

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_EXT[mimeType] ?? null;
}

const SAFE_FILENAME = /^[a-f0-9]{32}\.(jpg|png|webp|pdf|doc|docx)$/;

export function isSafeDocumentFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename);
}

export async function saveDocument(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = extensionForMimeType(mimeType);
  if (!ext) throw new Error("Lloj skedari i palejuar");

  const dir = getDocumentsDir();
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return filename;
}

export async function readDocument(filename: string): Promise<Buffer | null> {
  if (!isSafeDocumentFilename(filename)) return null;
  try {
    return await fs.readFile(path.join(getDocumentsDir(), filename));
  } catch {
    return null;
  }
}

export async function deleteDocumentFile(filename: string): Promise<void> {
  if (!isSafeDocumentFilename(filename)) return;
  try {
    await fs.unlink(path.join(getDocumentsDir(), filename));
  } catch {
    // skedari mund të mos ekzistojë më — s'ka pse të dështojë fshirja e rreshtit
  }
}
