// Lexon tekstin e OCR-së së ekstraktit BKT ("Llogaria e-Deklarata", STATEMENT OF ACCOUNT)
// dhe nxjerr rreshtat. Çdo rresht kontrollohet me gjendjen: gjendja e mëparshme ∓ shuma =
// gjendja e rreshtit — kështu del edhe nëse është debi apo kredi, dhe çdo gabim leximi
// zbulohet. Në fund krahasohet me totalet e bankës (nr. dhe shuma e debive/kredive).
// Shumat në cent.

export interface BktRow {
  nr: number; faqja: number;
  data: string;            // YYYY-MM-DD
  dataValuta: string | null;
  lloji: string;           // TRANSFER, COMMISSION, CASH DEPOSIT...
  referenca: string;
  shuma: number;           // cent
  gjendja: number;         // cent
  drejtimi: "HYRJE" | "DALJE" | null;   // null = s'përputhet me gjendjen
  rreshtat: string[];      // rreshtat e përshkrimit (të pastruar)
  pala: string;
  pershkrimi: string;
}

export interface BktResult {
  llogaria: string | null;
  periudhaNga: string | null; periudhaDeri: string | null;
  gjendjaFillestare: number | null; gjendjaPerfundimtare: number | null;
  bankaDebi: { nr: number; shuma: number } | null;
  bankaKredi: { nr: number; shuma: number } | null;
  rows: BktRow[];
  perseritur: number;       // rreshta të përsëritur mes pjesëve (u mbajtën një herë)
  pjeset: BktPjese[];       // çdo PDF me periudhën dhe gjendjet e veta (sipas radhës së datave)
  mungojne: BktMungese[];   // periudhat që mungojnë mes pjesëve
  gabimet: string[];        // bosh = gjithçka përputhet
}
export interface BktPjese { emri: string; nga: string | null; deri: string | null; fillestare: number | null; perfundimtare: number | null }
export interface BktMungese { nga: string; deri: string; diferenca: number; mes: [string, string] }

/**
 * Referenca e bankës në formë të krahasueshme: OCR-ja i ngatërron shkronjat me shifrat (O↔0, I/L↔1,
 * S↔5, B↔8, Z↔2), p.sh. "771ACEN24166M39O" (tekst) vs "771ACEN24166M390" (skanim). Përdoret vetëm
 * për gjetjen e rreshtave të njëjtë — referenca origjinale ruhet e pandryshuar.
 */
export const refKey = (ref: string) => ref.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2").replace(/s+/g, "");

const shiftDay = (iso: string, d: number) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };

const MON: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const cents = (s: string) => Math.round(parseFloat(s.replace(/,/g, "")) * 100);
const DATE = String.raw`(\d{2}-[A-Z]{3}-\d{2})`;
function isoDate(d: string): string | null {
  const m = /^(\d{2})-([A-Z]{3})-(\d{2})$/.exec(d);
  if (!m || !MON[m[2]]) return null;
  return `20${m[3]}-${String(MON[m[2]]).padStart(2, "0")}-${m[1]}`;
}
// Gabimet tipike të OCR-së te datat: "0CT" → "OCT", "O5" → "05"
const fixDates = (l: string) => l.replace(/\b([0-9O]{2})-(0CT|OCT|N0V|D3C)-([0-9O]{2})\b/g,
  (_, a: string, b: string, c: string) => `${a.replace(/O/g, "0")}-${b.replace("0", "O").replace("3", "E")}-${c.replace(/O/g, "0")}`);

