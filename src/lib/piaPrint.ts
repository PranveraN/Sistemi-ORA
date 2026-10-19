// Printimi i PIA-s — HTML i pavarur (dritare e re), sipas dokumentit
// "PIA — version i thjeshtuar" (3 faqe A4), me vlerat e plotësuara.
import {
  PAVARESIA, NIVELI, ASISTENTJA, ORGANIZIMI, DOKUMENTET, MBESHTETJA, INSTRUMENTET, PERSHTATJET, VENDIMI, PERIUDHAT,
  type PiaData, type PiaReviewData,
} from "@/lib/pia";

export interface PiaStudent {
  id: number; firstName: string; lastName: string; birthDate: string | null; className: string | null;
  parentName: string | null; parentPhone: string | null; fatherName: string | null; fatherPhone: string | null;
  motherName: string | null; motherPhone: string | null; assistantName: string | null;
}

const esc = (s: string | null | undefined) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const nl = (s: string) => esc(s).replace(/\n/g, "<br>");
const d = (s: string | null | undefined) => {
  if (!s) return "";
  const x = new Date(s);
  return isNaN(x.getTime()) ? "" : `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${x.getFullYear()}`;
};
const box = (on: boolean, label: string) => `<span class="cb">${on ? "☒" : "☐"} ${esc(label)}</span>`;
const boxes = (opts: readonly string[], sel: string[]) => opts.map(o => box(sel.includes(o), o)).join(" ");
const one = (opts: readonly string[], v: string) => opts.map(o => box(v === o, o)).join(" ");
const pavKeys = PAVARESIA.map(p => p.key);
const nivKeys = NIVELI.map(n => n.key);

