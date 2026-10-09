// Raporti i rakordimit të arkës së Shkollimit — PARA dhe PAS logjikës së arkës fizike. VETËM LEXIM.
// Përdorimi (vetëm mbi një KOPJE të databazës):
//   DATABASE_URL="file:./prod-copy.db" npx tsx scripts/arka-raport.ts <dalja.html> [viti=2026]
// Skenari "pas lidhjes së dorëzimit #270 me 2027–28" provohet mbi një kopje të përkohshme
// të asaj kopjeje — databaza e dhënë s'ndryshohet kurrë.
import fs from "fs";
import os from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { computeShkollimiOverview } from "../src/lib/shkollimiOverview";
import { computePhysicalCash, loadShkollimiMovements, reconcileYearView, type ReconRow } from "../src/lib/cashLedger";

const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const sgn = (c: number) => `${c < 0 ? "−" : "+"} ${eur(Math.abs(c))}`;
const dmy = (d: string) => d.split("-").reverse().join(".");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const SRC: Record<string, string> = { PAGESE: "Pagesë", HYRA: "Hyrë tjetër", SHPENZIM: "Shpenzim", SHPENZIM_PAGESE: "Pagesë fature", SHPENZIM_VJETER: "Shpenzim (i vjetër)", DOREZIM: "Dorëzim", INVESTIM: "Investim", TRANSFER: "Transfer" };