const TX_RE = new RegExp(String.raw`^\s*${DATE}\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$`);
// Rreshtat e kokës/fundit të faqes dhe logos që s'janë pjesë e përshkrimit
const PAGE_NOISE = /DEBIT\(S\)|CREDIT\(S\)|Informacione t|Banka Kombetare Tregtare Kosove|Depozitat? e sigur|Depozituesit|FSDK|drejtohuni|Per informacione|UNAUTH|VEPRIM I|BANKA KOMBETARE TREGTARE|^\s*[RK][o0]sova\s*$|NY IK|^\s*\(?Rt\s|STATEMENT NO|^\s*-{20,}|BOOKING DATE|Shenim:|BKT-se|Data Krijimit|e-Deklarata|AccountNo:|Pershkrimi|DESCRIPTION/;
// Rreshta teknikë të transferit që s'ndihmojnë klasifikimin
const TECH = /Event Desc|User Refno|Charges Desc|Charge Amt|Tr\. Amt::|Corres\.|Com: :|^\s*\d{10,}\s*$/;

const clean = (s: string) => s.replace(/\s*;\s*/g, "").replace(/\s+/g, " ").trim();

function palaDhePershkrimi(lloji: string, drejtimi: BktRow["drejtimi"], lines: string[]): { pala: string; pershkrimi: string } {
  const L = lines.filter(l => !TECH.test(l) && l.replace(/[^A-Za-z]/g, "").length >= 4);
  const get = (re: RegExp) => { for (const l of L) { const m = l.match(re); if (m) return clean(m[1]); } return ""; };
  const order = get(/By Order Of:{0,2}\s*(.+)$/).replace(/-?\/[A-Z]{0,2}\d{6,}.*$/, "").replace(/^\/[A-Z]{0,2}\d+$/, "").replace(/\s+\d{10,}$/, "").trim();
  // Përfituesi: "Ft - Ben -EMRI" / "Ft - Ben /XK…-EMRI" ose (transfertat ACH) "Beneficiary::XK… Emri"
  const ben = (get(/Ft - Ben\s+(.+)$/) || get(/Beneficiary::\s*(.+)$/)).replace(/^[-/]*(XK\d+|\d+)?[-\s]?/, "").trim();
  const pershkrimi = clean(L.map(l => l.replace(/^Ft - /, "").replace(/^Payment D\d\s*/, "").replace(/^Details:\s*:?/, "")).join(" · "));
  let pala = "";
  if (/COMMISSION|KOMISION/.test(lloji)) pala = "BKT";
  else if (/CASH DEPOSIT|CASH WITHDRAWAL|ACCOUNT TO ACCOUNT/.test(lloji)) {
    const first = L.find(l => !/^(TRANSFER|CASH)/.test(l.trim())) ?? "";
    pala = clean(first.replace(/,?\s*(DEPONIM|TERHEQJE|KALIM|TRANSFER).*$/i, "").replace(/\s*(NR\s*)?ID\s*\d+.*$/i, ""));
  } else pala = drejtimi === "HYRJE" ? order : ben || order;
  return { pala: pala.slice(0, 120), pershkrimi: pershkrimi.slice(0, 1000) };
}

/** `partStarts` = indekset e faqeve ku fillon një PDF tjetër (rreshtat e një pjese s'i ngjiten asaj para). */
export function parseBktPages(pages: string[], partStarts: number[] = [], partNames: string[] = []): BktResult {
  // Emri i skedarit (PDF) të cilit i përket një faqe — për mesazhet e gabimeve
  const partIdx = (pi: number) => { let k = 0; partStarts.forEach((st, i) => { if (pi >= st) k = i; }); return k; };
  const nameOf = (k: number) => partNames[k] || `Pjesa ${k + 1}`;
  const nParts = Math.max(1, partStarts.length);
  const pjeset: BktPjese[] = Array.from({ length: nParts }, (_, k) => ({ emri: nameOf(k), nga: null, deri: null, fillestare: null, perfundimtare: null }));
  const res: BktResult = { llogaria: null, periudhaNga: null, periudhaDeri: null, gjendjaFillestare: null, gjendjaPerfundimtare: null, bankaDebi: null, bankaKredi: null, rows: [], perseritur: 0, pjeset, mungojne: [], gabimet: [] };
  // `hapja` = gjendja fillestare e një pjese tjetër (PDF) që fillon me këtë rresht
  type Raw = Omit<BktRow, "drejtimi" | "pala" | "pershkrimi"> & { hapja?: number };
  let pendingOpening: number | undefined;
  const raw: Raw[] = [];
  let cur: Raw | null = null;

  let totLines = 0; // sa pjesë kishin totalet e veta (DEBIT(S))
  pages.forEach((text, pi) => {
    if (partStarts.includes(pi)) cur = null;
    for (let line of text.split(/\r?\n/)) {
      line = fixDates(line);
      if (!res.llogaria) { const a = line.match(/AccountNo:\s*(\d{10,})/); if (a) res.llogaria = a[1]; }
      const per = line.match(/FROM\s*\(NGA DATA\):\s*(\S+)\s+TO\s*\(NE DATEN\):\s*(\S+)/);
      if (per) {
        const nga = isoDate(per[1]), deri = isoDate(per[2]);
        const pj = pjeset[partIdx(pi)];
        if (pj && !pj.nga) { pj.nga = nga; pj.deri = deri; }
        if (nga && (!res.periudhaNga || nga < res.periudhaNga)) res.periudhaNga = nga;
        if (deri && (!res.periudhaDeri || deri > res.periudhaDeri)) res.periudhaDeri = deri;
        continue;
      }
      if (/OPENING BALANCE/.test(line)) { const v = line.match(/([\d,]+\.\d{2})\s*$/); if (v) { const pj = pjeset[partIdx(pi)]; if (pj && pj.fillestare === null) pj.fillestare = cents(v[1]); if (res.gjendjaFillestare === null) res.gjendjaFillestare = cents(v[1]); else pendingOpening = cents(v[1]); } cur = null; continue; }
      if (/CLOSING BALANCE/.test(line)) { const v = line.match(/([\d,]+\.\d{2})\s*$/); if (v) { res.gjendjaPerfundimtare = cents(v[1]); const pj = pjeset[partIdx(pi)]; if (pj) pj.perfundimtare = cents(v[1]); } cur = null; continue; }
      const tot = line.match(/^\s*(\d+)\s+(DEBIT|CREDIT)\(S\)\s+([\d,]+\.\d{2})/);
      if (tot) {
        // Kur ekstrakti vjen në disa pjesë (PDF), secila pjesë ka totalet e veta — mblidhen
        const add = (a: { nr: number; shuma: number } | null) => ({ nr: (a?.nr ?? 0) + +tot[1], shuma: (a?.shuma ?? 0) + cents(tot[3]) });
        if (tot[2] === "DEBIT") res.bankaDebi = add(res.bankaDebi); else res.bankaKredi = add(res.bankaKredi);
        if (tot[2] === "DEBIT") totLines++;
        continue;
      }
      const g = line.match(TX_RE);
      if (g && !/BALANCE/.test(line)) {
        const mid = g[2];
        const r = mid.match(/(\d{3}[A-Za-z0-9]{6,}(?: \d{5})?)/);
        const vd = mid.slice(r ? r.index! + r[1].length : 0).match(/(\d{2}-[A-Z]{3}-\d{2})/);
        const data = isoDate(g[1]);
        if (!data) { res.gabimet.push(`Faqja ${pi + 1}: data e palexueshme "${g[1]}"`); continue; }
        cur = { nr: raw.length + 1, faqja: pi + 1, data, dataValuta: vd ? isoDate(vd[1]) : null,
          lloji: (r ? mid.slice(0, r.index) : mid).trim(), referenca: r ? r[1] : "", shuma: cents(g[3]), gjendja: cents(g[4]), rreshtat: [], hapja: pendingOpening };
        pendingOpening = undefined;
        raw.push(cur);
        continue;
      }
      if (/^\s*\d{2}-[A-Z]{3}-\d{2}\s/.test(line) && !/BOOKING/.test(line)) { res.gabimet.push(`Faqja ${pi + 1}: rresht i palexuar: ${line.trim().slice(0, 90)}`); continue; }
      if (!cur || !line.trim() || PAGE_NOISE.test(line)) continue;
      cur.rreshtat.push(line.trim());
    }
  });

  // Pjesë që mbivendosen (p.sh. PDF-ja 1 deri 15.07, PDF-ja 2 nga 10.07): i njëjti rresht
  // (data, referenca, lloji, shuma, gjendja pas tij) mbahet vetëm një herë.
  const seen = new Map<string, Raw>();
  const dups: { shuma: number; twin: Raw }[] = [];
  const uniq: Raw[] = [];
  for (const r of raw) {
    const k = [r.data, refKey(r.referenca), r.lloji, r.shuma, r.gjendja].join("|");
    const twin = seen.get(k);
    if (twin) { dups.push({ shuma: r.shuma, twin }); continue; }
    seen.set(k, r);
    uniq.push({ ...r, nr: uniq.length + 1 });
  }
  res.perseritur = dups.length;

  // Zinxhiri i gjendjes: drejtimi i çdo rreshti + kontrolli
  let prev = res.gjendjaFillestare;
  if (prev === null) res.gabimet.push("Gjendja fillestare (OPENING BALANCE) s'u gjet.");
  const eurS = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
  const dmyS = (d: string) => d.split("-").reverse().join(".");
  let lastDate: string | null = null, lastPage = 0;
  for (const r of uniq) {
    // Fillon një pjesë tjetër: nëse gjendja e saj fillestare s'është aty ku mbaroi e mëparshmja, mungon një periudhë
    if (r.hapja !== undefined && prev !== null && r.hapja !== prev) {
      // Datat që mungojnë: nga dita pas mbarimit të pjesës së mëparshme deri një ditë para fillimit të kësaj
      const a = pjeset[partIdx(lastPage)], b = pjeset[partIdx(r.faqja - 1)];
      let nga = shiftDay(a.deri ?? lastDate ?? r.data, 1), deri = shiftDay(b.nga ?? r.data, -1);
      if (nga > deri) { nga = lastDate ?? r.data; deri = r.data; }
      res.mungojne.push({ nga, deri, diferenca: r.hapja - prev, mes: [a.emri, b.emri] });
      res.gabimet.push(`Mungojnë datat ${dmyS(nga)} – ${dmyS(deri)}: "${a.emri}" mbaron me ${eurS(prev)}, "${b.emri}" fillon me ${eurS(r.hapja)} `
        + `(diferenca ${eurS(r.hapja - prev)}). Ngarko ekstraktin e bankës për këto data.`);
      prev = r.hapja;
    }
    lastDate = r.data; lastPage = r.faqja - 1;
    let drejtimi: BktRow["drejtimi"] = null;
    if (prev !== null && prev - r.shuma === r.gjendja) drejtimi = "DALJE";
    else if (prev !== null && prev + r.shuma === r.gjendja) drejtimi = "HYRJE";
    else res.gabimet.push(`Rreshti ${r.nr} (faqja ${r.faqja}, ${r.data}, ${(r.shuma / 100).toFixed(2)} €): gjendja s'përputhet — kontrollo leximin.`);
    prev = r.gjendja;
    res.rows.push({ ...r, drejtimi, ...palaDhePershkrimi(r.lloji, drejtimi, r.rreshtat) });
  }

  // Kur secila pjesë ka totalet e veta, shuma e tyre përmban dy herë rreshtat e përsëritur — hiqen.
  // (Nëse totalet janë vetëm në pjesën e fundit, ato i numërojnë një herë — s'preken.)
  const twinKey = new Map(uniq.map((u, i) => [[u.data, refKey(u.referenca), u.lloji, u.shuma, u.gjendja].join("|"), i]));
  for (const d of totLines > 1 ? dups : []) {
    const i = twinKey.get([d.twin.data, refKey(d.twin.referenca), d.twin.lloji, d.twin.shuma, d.twin.gjendja].join("|"));
    const dir = i !== undefined ? res.rows[i].drejtimi : null;
    if (dir === "DALJE" && res.bankaDebi) res.bankaDebi = { nr: res.bankaDebi.nr - 1, shuma: res.bankaDebi.shuma - d.shuma };
    if (dir === "HYRJE" && res.bankaKredi) res.bankaKredi = { nr: res.bankaKredi.nr - 1, shuma: res.bankaKredi.shuma - d.shuma };
  }

  // Krahasimi me totalet e bankës
  const sum = (d: "HYRJE" | "DALJE") => res.rows.filter(r => r.drejtimi === d).reduce((s, r) => s + r.shuma, 0);
  const cnt = (d: "HYRJE" | "DALJE") => res.rows.filter(r => r.drejtimi === d).length;
  const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 });
  if (res.bankaDebi && (res.bankaDebi.nr !== cnt("DALJE") || res.bankaDebi.shuma !== sum("DALJE")))
    res.gabimet.push(`Debitë: banka ${res.bankaDebi.nr} rreshta / ${eur(res.bankaDebi.shuma)} €, lexuar ${cnt("DALJE")} / ${eur(sum("DALJE"))} €.`);
  if (res.bankaKredi && (res.bankaKredi.nr !== cnt("HYRJE") || res.bankaKredi.shuma !== sum("HYRJE")))
    res.gabimet.push(`Kreditë: banka ${res.bankaKredi.nr} rreshta / ${eur(res.bankaKredi.shuma)} €, lexuar ${cnt("HYRJE")} / ${eur(sum("HYRJE"))} €.`);
  if (res.gjendjaPerfundimtare !== null && prev !== res.gjendjaPerfundimtare)
    res.gabimet.push(`Gjendja përfundimtare: banka ${eur(res.gjendjaPerfundimtare)} €, lexuar ${eur(prev ?? 0)} €.`);
  if (!res.rows.length) res.gabimet.push("Asnjë rresht s'u lexua — a është ekstrakt i BKT-së?");
  // PDF e prerë (mungojnë faqet e fundit): s'ka CLOSING BALANCE / totale — s'mund të vërtetohet që s'mungon asgjë
  else if (res.gjendjaPerfundimtare === null || (!res.bankaDebi && !res.bankaKredi)) {
    const last = res.rows[res.rows.length - 1];
    const pj = res.pjeset[res.pjeset.length - 1];
    res.gabimet.push(`PDF-ja duket e paplotë: s'ka gjendjen përfundimtare (CLOSING BALANCE) dhe totalet e bankës në fund. `
      + `Rreshti i fundit i lexuar është ${dmyS(last.data)}${pj?.deri ? `, ndërsa ekstrakti thotë se mbulon deri më ${dmyS(pj.deri)}` : ""}. `
      + `Shkarko sërish ekstraktin e plotë nga e-banking-u.`);
  }
  return res;
}