export function buildPiaPrintHtml(st: PiaStudent, year: number, p: PiaData, review: { date: string; data: PiaReviewData } | null): string {
  const parent = st.parentName || st.fatherName || st.motherName || "";
  const phone = st.parentPhone || st.fatherPhone || st.motherPhone || "";
  const r = review?.data;
  const header = `<div class="top">AKADEMIA ORA</div>`;
  const footer = (n: number) => `<div class="foot">Dokument konfidencial • Përdorim profesional i brendshëm | Faqe ${n} / 3</div>`;

  const page1 = `
  <section class="page">
    <div class="brand">AKADEMIA ORA</div>
    <h1>PLANI INDIVIDUAL I ARSIMIT (PIA)</h1>
    <div class="sub">Viti shkollor ${year}/${year + 1} • Version i thjeshtuar</div>
    <div class="codes">Kodet: Pavarësia: P = i pavarur, MP = me mbështetje të pjesshme, MA = me mbështetje të plotë (asistente)<br>
    Niveli: R = i realizuar, NP = në progres, PR = pjesërisht i realizuar, NR = nuk është realizuar ende</div>
    <h2><span>01</span> TË DHËNAT E NXËNËSIT</h2>
    <table class="kv">
      <tr><th>Nxënësi/ja</th><td>${esc(st.firstName)} ${esc(st.lastName)}</td><th>Data e lindjes</th><td>${d(st.birthDate)}</td></tr>
      <tr><th>Klasa / paralelja</th><td>${esc(st.className)}</td><th>Prindi / kontakti</th><td>${esc(parent)}${phone ? ` · ${esc(phone)}` : ""}</td></tr>
      <tr><th>Lënda/lëndët</th><td>${esc(p.lendet)}</td><th>Mësimdhënësi/ja</th><td>${esc(p.mesimdhenesi)}</td></tr>
      <tr><th>Asistentja</th><td>${one(ASISTENTJA, p.asistentja)} Orë/javë: ${esc(p.oreJave) || "____"}${st.assistantName ? `<br>${esc(st.assistantName)}` : ""}</td><th>Organizimi</th><td>${one(ORGANIZIMI, p.organizimi)}</td></tr>
      <tr><th>Periudha</th><td>Nga: ${d(p.nga) || "__________"} Deri: ${d(p.deri) || "__________"}</td><th>Data e rishikimit</th><td>${d(p.dataRishikimit)}</td></tr>
      <tr><th>Dokumente në dosje</th><td colspan="3">${boxes(DOKUMENTET, p.dokumentet)} ${box(!!p.dokumentTjeter, "Tjetër:")} ${esc(p.dokumentTjeter)}</td></tr>
    </table>
    <h2><span>02</span> GJENDJA AKTUALE DHE FUSHAT E PUNËS</h2>
    <table class="grid"><thead><tr><th style="width:22%">Fusha</th><th>Çfarë bën tani</th><th>Vështirësitë / nevojat</th></tr></thead><tbody>
      ${p.fushat.map(f => `<tr class="tall"><td>${nl(f.fusha)}</td><td>${nl(f.cfareBen)}</td><td>${nl(f.veshtiresite)}</td></tr>`).join("")}
      <tr><th>Si mëson më mirë / çfarë e motivon</th><td colspan="2">${nl(p.motivimi)}</td></tr>
    </tbody></table>
    ${footer(1)}
  </section>`;

  const page2 = `
  <section class="page">
    ${header}
    <h2><span>03</span> REZULTATET DHE PLANIFIKIMI I PUNËS</h2>
    <div class="hint">Formula: “Deri në [afati], nxënësi/ja do të [aftësia e vëzhgueshme] me [kriteri i suksesit].”</div>
    <table class="grid"><thead><tr><th style="width:7%">Kodi</th><th>Rezultati i synuar (me kriter dhe afat)</th><th style="width:18%">Pavarësia</th><th style="width:22%">Mbështetja (lloji, niveli)</th></tr></thead><tbody>
      ${p.rezultatet.map((x, i) => `<tr class="tall"><td><b>R${i + 1}</b></td><td>${nl(x.rezultati)}</td><td>${pavKeys.map(k => box(x.pavaresia === k, k)).join("<br>")}</td><td>${boxes(MBESHTETJA, x.mbeshtetja)}</td></tr>`).join("")}
    </tbody></table>
    <h2><span>04</span> INSTRUMENTET DHE PËRSHTATJET E VLERËSIMIT</h2>
    <table class="kv">
      <tr><th>Instrumentet</th><td>${boxes(INSTRUMENTET, p.instrumentet)}</td></tr>
      <tr><th>Përshtatjet</th><td>${boxes(PERSHTATJET, p.pershtatjet)}</td></tr>
      <tr><th>Zvogëlimi i mbështetjes</th><td>${nl(p.zvogelimi) || "<i>Si do ta zvogëlojmë gradualisht ndihmën e asistentes:</i>"}</td></tr>
    </table>
    ${footer(2)}
  </section>`;

  const page3 = `
  <section class="page">
    ${header}
    <h2><span>05</span> VLERËSIMI I REZULTATEVE</h2>
    <div class="per">Periudha: ${PERIUDHAT.map(x => box(r?.periudha === x, x)).join(" ")}${r?.periudha && !PERIUDHAT.includes(r.periudha) ? ` ${esc(r.periudha)}` : ""} &nbsp; Data: ${review ? d(review.date) : "__________"}</div>
    <table class="grid"><thead><tr><th style="width:7%">Kodi</th><th>Çfarë arriti (evidenca)</th><th style="width:13%">Niveli</th><th style="width:10%">Pavarësia</th><th style="width:26%">Ku ka ende nevojë / çfarë ndryshojmë</th></tr></thead><tbody>
      ${[0, 1, 2, 3].map(i => {
        const x = r?.rezultatet[i];
        return `<tr class="mid"><td><b>R${i + 1}</b></td><td>${nl(x?.evidenca ?? "")}</td><td>${nivKeys.map(k => box(x?.niveli === k, k)).join(" ")}</td><td>${pavKeys.map(k => box(x?.pavaresia === k, k)).join("<br>")}</td><td>${nl(x?.nevojat ?? "")}</td></tr>`;
      }).join("")}
    </tbody></table>
    <h2><span>06</span> PROGRESI DHE REKOMANDIMET</h2>
    <table class="kv">
      <tr class="mid"><th>Progresi kryesor</th><td>${nl(r?.progresi ?? "")}</td></tr>
      <tr class="mid"><th>Rekomandimet për periudhën e ardhshme</th><td>${nl(r?.rekomandimet ?? "")}</td></tr>
      <tr><th>Vendimi i ekipit</th><td>${boxes(VENDIMI, r?.vendimi ?? [])}</td></tr>
    </table>
    <h3>NËNSHKRIMET</h3>
    <table class="grid sign"><thead><tr><th>Mësimdhënësi/ja</th><th>Asistentja</th><th>Prindi / kujdestari</th><th>Drejtori/ja</th></tr></thead>
      <tbody><tr><td>Data: __________</td><td>Data: __________</td><td>Data: __________</td><td>Data: __________</td></tr></tbody></table>
    ${footer(3)}
  </section>`;

  return `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>PIA — ${esc(st.firstName)} ${esc(st.lastName)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 10.5px; margin: 0; }
  .page { page-break-after: always; position: relative; min-height: 265mm; }
  .page:last-child { page-break-after: auto; }
  .brand { text-align: center; color: #0f766e; font-weight: bold; letter-spacing: 1px; font-size: 10px; }
  h1 { text-align: center; color: #1e3a5f; margin: 2px 0; font-size: 18px; }
  .sub { text-align: center; color: #64748b; font-size: 9.5px; margin-bottom: 8px; }
  .codes { border: 1px solid #94a3b8; padding: 4px 6px; font-size: 9px; margin-bottom: 8px; }
  .top { text-align: right; color: #64748b; font-weight: bold; font-size: 9px; }
  h2 { font-size: 12.5px; color: #1e3a5f; margin: 12px 0 4px; } h2 span { color: #d97706; margin-right: 6px; }
  h3 { font-size: 11.5px; color: #1e3a5f; margin: 12px 0 4px; }
  .hint, .per { font-size: 9px; color: #475569; margin-bottom: 4px; } .hint { font-style: italic; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #94a3b8; padding: 4px 5px; vertical-align: top; text-align: left; }
  table.kv th { background: #e8eef5; width: 18%; font-weight: bold; }
  table.grid thead th { background: #1e3a5f; color: #fff; }
  table.grid tbody th { background: #e8eef5; }
  tr.tall td { height: 70px; } tr.mid td, tr.mid th { height: 48px; }
  .sign td { height: 50px; vertical-align: bottom; color: #64748b; font-size: 9px; }
  .cb { white-space: nowrap; margin-right: 6px; }
  .foot { position: absolute; bottom: 0; width: 100%; text-align: center; color: #64748b; font-size: 8.5px; }
</style></head><body>${page1}${page2}${page3}</body></html>`;
}
