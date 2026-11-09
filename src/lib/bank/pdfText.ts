// Ekstraktet që banka i jep si PDF me TEKST (p.sh. "TransactionReport" i e-banking-ut, 2024 e tutje)
// lexohen drejtpërdrejt — pa OCR, pa gabime leximi dhe në pak sekonda. Kthen null nëse PDF-ja
// s'ka tekst ekstrakti (p.sh. është e skanuar) — atëherë përdoret OCR-ja.
export async function pdfTextPages(pdf: Buffer): Promise<string[] | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(doc, { mergePages: false });
    const pages = (text as string[]).map(t => t ?? "");
    const all = pages.join("\n");
    const hasTx = /^\s*\d{2}-[A-Z]{3}-\d{2}\s+\S.*\s[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s*$/m.test(all);
    return /OPENING BALANCE|STATEMENT OF ACCOUNT/.test(all) && hasTx ? pages : null;
  } catch {
    return null;
  }
}

/** Numri i faqeve të një PDF-je (pa e dekoduar). */
export function countPdfPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
}
