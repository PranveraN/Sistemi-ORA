import type { PrismaClient } from "@prisma/client";
import { paymentChannel } from "@/lib/cashFlow";

// RAPORTI I PËRGJITHSHËM (Raportet → "Raporti i përgjithshëm") — VETËM LEXIM.
// Të gjitha të hyrat dhe shpenzimet e një periudhe (muaj nga–deri), sipas DATËS SË PAGESËS,
// me të njëjtat rregulla si Bilanci dhe modulet:
//  · Pagesat (Shkollimi, Ushqimi, eShkollori, …): vetëm të konfirmuarat, paidAmount > 0, sipas paidDate.
//    Kompensimi s'është para — del veç (kanali "kompensim").
//  · Uniformat / Librat: pagesat e shitjeve (UniPayment/BookPayment) sipas paidAt; shitjet e anuluara s'hyjnë.
//  · Të hyra tjera (Hyra): sipas muajit/vitit të tyre.
//  · Shpenzimet: të paguarat sipas datës; faturat me pagesa pjesë-pjesë → çdo pagesë në datën e vet.
//    Shpenzimet e moduleve (Expense EXPENSE) që s'janë kaluar te Shpenzimet; HANDOVER = dorëzime (veç).
//  · Investimet dhe dorëzimet: seksione informative, jashtë bilancit.
// "Pritet / Borxh": rreshtat e pagesave me afat brenda periudhës dhe shitjet e periudhës.

type Kanal = "cash" | "banke" | "kompensim" | "pa";

export interface Levizje { d: string; lloji: "HYRE" | "SHPENZIM" | "DOREZIM" | "INVESTIM"; kat: string; emri: string; cents: number; kanal: Kanal; ref: string | null }
export interface Pritje { kat: string; prituraCents: number; borxhCents: number }

const ch = (m: string | null | undefined): Kanal => paymentChannel(m) ?? "pa";
const c = (v: number) => Math.round((Number(v) || 0) * 100);
const iso = (d: Date) => d.toISOString().slice(0, 10);
// Moduli eShkollori përdor kategorinë "Platforma Digjitale"; "Eshkollori" është kategoria e vjetër — një rresht
const emriKat = (n: string) => (n === "Platforma Digjitale" || n === "Eshkollori" ? "eShkollori" : n);

