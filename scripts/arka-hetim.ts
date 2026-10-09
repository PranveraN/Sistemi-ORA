// Hetimi i diferencës së arkës së Shkollimit — rakordim i provueshëm. VETËM LEXIM, vetëm mbi KOPJE.
// Përdorimi:
//   DATABASE_URL="file:./prod-copy-0910.db" npx tsx scripts/arka-hetim.ts <dalja.html> [kopja-e-meparshme.db] [diferenca-e-raportuar€]
// Çdo gjetje del nga vetë të dhënat (rregullat më poshtë), jo nga lista me dorë:
//   • dorëzim me shënimin "dorëzuar më <data>" → data reale; nëse ekziston një dorëzim tjetër me
//     të njëjtën shumë e marrës në atë datë → i njëjti dorëzim i regjistruar dy herë;
//   • pagesë cash, numri i dëshmisë (DEP) i së cilës u dha PARA ditës së shënuar si data e pagesës
//     (numrat jepen me radhë kur pagesa regjistrohet si e paguar) → paratë u morën më herët;
//   • dy pagesa cash me të njëjtën shumë për të njëjtin nxënës, për vite shkollore të ndryshme
//     ose për të njëjtin muaj, brenda 60 ditëve → dyfishim i mundshëm (kërkon dëshminë).
// Gjendja e arkës më 31.08 është E PANJOHUR (O) — s'supozohet asnjë shumë.
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { computeShkollimiOverview } from "../src/lib/shkollimiOverview";
import { loadShkollimiMovements, physicalBalance, type LedgerMovement } from "../src/lib/cashLedger";
import { dayKey } from "../src/lib/audit/cashEffect";

const AY = 2026, FROM = `${AY}-09-01`, OPEN_DAY = `${AY}-08-31`;
const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const sgn = (c: number) => `${c < 0 ? "−" : "+"} ${eur(Math.abs(c))}`;
const dmy = (d: string) => d.split("-").reverse().join(".");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const at = (d: Date) => d.toLocaleString("sq", { timeZone: "Europe/Belgrade" });
const cents = (v: number) => Math.round(v * 100);
const MUAJT: Record<string, number> = { qershor: 6, korrik: 7, gusht: 8, shtator: 9, tetor: 10 };
const SRC: Record<string, string> = { PAGESE: "Pagesë", HYRA: "Hyrë tjetër", SHPENZIM: "Shpenzim", SHPENZIM_PAGESE: "Pagesë fature", SHPENZIM_VJETER: "Shpenzim (skeda e vjetër)", DOREZIM: "Dorëzim", INVESTIM: "Investim", TRANSFER: "Transfer" };

// effectCents = sa ndryshon diferenca (mungesa) nëse gjetja merret parasysh: + e rrit, − e ul.
interface Finding { group: "KODI" | "REGJISTRIMI" | "I_MUNDSHEM" | "KORRIGJUAR"; title: string; refs: string; evidence: string; effectCents: number; affectsTotal: boolean }

