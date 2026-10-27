// Faturat ↔ pagesat e Shkollimit — raport DRY-RUN dhe lidhja (opsioni B).
// Pa --apply: VETËM LEXIM (s'bën asnjë create/update/delete) dhe refuzon databazën reale.
//   DATABASE_URL="file:./kopja-e-backupit.db" npx tsx scripts/faturat-lidhja-dryrun.ts [raporti.txt]
// Me --apply (VETËM pas backup-it dhe konfirmimit të Pranverës): vendos Payment.invoiceId për
// lidhjet e propozuara, vetëm te pagesat që s'kanë ende faturë. S'prek asnjë fushë tjetër.
//   docker compose exec app npx tsx scripts/faturat-lidhja-dryrun.ts --apply
//
// Rregullat:
// - Statusi i faturës llogaritet VETËM nga pagesat e lidhura (Payment.invoiceId).
// - Pa afat (fatura të vjetra) → "Pa afat", kurrë "Me vonesë".
// - Kandidate: pagesa Shkollimi pa faturë, të një nxënësi të faturës, të paguara jo më herët se
//   120 ditë para krijimit të faturës. Një pagesë me >1 faturë kandidate s'lidhet ("të paqarta").
// - Shkollimi lidhet VETËM me faturat e shkollimit: përjashtohen faturat ku çdo zë është qartë
//   për Ushqim / eShkollor / Uniformë / Libra / Platformë / Aktivitete.
// - Një faturë që do dilte e MBIPAGUAR s'lidhet automatikisht — del për kontroll me dorë.
// - Pagesat e kategorisë "Faturat" (nga "Shëno Paguar") s'preken — i vendos kontabilisti.
// - Vendimet e Pranverës (pagesa → faturë) kanë përparësi: OVERRIDES.
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const outFile = process.argv.slice(2).find(a => !a.startsWith("--"));
// Vendim i Pranverës (27.10.2026): Amar Çitaku #1613 dhe #1614 → FAT-2026-0048
const OVERRIDES: Record<number, string> = { 1613: "FAT-2026-0048", 1614: "FAT-2026-0048" };
const NON_TUITION = /ushqim|eshkollor|uniform|lib[eë]r|libra|platform|aktivitet/i;

const url = process.env.DATABASE_URL ?? "";
if (!APPLY && /akademia-ora\.db"?$/.test(url)) {
  console.error("REFUZUAR: kjo duket databaza reale (akademia-ora.db). DRY-RUN bëhet mbi një KOPJE të backup-it.");
  process.exit(1);
}

const prisma = new PrismaClient();
const DAY = 864e5;
const CANDIDATE_WINDOW_DAYS = 120;
const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
const out: string[] = [];
const log = (s = "") => { out.push(s); console.log(s); };

type Status = "E paguar" | "Pjesërisht" | "E papaguar" | "Me vonesë" | "Pa afat" | "Anuluar";
function statusOf(total: number, paid: number, due: Date | null, cancelled: boolean, today: Date): Status {
  if (cancelled) return "Anuluar";
  const left = Math.round((total - paid) * 100) / 100;
  if (left <= 0) return "E paguar";
  if (due && due < today) return "Me vonesë";
  if (paid > 0) return "Pjesërisht";
  return due ? "E papaguar" : "Pa afat";
}

