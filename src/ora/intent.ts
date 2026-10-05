import { normalizeSearch } from "@/lib/utils";

// Kuptimi i pyetjes ME RREGULLA (pa AI, falas). Nga teksti nxjerr statusin,
// kategorinë, klasën/nivelin, aktiv/joaktiv dhe emrin e nxënësit, pastaj
// zgjedh veglën. Përgjigjen e ndërton gjithmonë sistemi nga rezultati i veglës.

export type Intent =
  | { kind: "tool"; tool: string; input: Record<string, unknown> }
  | { kind: "clarify"; question: string }
  | { kind: "unknown" };

export interface NameIndexEntry { id: number; firstName: string; lastName: string; status: string }

/** Normalizim: pa ë/ç, pa shenja pikësimi, hapësira të njëtrajtshme. */
export function normalizeQuestion(q: string): string {
  return normalizeSearch(q).replace(/[?!.,;:"“”'’()]/g, " ").replace(/\s+/g, " ").trim();
}

const ORDINALS: Record<string, string> = { pare: "1", dyte: "2", trete: "3", katert: "4", katerte: "4", peste: "5", gjashte: "6", shtate: "7", tete: "8", nente: "9" };

export function detectClass(t: string): { class_name: string; level: string } {
  const m = t.match(/(?:^|\s)(?:klas\w*\s+|kl\s+)?([1-9])\s*-?\s*([ab])(?:\s|$)/);
  if (m) return { class_name: `${m[1]}${m[2].toUpperCase()}`, level: "" };
  const lv = t.match(/klas\w*\s+(?:e\s+)?([1-9])(?:\s|$)/) ?? t.match(/(?:^|\s)(?:e\s+)?([1-9])\s*(?:-|t)?\s*(?:te|ta|shit)?\s+klas/);
  if (lv) return { class_name: "", level: lv[1] };
  const ord = t.match(/klas\w*\s+(?:e\s+)?(pare|dyte|trete|katerte?|peste|gjashte|shtate|tete|nente)(?:\s|$)/);
  if (ord) return { class_name: "", level: ORDINALS[ord[1]] };
  return { class_name: "", level: "" };
}

export function detectCategory(t: string): string {
  if (/ushqim/.test(t)) return "ushqimi";
  if (/uniform/.test(t)) return "uniforma";
  if (/e\s*-?\s*shkollor|eshkollor/.test(t)) return "eshkollori";
  if (/libr|anglisht/.test(t)) return "librat_anglishte";
  return "shkollimi";
}

/** Statusi i pagesës; "" kur pyetja s'përmend status. Radha ka rëndësi. */
export function detectStatus(t: string): string {
  if (/timi\s*-?\s*invest|\btimi\b/.test(t)) return "timi_invest";
  if (/vones|vonuar|kan vonu|me vonu/.test(t)) return "me_vonese";
  if (/pjeserisht|pjesrisht|pjeserishte|pjesen|pjese/.test(t)) return "pjeserisht";
  // "s'kanë paguar" → pas normalizimit "s kane paguar"; "s" duhet të jetë fjalë më vete (jo fundi i "nxënës")
  if (/pa\s+pagu|pa\s+paguar|nuk\s+(?:e\s+)?(?:kane?|kan|ka)\s+(?:e\s+)?pag|(?:^|\s)s\s+(?:e\s+)?(?:kane?|kan|ka)\s+(?:e\s+)?pag|(?:^|\s)s(?:kan|kane|ka)\s+pag|(?:^|\s)asgje(?:\s|$)|(?:^|\s)fare(?:\s|$)/.test(t)) return "pa_paguar";
  if (/borxh|detyrim|mbet|mbeten|mbetje|kan\s+per\s+pagu/.test(t)) return "me_borxh";
  if (/pagu|paguar|paguan|plotesisht|kryer pages/.test(t)) return "paguar";
  return "";
}

export function detectActive(t: string): string {
  if (/joaktiv|jo aktiv|cregjistr|larguar|ish nxenes/.test(t)) return "joaktiv";
  if (/aktiv dhe joaktiv|te gjithe nxenesit perfshire/.test(t)) return "te_gjithe";
  return "aktiv";
}

function levenshtein1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

/** Fjala e pyetjes përputhet me një pjesë emri (lakim: "Fejzullahut", gabim i vogël shkrimi). */
function tokenMatches(q: string, n: string): boolean {
  if (n.length < 2) return false;
  if (q === n) return true;
  if (n.length >= 4 && q.startsWith(n) && q.length - n.length <= 3) return true; // lakimi
  if (n.length >= 5 && levenshtein1(q, n)) return true;                          // gabim shkrimi
  return false;
}

const STOP = new Set(["sa", "ka", "kane", "kan", "a", "e", "te", "ne", "per", "nga", "si", "kush", "cili", "cila", "paguar", "pagu", "borxh", "klasa", "klasen", "nxenes", "nxenesi", "nxenesit"]);

/** Gjen nxënësit që përmenden me emër dhe mbiemër në pyetje. */
export function findNamedStudents(t: string, index: NameIndexEntry[]): { matches: NameIndexEntry[]; firstNameOnly: string | null } {
  const qTokens = t.split(" ").filter(w => w.length >= 2 && !STOP.has(w));
  const scored: { s: NameIndexEntry; score: number }[] = [];
  for (const s of index) {
    const first = normalizeQuestion(s.firstName).split(" ").filter(Boolean);
    const last = normalizeQuestion(s.lastName).split(" ").filter(Boolean);
    if (!last.length) continue;
    const firstHit = first.some(n => qTokens.some(q => tokenMatches(q, n)));
    const lastHit = last.every(n => qTokens.some(q => tokenMatches(q, n)));
    if (firstHit && lastHit) scored.push({ s, score: first.filter(n => qTokens.some(q => q === n)).length + last.filter(n => qTokens.some(q => q === n)).length });
  }
  if (scored.length) {
    const best = Math.max(...scored.map(x => x.score));
    return { matches: scored.filter(x => x.score === best).map(x => x.s), firstNameOnly: null };
  }
  // Vetëm emri (p.sh. "Sa ka paguar Sara?") — kandidatë për sqarim
  const firstNames = new Set(index.map(s => normalizeQuestion(s.firstName).split(" ")[0]));
  const only = qTokens.find(q => q.length >= 3 && firstNames.has(q));
  return { matches: [], firstNameOnly: only ?? null };
}

const LIST_WORDS = /(?:^|\s)(kush|cilet|cilat|cili|cila|emrat|listo|lista|listen|trego|tregom|shfaq|me trego)(?:\s|$)/;
const COUNT_NOUN = /nxenes|veta|vete|femij|student|gjithsej/;
const PAY_SINGULAR = /(?:^|\s)(sa\s+ka|a\s+ka|ka\s+pagu|ka\s+paguar|i\s+ka\s+mbet|i\s+mbetet|borxhi\s+i|pagesat\s+e|pagesa\s+e)(?:\s|$)/;

const PERIODS: [RegExp, string][] = [
  [/javen e kaluar|java e kaluar/, "javen_e_kaluar"], [/muajin e kaluar|muaji i kaluar/, "muajin_e_kaluar"],
  [/kete jave|kete javen|kesaj jave|javen|jave/, "kete_jave"], [/kete muaj|kete muajin|kesaj muaji|muajin|muaj/, "kete_muaj"],
  [/kete vit|vitin|kete vite/, "kete_vit"], [/(?:^|\s)dje(?:\s|$)/, "dje"], [/(?:^|\s)sot(?:\s|$)|sodit/, "sot"],
];

/** Rregullat e veglave të veçanta — kontrollohen para "sa/kush" të përgjithshme. */
function parseSpecial(t: string, cls: { class_name: string; level: string }, category: string, categoryMentioned: boolean): Intent | null {
  // Vende të lira / mësuesi i klasës / kapaciteti → class_overview
  if (/vend\w*\s+(?:te\s+)?lir|kapacitet|kujdestar|mesues\w*\s+(?:kujdestar\w*\s+)?(?:i|e)\s+klas|kush e ka klasen|pasqyr\w*\s+e\s+klas/.test(t)) {
    if (!cls.class_name) return { kind: "clarify", question: "Për cilën klasë? P.sh. \"Sa vende të lira ka klasa 1A?\"" };
    return { kind: "tool", tool: "class_overview", input: { class_name: cls.class_name } };
  }
  // Kërkesat e materialeve → requests_summary
  if (/kerkes\w*/.test(t) && !/regjistrim|aplikim/.test(t)) {
    const st = /ne pritje|pa vendim|te reja/.test(t) ? "ne_pritje" : /shqyrtim/.test(t) ? "ne_shqyrtim" : /aprovu/.test(t) ? "aprovuara"
      : /porosit/.test(t) ? "porositur" : /dorezu/.test(t) ? "dorezuar" : /refuzu/.test(t) ? "refuzuara" : "te_gjitha";
    const teacher = t.match(/(?:nga|mesuesi|mesuesja|mesueses|mesuesit|e mesueses)\s+([a-z]{3,}(?:\s+[a-z]{3,})?)/)?.[1] ?? "";
    return { kind: "tool", tool: "requests_summary", input: { status: st, teacher_query: teacher.replace(/\s+(ne|per|qe|jane)$/, "") } };
  }
  // Aplikimet e regjistrimit → registrations_summary
  if (/aplikim|regjistrimet|regjistrime(?:\s|$)|kerkes\w* per regjistrim/.test(t)) {
    const st = /shqyrtim|pritje/.test(t) ? "ne_shqyrtim" : /evidenc/.test(t) ? "evidenca" : /pranu|aprovu/.test(t) ? "pranuar" : /refuzu/.test(t) ? "refuzuar" : "te_gjitha";
    return { kind: "tool", tool: "registrations_summary", input: { status: st, grade: parseInt(cls.level || cls.class_name.slice(0, 1) || "0") || 0 } };
  }
  // Stafi me të dhëna të paplotësuara → staff_incomplete_data
  if (/paplotes|pa plotesuar|jo te plota|te paplote|mungojne te dhena|te dhenat qe mungojne|te dhena qe mungojne/.test(t) && !/nxenes/.test(t)) {
    const role = /asistent/.test(t) ? "asistente" : /mesues|mesimdhenes/.test(t) ? "mesimdhenes" : "te_gjithe";
    return { kind: "tool", tool: "staff_incomplete_data", input: { role } };
  }
  // Pagesat e një periudhe → payments_summary
  if (/pagesa|pagesat|u pagu|u paguan|arketu|para u mblodh|sa para|hyrat|te hyra/.test(t)) {
    const period = PERIODS.find(([re]) => re.test(t))?.[1];
    if (period) {
      const cat = categoryMentioned && category !== "librat_anglishte" ? category : "te_gjitha";
      return { kind: "tool", tool: "payments_summary", input: { period, category: cat } };
    }
  }
  // Familja → family_summary
  const fam = t.match(/familj\w*\s+(?:e\s+)?([a-z][a-z\s]{1,40})$/) ?? t.match(/familj\w*\s+(?:e\s+)?([a-z]{3,}(?:\s+[a-z]{3,})?)/);
  if (fam) {
    const query = fam[1].replace(/\s+(ka|kane|sa|borxh|paguar|pagu|femije|femijet|ne|per)(\s.*)?$/, "").trim();
    if (query.length >= 3) return { kind: "tool", tool: "family_summary", input: { family_query: query, year: 0 } };
  }
  // Debitorët / borxhet më të mëdha → debtors
  if (/debitor|borxh\w*\s+(?:me\s+)?(?:te\s+)?(?:medh|madh|larta|lart)|me shume borxh|me se shumti borxh|borxhi total|borxhi i pergjithshem|sa borxh ka gjithsej|totali i borxh/.test(t)) {
    return { kind: "tool", tool: "debtors", input: { category, class_name: cls.class_name, level: cls.level, limit: 10 } };
  }
  return null;
}

export function parseIntent(question: string, names: NameIndexEntry[]): Intent {
  const t = normalizeQuestion(question);
  if (t.length < 2) return { kind: "unknown" };

  const cls = detectClass(t);
  const status = detectStatus(t);
  const category = detectCategory(t);
  const categoryMentioned = category !== "shkollimi" || /shkollim/.test(t);
  const active = detectActive(t);

  const special = parseSpecial(t, cls, category, categoryMentioned);
  if (special) return special;

  // 1) Nxënës i përmendur me emër → pagesat e tij
  const named = findNamedStudents(t, names);
  if (named.matches.length) {
    const query = named.matches.length === 1 ? `${named.matches[0].firstName} ${named.matches[0].lastName}` : t;
    if (named.matches.length > 1) {
      const list = named.matches.slice(0, 8).map(s => `${s.firstName} ${s.lastName}`).join(", ");
      return { kind: "clarify", question: `Cilin nxënës e keni parasysh: ${list}?` };
    }
    return { kind: "tool", tool: "student_payments", input: { student_query: query, category: categoryMentioned ? category : "te_gjitha", year: 0 } };
  }
  if (named.firstNameOnly && PAY_SINGULAR.test(t) && !cls.class_name && !cls.level) {
    return { kind: "tool", tool: "student_payments", input: { student_query: named.firstNameOnly, category: categoryMentioned ? category : "te_gjitha", year: 0 } };
  }

  const filters = { payment_status: status || "te_gjitha", category, class_name: cls.class_name, level: cls.level, active, year: 0 };
  const hasSubject = COUNT_NOUN.test(t) || !!cls.class_name || !!cls.level || status === "timi_invest" || active === "joaktiv";

  // 2) "kush / cilët / trego…" → lista
  if (LIST_WORDS.test(t) && (hasSubject || status)) {
    return { kind: "tool", tool: "list_students", input: { ...filters, limit: 20 } };
  }

  // 3) "sa …" → numri
  if (/(?:^|\s)sa(?:\s|$)/.test(t) || /numri|numer|totali|gjithsej/.test(t)) {
    if (!hasSubject) {
      return { kind: "clarify", question: "Për cilin nxënës, klasë ose kategori? P.sh. \"Sa nxënës kanë paguar shkollimin?\" ose \"Sa ka paguar Dua Azemi?\"" };
    }
    return { kind: "tool", tool: "count_students", input: filters };
  }

  // 4) Pyetje me status/klasë pa "sa"/"kush" (p.sh. "nxënësit me borxh në 2A") → lista
  if (hasSubject && (status || cls.class_name || cls.level)) {
    return { kind: "tool", tool: "list_students", input: { ...filters, limit: 20 } };
  }

  return { kind: "unknown" };
}

/** Pyetje shembull për ndihmë kur Ora s'e kupton pyetjen. */
export const EXAMPLE_QUESTIONS = [
  "Sa nxënës kemi me Timi Invest?",
  "Kush ka borxh në klasën 2A?",
  "Sa ka paguar Dua Azemi?",
  "Sa vende të lira ka klasa 1A?",
  "Sa pagesa u bënë sot?",
  "Cila mësuese ka të dhëna të paplotësuara?",
];
