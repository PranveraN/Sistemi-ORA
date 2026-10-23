import type { PrismaClient } from "@prisma/client";
import { permbledhjaTimi, type NdarjaFemije } from "@/lib/timiPagesat";

// Moduli TIMI INVEST — Pasqyra (Faza 1, VETËM LEXIM).
// Shifrat bazë (çmimi, paguar nga TIMI, paguar gjithsej, mbetet, faza) vijnë 1:1 nga
// permbledhjaTimi — e njëjta llogaritje si skeda "Pagesat nga TIMI" e popup-it.
// Këtu shtohen vetëm të dhëna ndihmëse për pamjen: pagesa e fundit, profatura e fundit
// dhe sinjalet "Kërkojnë vëmendje" (vetëm shfaqen — asnjë rregullim automatik).

const TI_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
const yearMonths = (viti: number) => TI_MONTHS.map((m, i) => ({ month: m, year: i < 4 ? viti : viti + 1 }));
const DAY = 24 * 60 * 60 * 1000;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export type Vemendje = "DYFISH" | "TEPRICE" | "PROFATURE_30" | "FAZA";

export interface RreshtPasqyre {
  tiId: number; studentId: number; emri: string; klasa: string | null; prindi: string; statusi: string;
  cmimiCents: number; ngaTimiCents: number; meDoreCents: number; paguarCents: number; mbetetCents: number; faza: string;
  /** Pagesa e fundit te Shkollimi i vitit (çfarëdo burimi). */
  fundit: { data: string; cents: number; burimi: "TIMI" | "BANKE" | "CASH" | "TJETER" } | null;
  /** Profatura e fundit TIMI për këtë fëmijë. */
  profatura: { numri: string; data: string; dite: number } | null;
  vemendje: Vemendje[];
}

export async function pasqyraTimi(db: PrismaClient, orgId: number, viti: number) {
  const baza = await permbledhjaTimi(db, orgId, viti);
  const femijet = baza.femijet;
  const ids = femijet.map(f => f.studentId);

  const [cat, invoices, links] = await Promise.all([
    db.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId }, select: { id: true } }),
    db.timiInvestInvoice.findMany({ select: { number: true, date: true, timiStudentIds: true } }),
    db.timiInvestStudent.findMany({ where: { active: true }, select: { id: true, studentId: true, firstName: true, lastName: true, parentName: true } }),
  ]);
  const pays = cat ? await db.payment.findMany({
    where: { organizationId: orgId, categoryId: cat.id, studentId: { in: ids }, paidAmount: { gt: 0 }, OR: yearMonths(viti) },
    select: { studentId: true, paidAmount: true, paidDate: true, method: true },
  }) : [];

  // Pagesa e fundit — sipas datës; burimi "TIMI" kur data përputhet me një pagesë nga TIMI të fëmijës
  const timiDates = new Map<number, Set<string>>();
  for (const p of baza.pagesat.filter(p => p.vitiShkollor === viti)) {
    const d = new Date(p.data).toISOString().slice(0, 10);
    for (const f of p.ndarja as NdarjaFemije[]) (timiDates.get(f.studentId) ?? timiDates.set(f.studentId, new Set()).get(f.studentId)!).add(d);
  }
  const lastByStudent = new Map<number, NonNullable<RreshtPasqyre["fundit"]>>();
  const sameDay = new Map<string, number>();
  for (const p of pays) {
    if (!p.paidDate) continue;
    const d = p.paidDate.toISOString().slice(0, 10);
    const k = `${p.studentId}|${d}`;
    sameDay.set(k, (sameDay.get(k) ?? 0) + Math.round(p.paidAmount * 100));
  }
  for (const [k, cents] of sameDay) {
    const [sid, d] = k.split("|"); const studentId = Number(sid);
    const cur = lastByStudent.get(studentId);
    if (cur && cur.data >= d) continue;
    const row = pays.find(p => p.studentId === studentId && p.paidDate?.toISOString().slice(0, 10) === d)!;
    const burimi = timiDates.get(studentId)?.has(d) ? "TIMI"
      : row.method === "CASH" ? "CASH"
      : ["BANK", "CARD", "ONLINE"].includes(row.method ?? "") ? "BANKE" : "TJETER";
    lastByStudent.set(studentId, { data: d, cents, burimi });
  }

  // Profatura e fundit për çdo lidhje TIMI (timiStudentIds = JSON me TimiInvestStudent.id)
  const profByTi = new Map<number, { numri: string; data: Date }>();
  for (const inv of invoices) {
    let tis: number[] = [];
    try { tis = JSON.parse(inv.timiStudentIds ?? "[]"); } catch { /* bosh */ }
    for (const t of tis) {
      const cur = profByTi.get(t);
      if (!cur || cur.data < inv.date) profByTi.set(t, { numri: inv.number, data: inv.date });
    }
  }

  // Dyfishime të mundshme: i njëjti nxënës me 2+ lidhje aktive, ose i njëjti emër + prind
  const perStudent = new Map<number, number>(), perName = new Map<string, number>();
  for (const l of links) {
    if (l.studentId) perStudent.set(l.studentId, (perStudent.get(l.studentId) ?? 0) + 1);
    const k = `${norm(`${l.firstName} ${l.lastName}`)}|${norm(l.parentName)}`;
    perName.set(k, (perName.get(k) ?? 0) + 1);
  }
  const linkById = new Map(links.map(l => [l.id, l]));
  const now = Date.now();

  const rreshtat: RreshtPasqyre[] = femijet.map(f => {
    const prof = profByTi.get(f.tiId);
    const l = linkById.get(f.tiId);
    const v: Vemendje[] = [];
    if ((perStudent.get(f.studentId) ?? 0) > 1 || (l && (perName.get(`${norm(`${l.firstName} ${l.lastName}`)}|${norm(l.parentName)}`) ?? 0) > 1)) v.push("DYFISH");
    if (f.paguarCents > f.cmimiCents + 50) v.push("TEPRICE");
    const dite = prof ? Math.floor((now - prof.data.getTime()) / DAY) : null;
    if (f.faza === "PROFATURE" && f.paguarCents === 0 && dite != null && dite > 30) v.push("PROFATURE_30");
    // Faza që s'përputhet me shifrat (e njëjta rregull si rifreskoFazen, pa e ndryshuar)
    const manuale = f.faza === "PEZULLUAR" || f.faza === "ANULUAR"; // faza të vendosura me dorë
    if (!manuale && ((f.faza === "KRYER" && f.paguarCents < f.cmimiCents - 50) || (f.faza !== "KRYER" && f.cmimiCents > 0 && f.paguarCents >= f.cmimiCents - 50))) v.push("FAZA");
    return {
      ...f,
      fundit: lastByStudent.get(f.studentId) ?? null,
      profatura: prof ? { numri: prof.numri, data: prof.data.toISOString().slice(0, 10), dite: dite! } : null,
      vemendje: v,
    };
  });

  return { viti, rreshtat };
}
