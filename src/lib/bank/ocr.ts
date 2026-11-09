import path from "path";
import os from "os";
import fs from "fs";
import { extractPdfImages, countPdfImages } from "@/lib/bank/pdfImages";

// OCR i ekstrakteve të skanuara me tesseract.js — punon lokalisht në server, pa internet:
// gjuha (eng) vjen nga paketa @tesseract.js-data/eng brenda node_modules.
const LANG_PATH = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int");
const WORKERS = 2;

export async function ocrPdf(pdf: Buffer, onPage?: (done: number, total: number) => Promise<void> | void): Promise<string[]> {
  const total = countPdfImages(pdf);
  if (!total) throw new Error("PDF-ja s'ka faqe të skanuara (foto). A është ekstrakti i bankës?");
  const { createWorker, createScheduler } = await import("tesseract.js");
  const cachePath = path.join(os.tmpdir(), "ora-tesseract");
  fs.mkdirSync(cachePath, { recursive: true });
  const scheduler = createScheduler();
  try {
    for (let i = 0; i < Math.min(WORKERS, total); i++) {
      const w = await createWorker("eng", 1, { langPath: LANG_PATH, cachePath, gzip: true });
      await w.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: "6" as never });
      scheduler.addWorker(w);
    }
    const texts: string[] = new Array(total).fill("");
    let done = 0;
    const jobs: Promise<void>[] = [];
    let k = 0;
    for (const img of extractPdfImages(pdf)) {
      const slot = k++;
      jobs.push(scheduler.addJob("recognize", img.data).then(async r => {
        texts[slot] = r.data.text;
        done++;
        await onPage?.(done, total);
      }));
      // Mos i mbaj të gjitha fotot në memorie njëherësh
      if (jobs.length % (WORKERS * 2) === 0) await Promise.all(jobs.slice(-WORKERS * 2));
    }
    await Promise.all(jobs);
    return texts.slice(0, k);
  } finally {
    await scheduler.terminate();
  }
}
