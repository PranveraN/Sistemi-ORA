import zlib from "zlib";

// Nxjerr fotot e faqeve nga një PDF i skanuar (një foto për faqe), si skedarë PNG/JPEG
// që OCR-ja i lexon. Mbështet fotot FlateDecode (RGB/gri, 8 bit) dhe DCTDecode (JPEG) —
// formati i ekstrakteve "Llogaria e-Deklarata" të BKT-së të printuara si PDF.

export interface PageImage { index: number; width: number; height: number; data: Buffer; kind: "png" | "jpeg" }

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(d: Buffer): number { let c = -1; for (const x of d) c = CRC_TABLE[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function toPng(raw: Buffer, w: number, h: number, channels: 1 | 3): Buffer {
  const stride = w * channels;
  const rows = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) raw.copy(rows, y * (stride + 1) + 1, y * stride, y * stride + stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = channels === 1 ? 0 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rows, { level: 1 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Numri i fotove të faqeve në PDF (pa i dekoduar). */
export function countPdfImages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Subtype\s*\/Image/g) || []).length;
}

/** Kthen fotot sipas radhës; `onlyIndex` (nga 1) nxjerr vetëm njërën. */
export function* extractPdfImages(pdf: Buffer): Generator<PageImage> {
  const s = pdf.toString("latin1");
  const re = /\/Subtype\s*\/Image/g;
  let m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    i++;
    const objStart = s.lastIndexOf(" obj", m.index);
    const streamAt = s.indexOf("stream", m.index);
    if (objStart < 0 || streamAt < 0) continue;
    const dict = s.slice(objStart, streamAt);
    const W = +(dict.match(/\/Width\s+(\d+)/)?.[1] ?? 0), H = +(dict.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
    if (!W || !H) continue;
    const bpc = +(dict.match(/\/BitsPerComponent\s+(\d+)/)?.[1] ?? 8);
    const lenM = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    let st = streamAt + 6; if (s[st] === "\r") st++; if (s[st] === "\n") st++;
    const end = lenM ? st + +lenM[1] : s.indexOf("endstream", st);
    const body = pdf.subarray(st, end);
    if (/\/DCTDecode/.test(dict)) { yield { index: i, width: W, height: H, data: Buffer.from(body), kind: "jpeg" }; continue; }
    if (!/\/FlateDecode/.test(dict) || bpc !== 8) continue;
    const raw = zlib.inflateSync(body);
    const channels: 1 | 3 = raw.length >= W * H * 3 ? 3 : 1;
    yield { index: i, width: W, height: H, data: toPng(raw, W, H, channels), kind: "png" };
  }
}
