import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getDbDir } from "./storage-dir";
import { extensionForUpload } from "./document-storage";

// Evidencat e PIA-s (të dhëna të NDJESHME) — dosje e veçantë nga "Dokumentet"
// e përgjithshme, që të mos ndahen kurrë me lidhje publike. Emri në disk =
// hex i rastësishëm + ekstensioni (si document-storage.ts).

export const MAX_PIA_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function getPiaFilesDir(): string {
  return path.join(getDbDir(), "pia-files");
}

const SAFE_FILENAME = /^[a-f0-9]{32}\.(jpg|png|webp|pdf|doc|docx)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function savePiaFile(buffer: Buffer, mimeType: string, originalFileName: string): Promise<{ fileName: string; mimeType: string }> {
  const ext = extensionForUpload(mimeType, originalFileName);
  if (!ext) throw new Error("Lejohen vetëm foto (JPG/PNG/WebP), PDF ose Word (DOC/DOCX).");
  const dir = getPiaFilesDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), buffer);
  return { fileName, mimeType: CONTENT_TYPES[ext] };
}

export async function readPiaFile(fileName: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!SAFE_FILENAME.test(fileName)) return null;
  try {
    const buffer = await fs.readFile(path.join(getPiaFilesDir(), fileName));
    return { buffer, contentType: CONTENT_TYPES[fileName.split(".").pop()!] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