async function main() {
  const out = process.argv[2], oldCopy = process.argv[3], reported = process.argv[4] ? cents(parseFloat(process.argv[4].replace(",", "."))) : null;
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!out || !dbUrl.startsWith("file:") || /akademia-ora\.db$/.test(dbUrl)) throw new Error("Vetëm mbi një kopje: DATABASE_URL=file:./kopja.db npx tsx scripts/arka-hetim.ts dalja.html [kopja-e-meparshme.db] [diferenca]");
  const dbFile = path.resolve("prisma", dbUrl.slice(5).replace(/^\.\//, ""));
  const db = new PrismaClient();
  const shk = await db.paymentCategory.findFirstOrThrow({ where: { name: "Shkollimi" } });
  const movs = await loadShkollimiMovements(db);
  const byKey = new Map(movs.map(m => [m.key, m]));
  const open = { day: OPEN_DAY, cents: 0, recordedAt: Number.POSITIVE_INFINITY };
  const net = physicalBalance(movs, open, "9999-12-31");
  const findings: Finding[] = [];

  // ── Numërimet ──
  const counts = await db.cashCount.findMany({ where: { createdAt: { gte: new Date(`${OPEN_DAY}T00:00:00Z`) } }, orderBy: { createdAt: "asc" } });
  const countRows = counts.map((c, i) => {
    const t = c.createdAt.getTime(), day = dayKey(c.createdAt)!;
    const expected = physicalBalance(movs.filter(m => m.recordedAt <= t), open, day).closingCents;
    const prev = i > 0 ? counts[i - 1] : null;
    const recBetween = prev ? movs.filter(m => m.boxCents && m.recordedAt > prev.createdAt.getTime() && m.recordedAt <= t) : [];
    return { c, day, expected, gap: expected - cents(c.countedAmount), prev, recBetween, recChange: recBetween.reduce((s, m) => s + m.boxCents, 0), observed: prev ? cents(c.countedAmount) - cents(prev.countedAmount) : null };
  });
  const last = countRows[countRows.length - 1];

  // ── Korrigjimet mes dy kopjeve ──
  const corrections: { key: string; label: string; before: string; after: string; boxDelta: number }[] = [];
  if (oldCopy) {
    const o = new PrismaClient({ datasources: { db: { url: `file:${path.resolve("prisma", oldCopy).replace(/\\/g, "/")}` } } });
    const om = new Map((await loadShkollimiMovements(o)).map(m => [m.key, m]));
    await o.$disconnect();
    const desc = (m?: LedgerMovement) => m ? `${dmy(m.day)} · arkë ${eur(m.boxCents)} · bankë ${eur(m.bankCents)}` : "—";
    for (const k of new Set([...om.keys(), ...byKey.keys()])) {
      const a = om.get(k), b = byKey.get(k);
      const d = (b?.boxCents ?? 0) - (a?.boxCents ?? 0);
      const inWin = (m?: LedgerMovement) => !!m && m.day >= FROM;
      if (d !== 0 && (inWin(a) || inWin(b))) corrections.push({ key: k, label: (b ?? a)!.label, before: desc(a), after: desc(b), boxDelta: d });
    }
    for (const x of corrections) findings.push({ group: "KORRIGJUAR", title: "Ndryshuar në sistem pas kopjes së mëparshme", refs: `${x.key} ${x.label}`, evidence: `${x.before} → ${x.after}`, effectCents: x.boxDelta, affectsTotal: true });
  }

  // ── Dorëzimet: data reale nga shënimi + dyfishimet ──
  const hos = await db.expense.findMany({ where: { categoryId: shk.id, type: "HANDOVER" } });
  const first = (s: string | null) => (s ?? "").trim().split(/[\s(,]/)[0].toLowerCase().replace(/it$|i$/, "");
  for (const h of hos) {
    const mm = /dor[ëe]zuar\s+m[eë]\s+(\d{1,2})\s+([a-zë]+)/i.exec(h.recipient ?? h.description ?? "");
    if (!mm || !MUAJT[mm[2].toLowerCase()]) continue;
    const real = `${h.date.getUTCFullYear()}-${String(MUAJT[mm[2].toLowerCase()]).padStart(2, "0")}-${mm[1].padStart(2, "0")}`;
    const sys = dayKey(h.date)!;
    if (real === sys) continue;
    const twin = hos.find(x => x.id !== h.id && x.amount === h.amount && first(x.recipient) === first(h.recipient) && Math.abs(Date.parse(dayKey(x.date)!) - Date.parse(real)) <= 864e5);
    if (twin) {
      findings.push({ group: "REGJISTRIMI", title: "I njëjti dorëzim i regjistruar dy herë", refs: `Dorëzim #${h.id} (=${"#" + twin.id})`,
        evidence: `#${twin.id}: ${dmy(dayKey(twin.date)!)}, ${eur(cents(twin.amount))}, "${esc(twin.recipient)}", regjistruar ${at(twin.createdAt)} · #${h.id}: ${dmy(sys)}, regjistruar ${at(h.createdAt)}, shënimi "${esc(h.recipient)}"`,
        effectCents: sys >= FROM ? cents(h.amount) : 0, affectsTotal: true });
    } else if (sys >= FROM && real < FROM) {
      findings.push({ group: "REGJISTRIMI", title: "Dorëzim i gushtit i shënuar me datë shtatori", refs: `Dorëzim #${h.id}`,
        evidence: `data në sistem ${dmy(sys)}, shënimi: "${esc(h.recipient)}" → data reale ${dmy(real)}`, effectCents: cents(h.amount), affectsTotal: false });
    }
  }

  // ── Pagesat cash: dëshmia (DEP) u dha para datës së pagesës ──
  const pays = await db.payment.findMany({ where: { categoryId: shk.id, paidAmount: { gt: 0 } }, include: { student: { select: { firstName: true, lastName: true } } } });
  const allDep = await db.payment.findMany({ where: { receiptNumber: { startsWith: `DEP-${AY}-` } }, select: { receiptNumber: true, createdAt: true } });
  const depN = (r: string | null) => r?.startsWith(`DEP-${AY}-`) ? parseInt(r.slice(9)) : null;
  const firstDepOnOrAfter = (day: string) => Math.min(...allDep.filter(x => dayKey(x.createdAt)! >= day).map(x => depN(x.receiptNumber)!));
  const name = (p: typeof pays[number]) => `${p.student.firstName} ${p.student.lastName}`.replace(/\s+/g, " ");
  for (const p of pays) {
    if (p.method !== "CASH" || !p.paidDate) continue;
    const n = depN(p.receiptNumber), day = dayKey(p.paidDate)!;
    if (n == null || day < FROM) continue;
    const bound = firstDepOnOrAfter(day);
    if (n < bound) {
      const before = allDep.filter(x => depN(x.receiptNumber)! <= n).map(x => dayKey(x.createdAt)!).sort().pop()!;
      findings.push({ group: "REGJISTRIMI", title: "Pagesë cash e marrë para datës së shënuar (dëshmia u dha më herët)", refs: `Pagesë #${p.id} ${esc(name(p))} · ${p.receiptNumber}`,
        evidence: `data e pagesës në sistem ${dmy(day)}; dëshmia ${p.receiptNumber} u dha deri më ${dmy(before)} (dëshmia e parë e ${dmy(day)} e më pas është nr. ${bound}); rreshti u krijua ${at(p.createdAt)}; ${p.month}/${p.year}`,
        effectCents: -cents(p.paidAmount), affectsTotal: false });
    }
  }

  // ── Dyfishime të mundshme ──
  const cash = pays.filter(p => p.method === "CASH" && p.paidDate && dayKey(p.paidDate)! >= `${AY}-06-01`);
  const ayOf = (m: number | null, y: number | null) => m == null || y == null ? null : (m >= 9 ? y : y - 1);
  for (const a of cash) for (const b of cash) {
    if (a.id >= b.id || a.studentId !== b.studentId || a.paidAmount !== b.paidAmount) continue;
    if (Math.abs(a.paidDate!.getTime() - b.paidDate!.getTime()) > 60 * 864e5) continue;
    const sameMonth = a.month === b.month && a.year === b.year, diffAY = ayOf(a.month, a.year) !== ayOf(b.month, b.year);
    if (!sameMonth && !diffAY) continue;
    const later = b.paidDate! >= a.paidDate! ? b : a;
    findings.push({ group: "I_MUNDSHEM", title: "Dy pagesa cash me të njëjtën shumë — dyfishim i mundshëm", refs: `Pagesa #${a.id} dhe #${b.id} ${esc(name(a))}`,
      evidence: `#${a.id}: ${dmy(dayKey(a.paidDate)!)}, ${a.month}/${a.year}, ${a.receiptNumber}, krijuar ${at(a.createdAt)} · #${b.id}: ${dmy(dayKey(b.paidDate)!)}, ${b.month}/${b.year}, ${b.receiptNumber}, krijuar ${at(b.createdAt)} · krahaso dy dëshmitë në letër`,
      effectCents: later.paidDate! >= new Date(`${FROM}T00:00:00Z`) ? -cents(later.paidAmount) : 0, affectsTotal: true });
  }

  // ── Shpenzime cash të shënuara "të papaguara" pas regjistrimit ──
  const unpaid = await db.shpenzim.findMany({ where: { deletedAt: null, paguar: false, metoda: "CASH", data: { gte: new Date(`${FROM}T00:00:00Z`) } } });
  for (const s of unpaid) if (s.updatedAt.getTime() - s.createdAt.getTime() > 864e5)
    findings.push({ group: "I_MUNDSHEM", title: "Shpenzim cash i kaluar më vonë në \"i papaguar\"", refs: `Shpenzim #${s.id} ${esc(s.pershkrim)}`,
      evidence: `${dmy(dayKey(s.data)!)}, ${eur(cents(s.shuma))}, krijuar ${at(s.createdAt)}, ndryshuar ${at(s.updatedAt)} — nëse u pagua nga arka, arka e pritur ulet`, effectCents: -cents(s.shuma), affectsTotal: true });

  // ── Regjistrime të vonuara (cash, ≥ 3 ditë pas datës) ──
  const lateRows = movs.filter(m => m.day >= FROM && m.boxCents !== 0 && m.recordedAt - Date.parse(`${m.day}T23:59:59Z`) > 3 * 864e5);

  const ov = (await computeShkollimiOverview(1, AY, "academic"))!;
  const pasqyraC = cents(ov.cashFlow.inCashBox);
  await db.$disconnect();

  // ── Ura e diferencës ──
  const sumF = (pred: (f: Finding) => boolean) => findings.filter(pred).reduce((s, f) => s + f.effectCents, 0);
  const gapNow = last ? last.gap : 0;                                           // me të dhënat e kësaj kopjeje (datat e sistemit)
  const corrC = sumF(f => f.group === "KORRIGJUAR");
  const regTotalC = sumF(f => f.group === "REGJISTRIMI" && f.affectsTotal);     // dyfishime të provuara
  const regShiftC = sumF(f => f.group === "REGJISTRIMI" && !f.affectsTotal);    // vetëm data (kalojnë te O)
  const gapReal = gapNow + regTotalC + regShiftC;
  const possibleC = sumF(f => f.group === "I_MUNDSHEM");
  const minUnexplained = gapReal + possibleC;

  const fRows = (g: Finding["group"]) => findings.filter(f => f.group === g).map(f => `<tr><td>${esc(f.title)}</td><td>${f.refs}</td><td>${f.evidence}</td><td class="r">${f.effectCents ? sgn(f.effectCents) : "0"}</td><td>${f.affectsTotal ? "shumën totale" : "vetëm ndarjen O / pas 1 shtatorit"}</td></tr>`).join("") || `<tr><td colspan="5"><i>asnjë</i></td></tr>`;
  let run = 0;
  const ledger = movs.filter(m => m.day >= FROM && m.boxCents !== 0).map(m => { run += m.boxCents; return `<tr><td>${dmy(m.day)}</td><td>${SRC[m.source]} #${m.id}</td><td>${esc(m.label)}</td><td class="r">${m.boxCents > 0 ? eur(m.boxCents) : ""}</td><td class="r">${m.boxCents < 0 ? eur(-m.boxCents) : ""}</td><td class="r">O ${sgn(run)}</td><td>${at(new Date(m.recordedAt))}</td></tr>`; }).join("");
  const weeks = new Map<string, { in: number; out: number }>();
  for (const m of movs) if (m.day >= FROM && m.boxCents) { const d = new Date(`${m.day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); const w = weeks.get(k) ?? { in: 0, out: 0 }; if (m.boxCents > 0) w.in += m.boxCents; else w.out -= m.boxCents; weeks.set(k, w); }
  let wr = 0;
  const weekRows = [...weeks].sort().map(([k, w]) => { wr += w.in - w.out; return `<tr><td>java e ${dmy(k)}</td><td class="r">${eur(w.in)}</td><td class="r">${eur(w.out)}</td><td class="r">O ${sgn(wr)}</td></tr>`; }).join("");

  const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>Hetimi i arkës</title>
<style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111;max-width:1150px;margin:auto}
h1{font-size:18px}h2{font-size:14px;margin-top:22px;border-bottom:2px solid #0F766E;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #bbb;padding:4px 6px;vertical-align:top}th{background:#eee;text-align:left}
.r{text-align:right;white-space:nowrap}.tot td{font-weight:bold;background:#f2f2f2}.big td{font-size:13px}small{color:#555}.note{background:#fff7e6;border:1px solid #f0c36d;padding:8px;margin:8px 0}</style></head><body>
<h1>Hetimi i diferencës së arkës së Shkollimit — rakordim i provueshëm</h1>
<p>Kopja: <b>${esc(path.basename(dbFile))}</b> (${fs.statSync(dbFile).mtime.toLocaleString("sq")})${oldCopy ? ` · krahasuar me <b>${esc(oldCopy)}</b>` : ""} · vetëm lexim.</p>
<div class="note"><b>O</b> = gjendja reale e arkës më 31.08.${AY}: <b>e panjohur</b> (s'ka numërim). Çdo shumë "e pritur" më poshtë është <b>O + …</b>. Meqë O ≥ 0, mungesa reale është <b>të paktën</b> sa shkruhet, plus O.</div>

<h2>1. Ura e diferencës</h2>
<table class="big"><tr><th>Hapi</th><th class="r">Shuma</th><th>Prova</th></tr>
${reported != null ? `<tr><td>Diferenca e raportuar (me të dhënat e kopjes së mëparshme)</td><td class="r">${eur(reported)} + O</td><td>arka fizike sipas regjistrimeve − 1.090 € të numëruara</td></tr>
<tr><td>Korrigjimet e bëra në sistem pas asaj kopjeje (seksioni 3)</td><td class="r">${sgn(corrC)}</td><td>${corrections.length} rreshta, të krahasuar kopje me kopje</td></tr>` : ""}
<tr class="tot"><td>Diferenca me këtë kopje (datat siç janë në sistem): arka fizike ${eur(last?.expected ?? net.closingCents)} − numëruar ${eur(last ? cents(last.c.countedAmount) : 0)} (${last ? at(last.c.createdAt) : "—"})</td><td class="r">${eur(gapNow)} + O</td><td>${reported != null && reported + corrC !== gapNow ? `<b>kujdes: ${eur(reported)} ${sgn(corrC)} ≠ ${eur(gapNow)}</b>` : "✓ përputhet me hapat më sipër"}</td></tr>
<tr><td>Dorëzime të regjistruara dy herë (provuar nga shënimi + rreshti binjak)</td><td class="r">${sgn(regTotalC)}</td><td>seksioni 4 — e <b>rrit</b> mungesën: paratë dolën një herë</td></tr>
<tr><td>Data reale e gushtit për lëvizje të shënuara në shtator (vetëm kalojnë te O)</td><td class="r">${sgn(regShiftC)}</td><td>seksioni 4 — dëshmitë DEP dhe shënimet e dorëzimeve</td></tr>
<tr class="tot"><td>Diferenca me datat reale të provuara</td><td class="r">${eur(gapReal)} + O</td><td></td></tr>
<tr><td>Nëse konfirmohen TË GJITHA gjetjet e mundshme (seksioni 5)</td><td class="r">${sgn(possibleC)}</td><td>kërkojnë dëshminë në letër / vendimin tuaj</td></tr>
<tr class="tot"><td>Mbetet e pashpjeguar edhe në rastin më të mirë</td><td class="r">${eur(minUnexplained)} + O</td><td>mungesë reale ose lëvizje që s'janë regjistruar fare (seksioni 7)</td></tr></table>

<h2>2. Numërimet e arkës</h2>
<table><tr><th>#</th><th>Kur</th><th class="r">Numëruar</th><th class="r">Pritej (O + …)</th><th class="r">Mungon (+ O)</th><th>Nga numërimi i kaluar: regjistruar / vërejtur</th><th>Shënim</th></tr>
${countRows.map(r => `<tr><td>${r.c.id}</td><td>${at(r.c.createdAt)} · ${esc(r.c.userName)}</td><td class="r">${eur(cents(r.c.countedAmount))}</td><td class="r">${eur(r.expected)}</td><td class="r">${eur(r.gap)}</td>
<td>${r.prev ? `regjistruar ${sgn(r.recChange)}${r.recBetween.length ? ` <small>(${r.recBetween.map(m => `${SRC[m.source]} #${m.id} ${esc(m.label)} ${sgn(m.boxCents)}`).join("; ")})</small>` : ""} · vërejtur ${sgn(r.observed!)} → ${r.observed === r.recChange ? "<b>përputhet ✓</b>" : `<b>${sgn(r.observed! - r.recChange)} pa shpjegim</b>`}` : "—"}</td>
<td>${r.c.basis === "DATA_REALE" ? "" : "<small>ruajtur me logjikën e vjetër: sistemi " + eur(cents(r.c.systemAmount)) + "</small>"}</td></tr>`).join("")}</table>
<p><small>Numërimi #1 (0 €) s'është fshirë dhe s'ndryshohet. Provë që ishte real: mes #1 dhe #2 u regjistrua vetëm pagesa cash e Jeman Morinës (1.000 €) dhe numërimi #2 doli saktë 1.000 € më shumë. Një test zakonisht s'përputhet kaq saktë. Konfirmimin përfundimtar e jep personi që numëroi.</small></p>

${oldCopy ? `<h2>3. Korrigjimet e bëra në sistem pas kopjes së mëparshme</h2>
<table><tr><th>Rreshti</th><th>Para</th><th>Pas</th><th class="r">Efekti te diferenca</th></tr>
${corrections.map(x => `<tr><td>${x.key} ${esc(x.label)}</td><td>${x.before}</td><td>${x.after}</td><td class="r">${sgn(x.boxDelta)}</td></tr>`).join("")}
<tr class="tot"><td colspan="3">Gjithsej</td><td class="r">${sgn(corrC)}</td></tr></table>
<p><small>Këto i ka bërë stafi në sistem. Dokumenti që i vërteton (ekstrakti bankar, fletëpagesa, fatura) duhet kontrolluar. Shenja − do të thotë se diferenca u zvogëlua.</small></p>` : ""}

<h2>4. Gabime regjistrimi të provuara nga vetë të dhënat</h2>
<table><tr><th>Lloji</th><th>Rreshti</th><th>Prova</th><th class="r">Efekti te diferenca</th><th>Prek</th></tr>${fRows("REGJISTRIMI")}</table>

<h2>5. Të mundshme — kërkojnë dëshminë në letër</h2>
<table><tr><th>Lloji</th><th>Rreshti</th><th>Prova</th><th class="r">Efekti nëse konfirmohet</th><th>Prek</th></tr>${fRows("I_MUNDSHEM")}</table>
<p><small>Regjistrime cash të futura ≥ 3 ditë pas datës së tyre: ${lateRows.length} rreshta (${eur(lateRows.reduce((s, m) => s + m.boxCents, 0))} neto). Shih kolonën "Regjistruar" te shtojca. S'janë gabime vetvetiu, por janë vendet ku një datë ose shumë mund të jetë shkruar gabim.</small></p>

<h2>6. Gabime të kodit (ndikojnë shifrat e shfaqura, jo paratë)</h2>
<table><tr><th>Gabimi</th><th>Efekti</th><th>Gjendja</th></tr>
<tr><td>"Në arkë" i Dashboard-it ndiqte vitin shkollor të çdo rreshti, jo datën reale</td><td>tregonte ${eur(pasqyraC)} në vend të O + ${eur(net.closingCents)}. Diferenca ${sgn(net.closingCents - pasqyraC)} = pagesat e verës + pagesat e regjistruara për vite të tjera (Koprani etj.). Mungesa dukej ${eur(pasqyraC - (last ? cents(last.c.countedAmount) : 0))} në vend të ${eur(gapNow)} + O.</td><td>ndrequr në degën feature/arka-fizike (pa deploy)</td></tr>
<tr><td>Kontrolli "Bilanci përputhet" krahasonte llogarinë me vetveten</td><td>dilte gjithmonë ✓</td><td>zëvendësuar me rakordimin (degë)</td></tr>
<tr><td>"Numëro arkën" krahasonte me "Në arkë" të vitit</td><td>numërimet #1–#${counts.length} u ruajtën me diferencë të gabuar (kolona e fundit e seksionit 2)</td><td>ndrequr (degë); historiku s'preket</td></tr>
<tr><td>Sistemi lejon datë pagese të ndryshme nga dita e regjistrimit pa paralajmërim</td><td>bëri të mundur gabimet e seksionit 4</td><td>propozim: rregulli i auditimit R13</td></tr>
<tr><td>Metoda e pagesës te plani fleksibël shfaqej gabim (Cash në vend të Bankë)</td><td>vetëm shfaqje — ruajtja ishte e saktë, s'prek arkën</td><td>ndrequr më parë</td></tr></table>

<h2>7. Para jashtë arkës</h2>
<p>Të regjistruara: të gjitha dorëzimet janë te persona (shih shtojcën, "Dorëzim"). Asnjë s'është depozitë bankare. Në të dhëna <b>s'ka asnjë gjurmë</b> për para të mbajtura jashtë arkës pa u regjistruar, si avanse te furnitorët, paga të paregjistruara, para te një person apo para të përziera me arkat e tjera (Ushqimi, Eshkollori). Pikërisht këtu mund të jetë pjesa e pashpjeguar. Kjo provohet vetëm me pyetje te stafi dhe me dokumente.</p>

<h2>8. Sa duhej të kishte arka, javë pas jave</h2>
<table><tr><th>Java</th><th class="r">Hyrje cash</th><th class="r">Dalje cash</th><th class="r">Gjendja e pritur në fund</th></tr>${weekRows}</table>
<p><small>Numërimi i parë është i 07.10. Para tij s'ka asnjë numërim, prandaj s'mund të provohet në cilën javë mungoi paraja. Pas 07.10 numërimet lëvizin pak (seksioni 2): pjesa e madhe e mungesës lindi <b>para 07.10.2026</b>.</small></p>

<h2>Shtojca — çdo hyrje dhe dalje cash nga 01.09.${AY}</h2>
<table><tr><th>Data</th><th>Rreshti</th><th>Përshkrimi</th><th class="r">Hyrje</th><th class="r">Dalje</th><th class="r">Gjendja</th><th>Regjistruar</th></tr>${ledger}
<tr class="tot"><td colspan="3">Gjithsej</td><td class="r">${eur(net.inCents)}</td><td class="r">${eur(net.outCents)}</td><td class="r">O ${sgn(net.closingCents)}</td><td></td></tr></table>
</body></html>`;
  fs.writeFileSync(out, html, "utf8");

  console.log(`arka fizike O + ${eur(net.closingCents)} | Pasqyra ${eur(pasqyraC)}`);
  for (const r of countRows) console.log(`numërimi #${r.c.id} ${at(r.c.createdAt)}: ${eur(cents(r.c.countedAmount))} pritej ${eur(r.expected)} mungon ${eur(r.gap)}+O | regj ${sgn(r.recChange)} vërejtur ${r.observed == null ? "-" : sgn(r.observed)}`);
  console.log(`korrigjime ${sgn(corrC)} | dyfishime ${sgn(regTotalC)} | data ${sgn(regShiftC)} | me datat reale ${eur(gapReal)}+O | të mundshme ${sgn(possibleC)} | min. pa shpjegim ${eur(minUnexplained)}+O`);
  for (const f of findings) console.log(`[${f.group}] ${f.title} | ${f.refs} | ${sgn(f.effectCents)} | ${f.affectsTotal ? "total" : "datë"}`);
  console.log(`vonuara ${lateRows.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
