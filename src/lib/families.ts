import { prisma } from "./prisma";

// Familjet — VENDI I VETËM për: normalizimin e telefonit, grupimin e nxënësve
// në familje, lidhjen e nxënësve të rinj dhe kërkimin.
//
// Rregullat e grupimit:
//  • Dy nxënës lidhen me telefon VETËM kur ndajnë një numër (pas normalizimit)
//    DHE kanë të njëjtin mbiemër ose të njëjtin emër prindi — një numër i gabuar
//    s'duhet të bashkojë dy familje krejt të ndryshme.
//  • Normalizimi: vetëm shifra; "00…" → "…"; "0…" → "383…"; numër 8-shifror që
//    fillon me 4 (044 pa zero) → "3834…".
//  • Bashkimet SIPAS EMRIT (fëmijë pa telefon, numra të shkruar ndryshe) s'bëhen
//    kurrë automatikisht — vetëm si sugjerime që konfirmohen.

export function phoneKey(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `383${d.slice(1)}`;
  else if (d.length === 8 && d.startsWith("4")) d = `383${d}`;
  return d.length >= 8 ? d : "";
}

export const normName = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/ë/g, "e").replace(/ç/g, "c").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

export interface FamilyStudentLite {
  id: number;
  firstName: string;
  lastName: string;
  parentPhone: string | null; fatherPhone: string | null; motherPhone: string | null;
  parentName: string | null; fatherName: string | null; motherName: string | null;
}

export const phonesOf = (s: FamilyStudentLite) =>
  [...new Set([s.parentPhone, s.fatherPhone, s.motherPhone].map(phoneKey).filter(Boolean))];
const parentNamesOf = (s: FamilyStudentLite) =>
  [s.fatherName, s.motherName, s.parentName].map(normName).filter(n => n.split(" ").length >= 2);

function related(a: FamilyStudentLite, b: FamilyStudentLite): boolean {
  if (normName(a.lastName) && normName(a.lastName) === normName(b.lastName)) return true;
  const pa = parentNamesOf(a);
  return parentNamesOf(b).some(n => pa.includes(n));
}

/** Grupimi sipas telefonit (me rregullin e mbiemrit/prindit). Kthen grupet + numrat "konfliktues". */
export function groupByPhone(students: FamilyStudentLite[]) {
  const parent = new Map<number, number>();
  students.forEach(s => parent.set(s.id, s.id));
  const find = (x: number): number => { const p = parent.get(x)!; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
  const byPhone = new Map<string, FamilyStudentLite[]>();
  for (const s of students) for (const p of phonesOf(s)) {
    if (!byPhone.has(p)) byPhone.set(p, []);
    byPhone.get(p)!.push(s);
  }
  // Numrat që lidhnin fëmijë pa asnjë lidhje tjetër (p.sh. 044 376 477 te dy familje)
  const conflicts: { phone: string; students: FamilyStudentLite[] }[] = [];
  for (const [phone, list] of byPhone) {
    let conflict = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (related(list[i], list[j])) parent.set(find(list[i].id), find(list[j].id));
        else conflict = true;
      }
    }
    if (conflict) conflicts.push({ phone, students: list });
  }
  const groups = new Map<number, number[]>();
  for (const s of students) {
    const r = find(s.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(s.id);
  }
  return { groups: [...groups.values()], conflicts };
}