async function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cats = await prisma.paymentCategory.findMany({ select: { id: true, name: true } });
  const catName = (id: number) => cats.find(c => c.id === id)?.name ?? `#${id}`;
  const shk = cats.find(c => c.name === "Shkollimi");
  if (!shk) throw new Error("Kategoria 'Shkollimi' s'u gjet");

  const pays = await prisma.payment.findMany({
    where: { paidAmount: { gt: 0 } },
    select: {
      id: true, studentId: true, categoryId: true, paidAmount: true, paidDate: true, receiptNumber: true,
      familyReceiptId: true, invoiceId: true, description: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });
  type Pay = (typeof pays)[number];
  const sum = (a: { paidAmount: number }[]) => a.reduce((s, x) => s + x.paidAmount, 0);
  const who = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`.replace(/\s+/g, " ");

  log(`RAPORT ${APPLY ? "LIDHJA (--apply)" : "DRY-RUN"} — Faturat ↔ pagesat · ${new Date().toLocaleString("sq-AL")} · ${url}`);
  log(APPLY ? "Do të vendoset vetëm Payment.invoiceId për lidhjet e propozuara.\n" : "DRY-RUN: asgjë nuk ndryshohet në databazë.\n");

  // ── 1. Të hyrat ──────────────────────────────────────────────────────
  const withInv = pays.filter(x => x.invoiceId), noInv = pays.filter(x => !x.invoiceId);
  log("══ 1. TË HYRAT (vetëm nga pagesat) ══");
  log(`Me faturë: ${eur(sum(withInv))} · Pa faturë: ${eur(sum(noInv))} · Gjithsej: ${eur(sum(pays))} (${pays.length} pagesa)\n`);

  // ── 2. Faturat dhe lidhja e simuluar ─────────────────────────────────
  const invoices = await prisma.invoice.findMany({
    where: { type: "INVOICE" },
    include: {
      items: { select: { studentId: true, description: true } },
      payments: { select: { paidAmount: true } },
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { number: "asc" },
  });
  const inv = invoices.map(i => ({
    i,
    students: new Set([i.studentId, ...i.items.map(it => it.studentId).filter((x): x is number => !!x)]),
    paidNow: i.payments.reduce((s, x) => s + x.paidAmount, 0),
    cancelled: i.status === "CANCELLED",
  }));
  type Inv = (typeof inv)[number];
  const isTuition = (x: Inv) => !x.i.items.length || !x.i.items.every(it => NON_TUITION.test(it.description));
  const open = inv.filter(x => !x.cancelled && x.i.total - x.paidNow > 0.005);
  const openTuition = open.filter(isTuition);

  const proposed = new Map<number, Pay[]>(); // invoiceId → pagesat që lidhen
  const ambiguous: { p: Pay; invs: string[] }[] = [];
  for (const p of noInv.filter(x => x.categoryId === shk.id && x.paidDate)) {
    const forcedNo = OVERRIDES[p.id];
    const forced = forcedNo ? open.find(o => o.i.number === forcedNo) : undefined;
    if (forced) { proposed.set(forced.i.id, [...(proposed.get(forced.i.id) ?? []), p]); continue; }
    const c = openTuition.filter(o => o.students.has(p.studentId) && p.paidDate! >= new Date(o.i.createdAt.getTime() - CANDIDATE_WINDOW_DAYS * DAY));
    if (c.length === 1) proposed.set(c[0].i.id, [...(proposed.get(c[0].i.id) ?? []), p]);
    else if (c.length > 1) ambiguous.push({ p, invs: c.map(o => o.i.number) });
  }

  // Fatura që do dilnin të mbipaguara → s'lidhen, për kontroll me dorë
  const overpaid: { o: Inv; add: Pay[] }[] = [];
  for (const o of inv) {
    const add = proposed.get(o.i.id);
    if (add && o.paidNow + sum(add) - o.i.total > 0.005) { overpaid.push({ o, add }); proposed.delete(o.i.id); }
  }

  const before = new Map<Status, number>(), after = new Map<Status, number>();
  const rows = inv.map(o => {
    const add = proposed.get(o.i.id) ?? [];
    const paidAfter = o.paidNow + sum(add);
    const sB = statusOf(o.i.total, o.paidNow, o.i.dueDate, o.cancelled, today);
    const sA = statusOf(o.i.total, paidAfter, o.i.dueDate, o.cancelled, today);
    before.set(sB, (before.get(sB) ?? 0) + 1); after.set(sA, (after.get(sA) ?? 0) + 1);
    return { o, add, paidAfter, sA };
  });

  log("══ 2. STATUSI I FATURAVE — para dhe pas lidhjes ══");
  log("(Pa afat = faturë e vjetër pa datë afati; s'llogaritet 'Me vonesë')");
  for (const s of ["E paguar", "Pjesërisht", "E papaguar", "Me vonesë", "Pa afat", "Anuluar"] as Status[])
    log(`  ${s.padEnd(11)} para: ${String(before.get(s) ?? 0).padStart(3)} · pas: ${String(after.get(s) ?? 0).padStart(3)}`);

  const linked = rows.filter(r => r.add.length);
  log(`\n── 2a. Lidhjet e propozuara: ${linked.length} fatura, ${linked.reduce((s, r) => s + r.add.length, 0)} pagesa, ${eur(linked.reduce((s, r) => s + sum(r.add), 0))} ──`);
  for (const r of linked) {
    log(`  ${r.o.i.number} · ${who(r.o.i.student)} · totali ${eur(r.o.i.total)} → paguar ${eur(r.paidAfter)} · mbetja ${eur(Math.max(0, r.o.i.total - r.paidAfter))} · ${r.sA}`);
    for (const p of r.add) log(`      pagesa #${p.id} · ${who(p.student)} · ${day(p.paidDate)} · ${eur(p.paidAmount)} · dëftesë ${p.receiptNumber ?? "—"}${OVERRIDES[p.id] ? " · (vendim i Pranverës)" : ""}`);
  }

  log(`\n── 2b. NUK lidhen sepse fatura do dilte e MBIPAGUAR (kontroll me dorë): ${overpaid.length} ──`);
  for (const x of overpaid) {
    log(`  ${x.o.i.number} · ${who(x.o.i.student)} · totali ${eur(x.o.i.total)} · pagesat kandidate ${eur(sum(x.add))}`);
    for (const p of x.add) log(`      pagesa #${p.id} · ${day(p.paidDate)} · ${eur(p.paidAmount)} · dëftesë ${p.receiptNumber ?? "—"}`);
  }

  const skipped = inv.filter(o => !o.cancelled && !isTuition(o));
  log(`\n── 2c. Fatura jo-shkollimi (s'marrin pagesa Shkollimi): ${skipped.length} ──`);
  for (const o of skipped) log(`  ${o.i.number} · ${who(o.i.student)} · ${eur(o.i.total)} · ${o.i.items.map(it => it.description).join(" | ")}`);

  log(`\n── 2d. Pagesa të paqarta (më shumë se një faturë kandidate — NUK lidhen): ${ambiguous.length} ──`);
  for (const a of ambiguous) log(`  pagesa #${a.p.id} · ${who(a.p.student)} · ${day(a.p.paidDate)} · ${eur(a.p.paidAmount)} · dëftesë ${a.p.receiptNumber ?? "—"} → ${a.invs.join(", ")}`);

  const late = rows.filter(r => r.sA === "Me vonesë");
  log(`\n── 2e. Faturat që MBETEN "Me vonesë" pas lidhjes (për kontroll me dorë): ${late.length} · ${eur(late.reduce((s, r) => s + r.o.i.total - r.paidAfter, 0))} ──`);
  for (const r of late) log(`  ${r.o.i.number} · ${who(r.o.i.student)} · totali ${eur(r.o.i.total)} · paguar ${eur(r.paidAfter)} · mbetja ${eur(r.o.i.total - r.paidAfter)} · afati ${day(r.o.i.dueDate)}`);

  const noDue = rows.filter(r => r.sA === "Pa afat");
  log(`\n── 2f. Fatura të hapura "Pa afat" (të vjetra, pa datë afati): ${noDue.length} · ${eur(noDue.reduce((s, r) => s + r.o.i.total - r.paidAfter, 0))} ──`);
  for (const r of noDue) log(`  ${r.o.i.number} · ${who(r.o.i.student)} · totali ${eur(r.o.i.total)} · paguar ${eur(r.paidAfter)}`);

  // ── 3. Pagesat "Faturat" (nga "Shëno Paguar") — vetëm informacion ──
  const fat = cats.find(c => c.name === "Faturat");
  const fp = pays.filter(x => x.categoryId === fat?.id);
  log(`\n══ 3. PAGESAT 'FATURAT' (nga 'Shëno Paguar') — s'preken, i vendos kontabilisti: ${fp.length} ══`);
  for (const x of fp) log(`  #${x.id} · ${who(x.student)} · ${eur(x.paidAmount)} · ${day(x.paidDate)} · ${x.description ?? ""}`);

  // ── 4. Pa faturë dhe pa dëftesë ─────────────────────────────────────
  const bare = pays.filter(x => !x.invoiceId && !x.receiptNumber && !x.familyReceiptId);
  log(`\n══ 4. PAGESAT PA FATURË DHE PA DËFTESË: ${bare.length} · ${eur(sum(bare))} ══`);
  for (const x of bare) log(`  #${x.id} · ${who(x.student)} · ${day(x.paidDate)} · ${eur(x.paidAmount)} · ${catName(x.categoryId)}${x.description ? ` · ${x.description}` : ""}`);

  if (APPLY) {
    // Vetëm invoiceId, vetëm te pagesat ende pa faturë (where invoiceId: null → s'mbishkruan asgjë)
    let n = 0;
    await prisma.$transaction(async tx => {
      for (const [invoiceId, ps] of proposed) {
        const r = await tx.payment.updateMany({ where: { id: { in: ps.map(x => x.id) }, invoiceId: null }, data: { invoiceId } });
        n += r.count;
      }
    });
    log(`\n✔ U LIDHËN ${n} pagesa me ${proposed.size} fatura (vetëm fusha invoiceId).`);
  } else {
    log("\nDRY-RUN: asgjë nuk u ndryshua. Lidhja reale: --apply (vetëm pas backup-it dhe konfirmimit).");
  }
  if (outFile) { fs.writeFileSync(outFile, out.join("\n"), "utf8"); console.log(`\nRaporti u ruajt: ${outFile}`); }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
