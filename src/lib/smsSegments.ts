// Numërimi i saktë i segmenteve SMS (GSM 03.38 vs Unicode/UCS-2).
//   GSM-7:   160 karaktere për 1 SMS, 153 për segment kur ndahet
//   Unicode:  70 karaktere për 1 SMS,  67 për segment kur ndahet
// Mjafton NJË karakter jashtë alfabetit GSM-7 (p.sh. "ë", "ç") që i gjithë
// mesazhi të kalojë në Unicode — prandaj "Dërgo pa ë/ç" kursen realisht.

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// Karakteret e tabelës së zgjeruar zënë 2 pozicione (ESC + karakteri)
const GSM7_EXTENDED = "^{}\\[~]|€\f";

const BASIC_SET = new Set(GSM7_BASIC);
const EXT_SET = new Set(GSM7_EXTENDED);

export interface SegmentInfo {
  encoding: "GSM-7" | "Unicode";
  /** Gjatësia e efektshme (GSM: zgjeruarat numërohen ×2; Unicode: njësi UTF-16) */
  length: number;
  segments: number;
}

export function countSegments(text: string): SegmentInfo {
  if (!text) return { encoding: "GSM-7", length: 0, segments: 0 };
  let gsmLen = 0;
  let isGsm = true;
  for (const ch of text) {
    if (BASIC_SET.has(ch)) gsmLen += 1;
    else if (EXT_SET.has(ch)) gsmLen += 2;
    else { isGsm = false; break; }
  }
  if (isGsm) {
    return { encoding: "GSM-7", length: gsmLen, segments: gsmLen <= 160 ? 1 : Math.ceil(gsmLen / 153) };
  }
  const len = text.length; // njësi UTF-16, siç numërohen në UCS-2
  return { encoding: "Unicode", length: len, segments: len <= 70 ? 1 : Math.ceil(len / 67) };
}

/** "Dërgo pa ë/ç" — ë→e, Ë→E, ç→c, Ç→C. */
export function stripAlbanianDiacritics(text: string): string {
  return text.replace(/ë/g, "e").replace(/Ë/g, "E").replace(/ç/g, "c").replace(/Ç/g, "C");
}
