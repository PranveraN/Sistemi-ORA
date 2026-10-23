import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getDbDir } from "./storage-dir";
import { extensionForUpload } from "./document-storage";

// Dokumentet e transfereve nga TIMI (ekstrakt / mandat bankar) — moduli TIMI, Faza 3.
// Në të njëjtin volum si databaza (data/timi-docs). Emri në disk = hex i rastësishëm + ekstensioni.
export const MAX_TIMI_DOC_SIZE = 15 * 1024 * 1024;
export const SAFE_TIMI_DOC = /^[a-f0-9]{32}\.(jpg|png|webp|pdf|doc|docx)$/;
const TYPES: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const dir = () => path.join(getDbDir(), "timi-docs");

export async function saveTimiDoc(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
  const ext = extensionForUpload(mimeType, originalName);
  if (!ext) throw new Error("Lejohen vetëm PDF, foto (JPG/PNG/WebP) ose Word.");
  await fs.mkdir(dir(), { recursive: true });
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir(), name), buffer);
  return name;
}

export async function readTimiDoc(name: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!SAFE_TIMI_DOC.test(name)) return null;
  try {
    return { buffer: await fs.readFile(path.join(dir(), name)), contentType: TYPES[name.split(".").pop()!] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