/** Sugjerime bashkimi sipas emrit të plotë të prindit (vetëm sugjerime — kërkojnë konfirmim). */
export function suggestNameMerges(students: FamilyStudentLite[], groups: number[][]) {
  const groupIdx = new Map<number, number>();
  groups.forEach((g, i) => g.forEach(id => groupIdx.set(id, i)));
  const byName = new Map<string, Set<number>>();
  for (const s of students) for (const n of parentNamesOf(s)) {
    if (!byName.has(n)) byName.set(n, new Set());
    byName.get(n)!.add(groupIdx.get(s.id)!);
  }
  // Bashko sugjerimet që ndajnë grupe (p.sh. nëna dhe babai i njëjtë → një sugjerim)
  const raw = [...byName.entries()].filter(([, gs]) => gs.size >= 2).map(([name, gs]) => ({ names: [name], groups: new Set(gs) }));
  const merged: { names: string[]; groups: Set<number> }[] = [];
  for (const r of raw) {
    const hit = merged.find(m => [...r.groups].some(g => m.groups.has(g)));
    if (hit) { r.names.forEach(n => hit.names.includes(n) || hit.names.push(n)); r.groups.forEach(g => hit.groups.add(g)); }
    else merged.push(r);
  }
  return merged.map(m => ({
    key: [...m.groups].sort((a, b) => a - b).map(g => Math.min(...groups[g])).join("-"),
    parentNames: m.names,
    groupIndexes: [...m.groups].sort((a, b) => a - b),
  }));
}

const STUDENT_FAMILY_SELECT = {
  id: true, firstName: true, lastName: true, familyRefId: true, status: true,
  parentPhone: true, fatherPhone: true, motherPhone: true, parentName: true, fatherName: true, motherName: true,
} as const;

/** Kontakti kryesor sipas fushave të fëmijës (parentPhone = ai që merr SMS-të). */
export function primaryOf(s: FamilyStudentLite): "FATHER" | "MOTHER" | "GUARDIAN" | null {
  const p = phoneKey(s.parentPhone);
  if (p && p === phoneKey(s.fatherPhone)) return "FATHER";
  if (p && p === phoneKey(s.motherPhone)) return "MOTHER";
  if (p) return "GUARDIAN";
  return s.fatherPhone ? "FATHER" : s.motherPhone ? "MOTHER" : null;
}

/**
 * Lidh një nxënës (pa familje) me familjen ekzistuese — sipas telefonit +
 * mbiemrit/prindit — ose krijon familje të re. Thirret nga regjistrimi, importi
 * dhe pranimi i aplikimeve. S'hedh kurrë gabim.
 */
export async function ensureStudentFamily(studentId: number): Promise<number | null> {
  try {
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { ...STUDENT_FAMILY_SELECT, organizationId: true } });
    if (!s) return null;
    if (s.familyRefId) return s.familyRefId;
    const phones = phonesOf(s);
    if (phones.length) {
      const candidates = await prisma.student.findMany({
        where: { organizationId: s.organizationId, familyRefId: { not: null }, id: { not: s.id } },
        select: STUDENT_FAMILY_SELECT,
      });
      const match = candidates.find(c => phonesOf(c).some(p => phones.includes(p)) && related(s, c));
      if (match?.familyRefId) {
        await prisma.student.update({ where: { id: s.id }, data: { familyRefId: match.familyRefId } });
        return match.familyRefId;
      }
    }
    const fam = await prisma.family.create({ data: { organizationId: s.organizationId, primaryContact: primaryOf(s) } });
    await prisma.student.update({ where: { id: s.id }, data: { familyRefId: fam.id } });
    return fam.id;
  } catch (e) {
    console.error("[families] lidhja e familjes dështoi:", e);
    return null;
  }
}

/** Teksti i kërkueshëm (pa ë/ç, shkronja të vogla) dhe numrat e normalizuar. */
export function searchMatches(query: string, texts: (string | null | undefined)[], phones: (string | null | undefined)[]): boolean {
  const q = normName(query);
  const qDigits = query.replace(/\D/g, "");
  if (qDigits.length >= 4) {
    const qk = phoneKey(qDigits) || qDigits;
    const tail = qk.length > 8 ? qk.slice(-8) : qk;
    if (phones.some(p => { const k = phoneKey(p); return !!k && (k.includes(tail) || k.includes(qDigits)); })) return true;
  }
  if (!q) return false;
  const hay = texts.map(normName).join(" | ");
  return q.split(" ").every(w => hay.includes(w));
}

export function familyLabel(displayName: string | null | undefined, lastNames: string[]): string {
  if (displayName?.trim()) return displayName.trim();
  const counts = new Map<string, number>();
  for (const l of lastNames) { const k = l.trim(); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}