/** Periudha [start, end) — muaj të plotë. */
export async function raportiPergjithshem(prisma: PrismaClient, start: Date, end: Date) {
  const range = { gte: start, lt: end };
  const muajt: { muaj: number; vit: number }[] = [];
  for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) muajt.push({ muaj: d.getMonth() + 1, vit: d.getFullYear() });

  const [pagesat, uniPay, bookPay, hyrat, shpenzimet, shpPagesat, expenses, investime, pritPag, uniSales, bookSales] = await Promise.all([
    prisma.payment.findMany({
      where: { confirmed: true, paidAmount: { gt: 0 }, paidDate: range },
      select: { paidAmount: true, paidDate: true, method: true, receiptNumber: true, description: true, category: { select: { name: true } }, student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.uniPayment.findMany({ where: { paidAt: range, sale: { status: { not: "CANCELLED" } } }, select: { amount: true, paidAt: true, method: true, sale: { select: { id: true, customerName: true } } } }),
    prisma.bookPayment.findMany({ where: { paidAt: range }, select: { amount: true, paidAt: true, method: true, saleId: true } }),
    muajt.length ? prisma.hyra.findMany({ where: { OR: muajt.map(x => ({ muaj: x.muaj, vit: x.vit })) } }) : Promise.resolve([]),
    prisma.shpenzim.findMany({ where: { deletedAt: null, paguar: true, mePagesa: false, data: range }, include: { kategori: { select: { emri: true } } } }),
    prisma.shpenzimPagese.findMany({ where: { data: range, shpenzim: { deletedAt: null } }, include: { shpenzim: { select: { pershkrim: true, emriBiznesit: true, nrFature: true, kategori: { select: { emri: true } } } } } }),
    prisma.expense.findMany({ where: { date: range, migratedToShpenzimId: null }, include: { category: { select: { name: true } } } }),
    prisma.investim.findMany({ where: { data: range } }),
    prisma.payment.findMany({ where: { dueDate: range }, select: { finalAmount: true, balance: true, category: { select: { name: true } } } }),
    prisma.uniSale.findMany({ where: { saleDate: range, status: { not: "CANCELLED" } }, select: { totalAmount: true, balance: true } }),
    prisma.bookSale.findMany({ where: { saleDate: range, status: { not: "CANCELLED" } }, select: { totalAmount: true, balance: true, paidAmount: true, status: true } }),
  ]);

  const levizje: Levizje[] = [];
  for (const p of pagesat) levizje.push({ d: iso(p.paidDate!), lloji: "HYRE", kat: emriKat(p.category.name), emri: p.student ? `${p.student.firstName} ${p.student.lastName}`.trim() : "—", cents: c(p.paidAmount), kanal: ch(p.method), ref: p.receiptNumber });
  for (const p of uniPay) levizje.push({ d: iso(p.paidAt), lloji: "HYRE", kat: "Uniformat", emri: p.sale.customerName, cents: c(p.amount), kanal: ch(p.method), ref: `Shitja #${p.sale.id}` });
  // BookPayment s'ka relacion me shitjen — lexohen shitjet veç (të anuluarat s'hyjnë)
  const librat = new Map((await prisma.bookSale.findMany({ where: { id: { in: [...new Set(bookPay.map(p => p.saleId))] } }, select: { id: true, studentName: true, receiptNumber: true, status: true } })).map(x => [x.id, x]));
  for (const p of bookPay) {
    const sale = librat.get(p.saleId);
    if (!sale || sale.status === "CANCELLED") continue;
    levizje.push({ d: iso(p.paidAt), lloji: "HYRE", kat: "Librat", emri: sale.studentName, cents: c(p.amount), kanal: ch(p.method), ref: sale.receiptNumber ?? `Shitja #${sale.id}` });
  }
  for (const h of hyrat) levizje.push({ d: `${h.vit}-${String(h.muaj).padStart(2, "0")}-01`, lloji: "HYRE", kat: "Të hyra tjera", emri: h.paguesit, cents: c(h.shuma), kanal: ch(h.metoda), ref: h.referenca });
  for (const s of shpenzimet) levizje.push({ d: iso(s.data), lloji: "SHPENZIM", kat: s.kategori.emri, emri: s.emriBiznesit || s.marres || s.pershkrim || "—", cents: c(s.shuma), kanal: ch(s.metoda), ref: s.nrFature });
  for (const p of shpPagesat) levizje.push({ d: iso(p.data), lloji: "SHPENZIM", kat: p.shpenzim.kategori.emri, emri: p.shpenzim.emriBiznesit || p.shpenzim.pershkrim || "—", cents: p.shumaCents, kanal: ch(p.metoda), ref: p.shpenzim.nrFature });
  for (const e of expenses) levizje.push({ d: iso(e.date), lloji: e.type === "HANDOVER" ? "DOREZIM" : "SHPENZIM", kat: e.type === "HANDOVER" ? `Dorëzim — ${e.category.name}` : `${e.category.name} (moduli)`, emri: e.recipient || e.description || "—", cents: c(e.amount), kanal: ch(e.method), ref: e.reference });
  for (const v of investime) levizje.push({ d: iso(v.data), lloji: "INVESTIM", kat: v.tipi === "KAPITAL" ? "Investim kapital" : "Investim i përkohshëm", emri: v.pershkrim, cents: c(v.vlera), kanal: ch(v.metoda === "TRANSFER" ? "BANK" : v.metoda), ref: v.kategoria });
  levizje.sort((x, y) => x.d.localeCompare(y.d));

  const pritje = new Map<string, Pritje>();
  const shto = (kat: string, pr: number, bx: number) => { const e = pritje.get(kat) ?? { kat, prituraCents: 0, borxhCents: 0 }; e.prituraCents += pr; e.borxhCents += bx; pritje.set(kat, e); };
  for (const p of pritPag) shto(emriKat(p.category.name), c(p.finalAmount), c(p.balance));
  for (const s of uniSales) shto("Uniformat", c(s.totalAmount), c(s.balance));
  for (const s of bookSales) shto("Librat", c(s.status === "NOT_TAKEN" ? s.paidAmount : s.totalAmount), s.status === "NOT_TAKEN" ? 0 : c(s.balance));

  return { nga: iso(start), deri: iso(new Date(end.getTime() - 86400000)), muajt, levizje, pritje: [...pritje.values()] };
}