async function main() {
  const out = process.argv[2];
  const ay = parseInt(process.argv[3] ?? "2026");
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!out || !dbUrl.startsWith("file:")) throw new Error("Përdorimi: DATABASE_URL=file:./kopja.db npx tsx scripts/arka-raport.ts dalja.html [viti]");
  if (/akademia-ora\.db$/.test(dbUrl)) throw new Error("Vetëm mbi një kopje — jo mbi databazën e punës.");
  const dbFile = path.resolve("prisma", dbUrl.slice(5).replace(/^\.\//, ""));

  const ac = (await computeShkollimiOverview(1, ay, "academic"))!;
  const cal = (await computeShkollimiOverview(1, ay, "calendar"))!;
  const p = ac.physicalCash!, r = p.reconciliation!;
  const db = new PrismaClient();
  const storedCounts = await db.cashCount.findMany({ orderBy: { createdAt: "asc" } });
  const handovers = await db.expense.findMany({ where: { type: "HANDOVER", categoryId: (await db.paymentCategory.findFirstOrThrow({ where: { name: "Shkollimi" } })).id } });
  const kop = await db.expense.findUnique({ where: { id: 270 } });
  const kopPays = await db.payment.findMany({ where: { id: { in: [1675, 1676, 1677, 1678] } }, include: { student: { select: { firstName: true, lastName: true } } } });
  const movsNow = await loadShkollimiMovements(db);
  await db.$disconnect();

  // Skenari: dorëzimi #270 "për vitin" 9/2027 (si pagesat e Koprani-t) — mbi kopje të përkohshme
  const tmp = path.join(os.tmpdir(), `arka-raport-${Date.now()}.db`);
  fs.copyFileSync(dbFile, tmp);
  const t = new PrismaClient({ datasources: { db: { url: `file:${tmp.replace(/\\/g, "/")}` } } });
  await t.expense.update({ where: { id: 270 }, data: { month: 9, year: 2027 } });
  const linkedMovs = await loadShkollimiMovements(t);
  const linkedPhys = (await computePhysicalCash(t, 1, ay))!;
  await t.$disconnect();
  fs.unlinkSync(tmp);
  const r26 = reconcileYearView(linkedMovs, ay), r27 = reconcileYearView(linkedMovs, ay + 1), r27now = reconcileYearView(movsNow, ay + 1);

  const recRows = (rows: ReconRow[]) => rows.map(x => `<tr><td>${dmy(x.day)}</td><td>${SRC[x.source]} #${x.id}</td><td>${esc(x.label)}</td><td>${esc(x.reason)}</td><td class="r">${sgn(x.cents)}</td></tr>`).join("");
  const byRecipient = new Map<string, { n: number; c: number }>();
  for (const h of handovers) { const k = (h.recipient ?? "").split(/[ (]/)[0].trim().toLowerCase() || "—"; const v = byRecipient.get(k) ?? { n: 0, c: 0 }; v.n++; v.c += Math.round(h.amount * 100); byRecipient.set(k, v); }

  const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>Rakordimi i arkës</title>
<style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111;max-width:1000px;margin:auto}
h1{font-size:18px}h2{font-size:14px;margin-top:22px;border-bottom:2px solid #0F766E;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #bbb;padding:4px 6px;vertical-align:top}th{background:#eee;text-align:left}
.r{text-align:right;white-space:nowrap}.tot td{font-weight:bold;background:#f2f2f2}.ok{color:#166534;font-weight:bold}.bad{color:#b91c1c;font-weight:bold}small{color:#666}</style></head><body>
<h1>Rakordimi i arkës së Shkollimit — para dhe pas logjikës së arkës fizike</h1>
<p>Databaza: <b>${esc(path.basename(dbFile))}</b> (kopje; ndryshuar së fundi ${fs.statSync(dbFile).mtime.toLocaleString("sq")}) · llogaritur më ${dmy(p.asOf)} · vetëm lexim.</p>

<h2>1. Shifrat kryesore</h2>
<table><tr><th></th><th class="r">PARA (logjika e vjetër)</th><th class="r">PAS</th></tr>
<tr><td>"Në arkë" e Dashboard-it ${ay}–${ay + 1}</td><td class="r">${eur(Math.round(ac.cashFlow.inCashBox * 100))}<br><small>sipas vitit shkollor të çdo rreshti</small></td><td class="r">${eur(Math.round(ac.cashFlow.inCashBox * 100))}<br><small>mbetet, me emrin "Mbetja sipas vitit"</small></td></tr>
<tr><td><b>Arka fizike sot</b></td><td class="r">— s'ekzistonte</td><td class="r"><b>${eur(p.expectedCents)}</b><br><small>gjendja më ${dmy(p.opening.day)} ${eur(p.opening.cents)}${p.opening.assumed ? " (e supozuar)" : ""} + hyrje ${eur(p.inCents)} − dalje ${eur(p.outCents)}</small></td></tr>
<tr><td>Kontrolli "Bilanci përputhet"</td><td class="r">gjithmonë ✓ (krahasonte llogarinë me vetveten)</td><td class="r">zëvendësuar me rakordimin më poshtë: <span class="${r.identityHolds ? "ok" : "bad"}">${r.identityHolds ? "përputhet ✓" : "NUK përputhet"}</span></td></tr>
<tr><td>Pamja kalendarike ${ay} (1.1–31.12): "Në arkë"</td><td class="r">${eur(Math.round(cal.cashFlow.inCashBox * 100))}</td><td class="r">${eur(Math.round(cal.cashFlow.inCashBox * 100))} <small>(raport i vitit kalendarik — e pandryshuar)</small></td></tr>
</table>

<h2>2. Diferenca e shpjeguar transaksion pas transaksioni</h2>
<p>Mbetja sipas vitit <b>${eur(r.yearViewCents)}</b> ${r.outsideWindow.totalCents >= 0 ? "−" : "+"} <b>${eur(Math.abs(r.outsideWindow.totalCents))}</b> (A) ${r.otherYear.totalCents >= 0 ? "+" : "−"} <b>${eur(Math.abs(r.otherYear.totalCents))}</b> (B) = <b>${eur(r.physicalWindowCents)}</b> lëvizja e arkës fizike 01.09.${ay}–31.08.${ay + 1} <span class="${r.identityHolds ? "ok" : "bad"}">${r.identityHolds ? "✓" : "✘"}</span></p>
<p><b>A. I caktohen vitit ${ay}–${ay + 1}, por paratë lëvizën jashtë tij</b> (hiqen nga arka e vitit)</p>
<table><tr><th>Data reale</th><th>Rreshti</th><th>Përshkrimi</th><th>Pse</th><th class="r">Arka</th></tr>${recRows(r.outsideWindow.rows)}<tr class="tot"><td colspan="4">Gjithsej A</td><td class="r">${sgn(r.outsideWindow.totalCents)}</td></tr></table>
<p><b>B. Paratë lëvizën brenda vitit, por i caktohen vitit tjetër ose s'hyjnë në Pasqyrë</b> (shtohen te arka)</p>
<table><tr><th>Data reale</th><th>Rreshti</th><th>Përshkrimi</th><th>Pse</th><th class="r">Arka</th></tr>${recRows(r.otherYear.rows)}<tr class="tot"><td colspan="4">Gjithsej B</td><td class="r">${sgn(r.otherYear.totalCents)}</td></tr></table>

<h2>3. Numërimet e arkës — para dhe pas</h2>
<table><tr><th>Numërimi</th><th class="r">Numëruar</th><th class="r">PARA: sistemi / diferenca</th><th class="r">PAS: arka fizike në atë çast / diferenca</th><th class="r">Regjistruar më vonë (me datë deri atë ditë)</th><th class="r">Diferenca me to</th></tr>
${storedCounts.map(c => { const n = p.counts.find(x => x.id === c.id); return `<tr><td>#${c.id} · ${c.createdAt.toLocaleString("sq", { timeZone: "Europe/Belgrade" })} · ${esc(c.userName)}</td><td class="r">${eur(Math.round(c.countedAmount * 100))}</td><td class="r">${eur(Math.round(c.systemAmount * 100))}<br>${sgn(Math.round(c.difference * 100))}</td>${n ? `<td class="r">${eur(n.expectedCents)}<br><b>${sgn(n.differenceCents)}</b></td><td class="r">${sgn(n.lateCents)}</td><td class="r"><b>${sgn(n.differenceNowCents)}</b></td>` : `<td colspan="3"><small>jashtë vitit aktual</small></td>`}</tr>`; }).join("")}
</table>
<p><small>Diferenca negative = mungojnë para. Arka fizike llogaritet nga ${dmy(p.opening.day)} me gjendje ${eur(p.opening.cents)}${p.opening.assumed ? " (e supozuar, s'ka numërim të asaj dite — nëse në arkë kishte para më 31 gusht, mungesa është aq më e madhe)" : ""}. Numërimet s'zinxhirohen: secili krahasohet me shumën kumulative, që mungesa të mos "zhduket" te numërimi i radhës.</small></p>

<h2>4. Koprani (6.600 €) — pa asnjë hyrje të re</h2>
<table><tr><th>Rreshti</th><th>Data reale</th><th>Regjistruar</th><th>Viti shkollor</th><th class="r">Arka</th></tr>
${kopPays.map(x => `<tr><td>Pagesë #${x.id} ${esc(`${x.student.firstName} ${x.student.lastName}`)} · ${esc(x.receiptNumber)}</td><td>${x.paidDate?.toLocaleDateString("sq", { timeZone: "Europe/Belgrade" })}</td><td>${x.createdAt.toLocaleDateString("sq", { timeZone: "Europe/Belgrade" })}</td><td>${x.month}/${x.year} → ${x.year}–${x.year! + 1}</td><td class="r">${sgn(Math.round(x.paidAmount * 100))}</td></tr>`).join("")}
${kop ? `<tr><td>Dorëzim #270 · ${esc(kop.recipient)}</td><td>${kop.date.toLocaleDateString("sq", { timeZone: "Europe/Belgrade" })}</td><td>${kop.createdAt.toLocaleDateString("sq", { timeZone: "Europe/Belgrade" })}</td><td>${kop.month}/${kop.year} → ${kop.year}–${kop.year! + 1}</td><td class="r">${sgn(-Math.round(kop.amount * 100))}</td></tr>` : ""}
</table>
<table><tr><th></th><th class="r">Sot (dorëzimi te ${ay}–${ay + 1})</th><th class="r">Nëse dorëzimi lidhet me ${ay + 1}–${ay + 2} (provë mbi kopje të përkohshme)</th></tr>
<tr><td>Mbetja sipas vitit ${ay}–${ay + 1}</td><td class="r">${eur(r.yearViewCents)}</td><td class="r">${eur(r26.yearViewCents)}</td></tr>
<tr><td>Mbetja sipas vitit ${ay + 1}–${ay + 2}</td><td class="r">${eur(r27now.yearViewCents)}</td><td class="r">${eur(r27.yearViewCents)}</td></tr>
<tr><td><b>Arka fizike sot</b></td><td class="r"><b>${eur(p.expectedCents)}</b></td><td class="r"><b>${eur(linkedPhys.expectedCents)}</b> <small>(e njëjtë — data s'ndryshon)</small></td></tr></table>
<p><small>Arka fizike e numëron hyrjen dhe daljen në datën reale (29–30.09), pra neto 0, cilado qoftë viti shkollor. Lidhja e dorëzimit me 2027–28 ndikon vetëm Pasqyrat e viteve. Bëhet nga aplikacioni, me arsye, vetëm pas miratimit.</small></p>

<h2>5. Dorëzimet: te persona apo depozita në bankë?</h2>
<table><tr><th>Marrësi (fjala e parë)</th><th class="r">Rreshta</th><th class="r">Shuma</th></tr>
${[...byRecipient].sort((a, b) => b[1].c - a[1].c).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${v.n}</td><td class="r">${eur(v.c)}</td></tr>`).join("")}</table>
<p><small>Asnjë dorëzim s'ka bankë si marrës ose referencë bankare: të gjitha janë para cash që dolën nga arka te një person — s'hyjnë në bankë. Depozitat e vërteta në bankë do të regjistrohen veç (transfer arkë → bankë), që arka të zbresë dhe banka të rritet.</small></p>
</body></html>`;
  fs.writeFileSync(out, html, "utf8");

  console.log(`Mbetja sipas vitit ${eur(r.yearViewCents)} | A ${sgn(r.outsideWindow.totalCents)} (${r.outsideWindow.rows.length}) | B ${sgn(r.otherYear.totalCents)} (${r.otherYear.rows.length}) | arka në vit ${eur(r.physicalWindowCents)} ${r.identityHolds ? "✓" : "✘"}`);
  console.log(`Arka fizike sot ${eur(p.expectedCents)} (hyrje ${eur(p.inCents)}, dalje ${eur(p.outCents)}, të ardhshme ${p.futureCount}) | kalendarike ${eur(Math.round(cal.cashFlow.inCashBox * 100))}`);
  for (const c of p.counts) console.log(`Numërimi ${c.id} ${c.day}: ${eur(c.countedCents)} vs ${eur(c.expectedCents)} → ${sgn(c.differenceCents)} | vonuara ${sgn(c.lateCents)} → ${sgn(c.differenceNowCents)}`);
  console.log(`#270 i lidhur: ${ay} ${eur(r26.yearViewCents)} · ${ay + 1} ${eur(r27now.yearViewCents)} → ${eur(r27.yearViewCents)} · fizike ${eur(linkedPhys.expectedCents)}`);
  for (const x of [...r.outsideWindow.rows, ...r.otherYear.rows]) console.log(`  ${x.day} ${x.source} #${x.id} ${x.label} | ${x.reason} | ${sgn(x.cents)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
