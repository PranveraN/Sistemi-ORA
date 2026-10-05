import { prisma } from "@/lib/prisma";
import { formatCurrency, normalizeSearch } from "@/lib/utils";
import { computeStudentFinanceRows } from "@/lib/studentFinanceRows";
import { computeStudentAllFinance, FINANCE_CATEGORY_LABELS, type FinanceCategory } from "@/lib/studentCategoryFinance";
import { computeTuitionMessageStatuses } from "@/lib/tuitionMessageStatus";
import { STUDENT_PAY_STATUSES } from "@/lib/studentTableStatus";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import type { OraContext, OraTool, ToolResult, OraItem, OraAction } from "../types";

// Veglat e nxënësve. ÇDO numër vjen nga funksionet ekzistuese të sistemit:
// - shkollimi: computeStudentFinanceRows (faqja Nxënësit, Klasat, Familjet)
// - "me_vonese": computeTuitionMessageStatuses (faqja e mesazheve)
// - kategoritë e tjera: computeStudentAllFinance (profili i familjes, mesazhet)
// Asnjë llogaritje e re paralele.

const CATEGORY_MAP: Record<string, FinanceCategory> = {
  shkollimi: "SHKOLLIMI", ushqimi: "USHQIMI", uniforma: "UNIFORMA", eshkollori: "ESHKOLLORI", librat_anglishte: "LIBRAT",
};
const PAY_STATUS_VALUES = ["te_gjitha", "paguar", "pjeserisht", "pa_paguar", "me_vonese", "timi_invest", "me_borxh"] as const;
const PAY_STATUS_LABEL: Record<string, string> = {
  te_gjitha: "", paguar: "Paguar", pjeserisht: "Pjesërisht", pa_paguar: "Pa paguar", me_vonese: "Me vonesë", timi_invest: "Timi Invest", me_borxh: "Me borxh",
};
const SIMPLE_LABEL: Record<string, string> = { PAID: "Paguar", PARTIAL: "Pjesërisht", UNPAID: "Pa paguar", OVERDUE: "Me vonesë", TIMI_INVEST: "Timi Invest" };
const PAGE_LABEL: Record<string, string> = Object.fromEntries(STUDENT_PAY_STATUSES.map(s => [s.key, s.label]));

/** Skema e filtrave — e njëjtë për count_students dhe list_students (strict: të gjitha fushat të detyrueshme). */
const FILTER_PROPERTIES = {
  payment_status: {
    type: "string", enum: [...PAY_STATUS_VALUES],
    description: "Statusi i pagesës. 'paguar'/'pjeserisht'/'pa_paguar'/'timi_invest' = si te faqja Nxënësit; 'me_vonese' = afati ka kaluar dhe ka mbetje (si te mesazhet, vetëm shkollimi); 'me_borxh' = Pa paguar + Pjesërisht si te faqja Nxënësit (te kategoritë e tjera mbetja > 0); 'te_gjitha' = pa filtër.",
  },
  category: {
    type: "string", enum: Object.keys(CATEGORY_MAP),
    description: "Kategoria e pagesës. Parazgjedhje 'shkollimi'. 'timi_invest' dhe 'me_vonese' vlejnë vetëm për 'shkollimi'.",
  },
  class_name: { type: "string", description: "Emri i klasës, p.sh. '2A' ose '9B'. Bosh '' = të gjitha klasat." },
  level: { type: "string", enum: ["", "1", "2", "3", "4", "5", "6", "7", "8", "9"], description: "Niveli (klasa 1–9, të gjitha paralelet). Bosh '' = të gjitha." },
  active: { type: "string", enum: ["aktiv", "joaktiv", "te_gjithe"], description: "Nxënësit aktivë (parazgjedhje), joaktivë ose të gjithë." },
  year: { type: "integer", description: "Viti akademik fillestar (p.sh. 2026 për 2026–2027). 0 = viti aktual." },
};
const FILTER_REQUIRED = Object.keys(FILTER_PROPERTIES);

interface Filters { payment_status: string; category: string; class_name: string; level: string; active: string; year: number }

interface Row {
  id: number; name: string; className: string | null; parentName: string | null;
  statusKey: string; statusLabel: string; final: number; paid: number; balance: number;
}

const normClass = (s: string) => normalizeSearch(s).replace(/klasa|klase|kl\.?/g, "").replace(/[\s\-_]/g, "").toUpperCase();
const yearLabel = (y: number) => `${y}–${y + 1}`;

function readFilters(input: Record<string, unknown>, ctx: OraContext): Filters {
  const s = (k: string, d: string) => (typeof input[k] === "string" ? String(input[k]) : d);
  const y = Number(input.year);
  return {
    payment_status: PAY_STATUS_VALUES.includes(s("payment_status", "") as never) ? s("payment_status", "") : "te_gjitha",
    category: CATEGORY_MAP[s("category", "")] ? s("category", "") : "shkollimi",
    class_name: s("class_name", "").trim(),
    level: s("level", "").trim(),
    active: ["aktiv", "joaktiv", "te_gjithe"].includes(s("active", "")) ? s("active", "") : "aktiv",
    year: Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : ctx.year,
  };
}

function describeFilters(f: Filters, className: string | null): string {
  return [
    f.payment_status !== "te_gjitha" ? `Statusi = ${PAY_STATUS_LABEL[f.payment_status]}` : null,
    `Kategoria: ${FINANCE_CATEGORY_LABELS[CATEGORY_MAP[f.category]]}`,
    className ? `Klasa ${className}` : f.level ? `Klasa ${f.level} (të gjitha paralelet)` : null,
    f.active === "aktiv" ? "nxënës aktivë" : f.active === "joaktiv" ? "nxënës joaktivë" : "aktivë dhe joaktivë",
    `Viti ${yearLabel(f.year)}`,
  ].filter(Boolean).join(" · ");
}

/** Nxënësit sipas filtrave, me shumat/statusin nga funksionet e sistemit. */
async function studentRows(ctx: OraContext, f: Filters): Promise<{ rows: Row[]; className: string | null; classId: number | null } | { error: string }> {
  const where: Record<string, unknown> = { organizationId: ctx.orgId };
  if (f.active === "aktiv") where.status = "ACTIVE";
  else if (f.active === "joaktiv") where.status = "INACTIVE";

  let className: string | null = null;
  let classId: number | null = null;
  if (f.class_name) {
    const classes = await prisma.class.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, name: true } });
    const c = classes.find(x => normClass(x.name) === normClass(f.class_name));
    if (!c) return { error: `Klasa "${f.class_name}" nuk ekziston. Klasat: ${classes.map(x => x.name).join(", ")}.` };
    where.classId = c.id;
    className = c.name;
    classId = c.id;
  } else if (f.level) {
    where.class = { level: `Klasa ${f.level}` };
  }

  const cat = CATEGORY_MAP[f.category];
  if (cat !== "SHKOLLIMI" && (f.payment_status === "timi_invest" || f.payment_status === "me_vonese")) {
    return { error: `Statusi "${PAY_STATUS_LABEL[f.payment_status]}" vlen vetëm për shkollimin.` };
  }

  if (cat === "SHKOLLIMI") {
    const { rows } = await computeStudentFinanceRows(where, { year: f.year, yearType: "academic" });
    let overdue: Map<number, { status: string }> | null = null;
    if (f.payment_status === "me_vonese") {
      overdue = (await computeTuitionMessageStatuses(rows.map(r => ({ id: r.id, firstName: r.firstName, lastName: r.lastName, discountPct: r.discountPct })), f.year)).statuses;
    }
    const out: Row[] = rows.map(r => {
      const key = overdue ? overdue.get(r.id)?.status ?? r.payStatus : r.payStatus;
      return {
        id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), className: r.className, parentName: r.parentName,
        statusKey: key, statusLabel: (overdue ? SIMPLE_LABEL[key] : PAGE_LABEL[key]) ?? key,
        final: r.finalPrice, paid: r.paid, balance: r.balance,
      };
    });
    const keep = (r: Row) => {
      switch (f.payment_status) {
        case "paguar": return r.statusKey === "PAID";
        case "pjeserisht": return r.statusKey === "PARTIAL";
        case "pa_paguar": return r.statusKey === "UNPAID";
        case "timi_invest": return r.statusKey === "TIMI_INVEST";
        case "me_vonese": return r.statusKey === "OVERDUE";
        // Si karta "Me borxh" te faqja Nxënësit dhe Klasat: Pa paguar + Pjesërisht (Timi Invest veçmas)
        case "me_borxh": return r.statusKey === "UNPAID" || r.statusKey === "PARTIAL";
        default: return true;
      }
    };
    return { rows: out.filter(keep), className, classId };
  }

  // Kategoritë e tjera — vetëm nxënësit që e kanë shërbimin (si te mesazhet/profili i familjes)
  const students = await prisma.student.findMany({
    where, select: { id: true, firstName: true, lastName: true, fatherName: true, motherName: true, parentName: true, class: { select: { name: true } } },
  });
  const fin = await computeStudentAllFinance(ctx.orgId, students.map(s => s.id), f.year);
  const out: Row[] = [];
  for (const s of students) {
    const c = fin.get(s.id)?.categories[cat];
    if (!c) continue;
    out.push({
      id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), className: s.class?.name ?? null,
      parentName: s.fatherName || s.motherName || s.parentName || null,
      statusKey: c.status, statusLabel: SIMPLE_LABEL[c.status] ?? c.status, final: c.final, paid: c.paid, balance: c.balance,
    });
  }
  const keep = (r: Row) => {
    switch (f.payment_status) {
      case "paguar": return r.statusKey === "PAID";
      case "pjeserisht": return r.statusKey === "PARTIAL";
      case "pa_paguar": return r.statusKey === "UNPAID";
      case "me_borxh": return r.balance > 0.005;
      default: return true;
    }
  };
  return { rows: out.filter(keep), className, classId };
}

/** Për veglat e tjera (p.sh. debtors): të gjithë nxënësit sipas filtrave, pa kufi. */
export async function studentsMatching(input: Record<string, unknown>, ctx: OraContext) {
  const f = readFilters(input, ctx);
  const r = await studentRows(ctx, f);
  return "error" in r ? r : { ...r, filters: f, source: describeFilters(f, r.className), toItem: (row: Row) => toItem(row, true), actions: studentListActions(f, r.rows, r.classId) };
}

function byClass(rows: Row[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.className ?? "Pa klasë", (m.get(r.className ?? "Pa klasë") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "sq", { numeric: true })).map(([cls, count]) => ({ class: cls, count }));
}

const SUBJECT_STATUS: Record<string, string> = {
  te_gjitha: "", paguar: " që kanë paguar plotësisht", pjeserisht: " që kanë paguar pjesërisht", pa_paguar: " që s'kanë paguar",
  me_vonese: " me vonesë", timi_invest: " me Timi Invest", me_borxh: " me borxh",
};

function subjectLabel(f: Filters, className: string | null): string {
  const st = SUBJECT_STATUS[f.payment_status] ?? "";
  const cat = f.category !== "shkollimi" ? ` (${FINANCE_CATEGORY_LABELS[CATEGORY_MAP[f.category]]})` : "";
  const cls = className ? ` në ${className}` : f.level ? ` në klasën ${f.level}` : "";
  return `nxënës${st}${cat}${cls}`;
}

/**
 * Veprimet për një listë nxënësish — hapin modulet ekzistuese me filtrat e
 * parapërgatitur; dërgimi/eksporti konfirmohet atje (Ora s'ndryshon asgjë).
 */
export function studentListActions(f: Filters, rows: Row[], classId: number | null): OraAction[] {
  const actions: OraAction[] = [];
  // "Hap listën" te faqja Nxënësit — vetëm për shkollimin dhe statuset që faqja i ka si filtër
  const CARD: Record<string, string> = { paguar: "card=paid", me_borxh: "card=debt", timi_invest: "card=ti", pjeserisht: "card=debt&pay=partial", pa_paguar: "card=debt&pay=none", te_gjitha: "" };
  if (f.category === "shkollimi" && CARD[f.payment_status] !== undefined && !f.level) {
    const p = [CARD[f.payment_status], classId ? `cl=${classId}` : "", f.active === "joaktiv" ? "st=INACTIVE" : f.active === "te_gjithe" ? "st=all" : "", f.year !== DEFAULT_YEAR_FOR_LINKS ? `y=${f.year}` : ""].filter(Boolean).join("&");
    actions.push({ type: "open_list", label: "Hap listën te Nxënësit", params: { href: `/students${p ? `?${p}` : ""}` }, module: "students" });
  }
  if (rows.length && rows.length <= 500) {
    actions.push({ type: "send_sms", label: `Dërgo SMS (${rows.length})`, params: { href: `/sms?students=${rows.map(r => r.id).join(",")}` }, module: "sms" });
  }
  if (rows.length) {
    const q = encodeURIComponent(JSON.stringify({ payment_status: f.payment_status, category: f.category, class_name: f.class_name, level: f.level, active: f.active, year: f.year }));
    actions.push({ type: "export", label: "Eksporto (Excel/CSV)", params: { href: `/api/ora/export?f=${q}` }, module: "students" });
  }
  return actions;
}
const DEFAULT_YEAR_FOR_LINKS = DEFAULT_ACADEMIC_YEAR; // viti me të cilin hapet faqja Nxënësit

const toItem = (r: Row, withBalance: boolean): OraItem => ({
  type: "student", id: r.id, title: r.name,
  subtitle: [r.className, r.parentName ? `Prindi: ${r.parentName}` : null].filter(Boolean).join(" · "),
  badge: withBalance && r.balance > 0.005 ? `${r.statusLabel} · ${formatCurrency(r.balance)}` : r.statusLabel,
});

export const countStudents: OraTool = {
  name: "count_students",
  module: "students",
  description:
    "Numëron nxënësit sipas statusit të pagesës, kategorisë, klasës/nivelit, aktiv/joaktiv dhe vitit. Kthen numrin total dhe ndarjen sipas klasave. " +
    "Përdore për pyetje 'sa nxënës…' (p.sh. 'Sa nxënës kemi me Timi Invest?', 'sa kanë paguar plotësisht shkollimin në 3A?'). " +
    "Numrat janë identikë me faqen Nxënësit (dhe me mesazhet për 'me_vonese'). Nuk kthen emra — për emra përdor list_students.",
  input_schema: { type: "object", properties: FILTER_PROPERTIES, required: FILTER_REQUIRED, additionalProperties: false },
  async run(input, ctx): Promise<ToolResult> {
    const f = readFilters(input, ctx);
    const r = await studentRows(ctx, f);
    if ("error" in r) return { ok: false, error: r.error, forModel: { error: r.error } };
    const classes = byClass(r.rows);
    const label = subjectLabel(f, r.className);
    return {
      ok: true,
      forModel: { total: r.rows.length, by_class: classes, filters: describeFilters(f, r.className) },
      display: {
        big_number: { value: String(r.rows.length), label },
        breakdown: classes.length > 1 ? classes.map(c => ({ label: c.class, value: String(c.count) })) : [],
        items: [], total_items: r.rows.length, actions: studentListActions(f, r.rows, r.classId),
        source: describeFilters(f, r.className),
        fallbackAnswer: `${r.rows.length} ${label}.`,
      },
    };
  },
};

export const listStudents: OraTool = {
  name: "list_students",
  module: "students",
  description:
    "Liston nxënësit (emri, klasa, statusi, mbetja) sipas të njëjtave filtra si count_students, plus 'limit' (1–50). Kthen edhe totalin. " +
    "Përdore për pyetje 'kush…' ose 'cilët…' (p.sh. 'Kush ka borxh në 2A?'). Me 'me_borxh' renditet sipas mbetjes (më e madhja e para), ndryshe sipas emrit.",
  input_schema: {
    type: "object",
    properties: { ...FILTER_PROPERTIES, limit: { type: "integer", description: "Sa rreshta të kthehen (1–50). Parazgjedhje 20." } },
    required: [...FILTER_REQUIRED, "limit"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    const f = readFilters(input, ctx);
    const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));
    const r = await studentRows(ctx, f);
    if ("error" in r) return { ok: false, error: r.error, forModel: { error: r.error } };
    const debt = f.payment_status === "me_borxh" || f.payment_status === "me_vonese";
    const sorted = [...r.rows].sort((a, b) => (debt ? b.balance - a.balance : 0) || a.name.localeCompare(b.name, "sq"));
    const top = sorted.slice(0, limit);
    const label = subjectLabel(f, r.className);
    return {
      ok: true,
      forModel: {
        total: r.rows.length, shown: top.length,
        students: top.map(x => ({ id: x.id, name: x.name, class: x.className, status: x.statusLabel, balance: x.balance })),
        filters: describeFilters(f, r.className),
      },
      display: {
        big_number: { value: String(r.rows.length), label },
        breakdown: [], items: top.map(x => toItem(x, true)), total_items: r.rows.length, actions: studentListActions(f, r.rows, r.classId),
        source: describeFilters(f, r.className),
        fallbackAnswer: `${r.rows.length} ${label}.`,
      },
    };
  },
};

export const studentPayments: OraTool = {
  name: "student_payments",
  module: "students",
  description:
    "Gjen një nxënës sipas emrit (përputhje e përafërt, pa ë/ç, me gabime të vogla) dhe kthen për çdo kategori pagese: çmimi final, paguar, mbetja dhe statusi, plus zbritjen e shkollimit. " +
    "Përdore për pyetje si 'Sa ka paguar Dua Azemi?' ose 'a ka borxh X?'. Nëse emri përputhet me disa nxënës, kthen kandidatët: atëherë pyet përdoruesin cilin (needs_clarification).",
  input_schema: {
    type: "object",
    properties: {
      student_query: { type: "string", description: "Emri (dhe/ose mbiemri) i nxënësit siç e shkroi përdoruesi." },
      category: { type: "string", enum: ["te_gjitha", ...Object.keys(CATEGORY_MAP)], description: "Kategoria e kërkuar; 'te_gjitha' kur s'përmendet." },
      year: { type: "integer", description: "Viti akademik fillestar; 0 = viti aktual." },
    },
    required: ["student_query", "category", "year"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    const q = normalizeSearch(String(input.student_query ?? "")).replace(/\s+/g, " ");
    const yIn = Number(input.year);
    const year = Number.isFinite(yIn) && yIn >= 2000 && yIn <= 2100 ? yIn : ctx.year;
    const catKey = String(input.category ?? "te_gjitha");
    if (q.length < 2) return { ok: false, error: "Shkruaj emrin e nxënësit.", forModel: { error: "emri mungon" } };

    const all = await prisma.student.findMany({
      where: { organizationId: ctx.orgId },
      select: { id: true, firstName: true, lastName: true, status: true, familyRefId: true, class: { select: { name: true } } },
    });
    const tokens = q.split(" ");
    const full = (s: { firstName: string; lastName: string }) => normalizeSearch(`${s.firstName} ${s.lastName}`).replace(/\s+/g, " ");
    let matches = all.filter(s => tokens.every(t => full(s).includes(t)));
    const exact = matches.filter(s => full(s) === q);
    if (exact.length === 1) matches = exact;
    else if (matches.length > 1) {
      const active = matches.filter(s => s.status === "ACTIVE");
      if (active.length === 1 && matches.length - active.length > 0 && tokens.length >= 2) matches = active;
    }

    if (!matches.length) {
      return { ok: true, forModel: { found: false, query: input.student_query }, display: emptyDisplay(`Asnjë nxënës me emrin "${input.student_query}".`, "Kërkim sipas emrit") };
    }
    if (matches.length > 1) {
      const cands = matches.slice(0, 8).map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, class: s.class?.name ?? null, active: s.status === "ACTIVE" }));
      const question = `Cilin nxënës e keni parasysh: ${cands.map(c => `${c.name}${c.class ? ` (${c.class})` : ""}`).join(", ")}?`;
      return {
        ok: true, clarification: question,
        forModel: { found: "multiple", candidates: cands },
        display: {
          big_number: null, breakdown: [], total_items: matches.length, actions: [],
          items: cands.map(c => ({ type: "student" as const, id: c.id, title: c.name, subtitle: c.class ?? "Pa klasë", badge: c.active ? undefined : "Joaktiv" })),
          source: "Kërkim sipas emrit", fallbackAnswer: question,
        },
      };
    }

    const s = matches[0];
    const fin = (await computeStudentAllFinance(ctx.orgId, [s.id], year)).get(s.id);
    const cats = Object.entries(fin?.categories ?? {}) as [FinanceCategory, { final: number; paid: number; balance: number; status: string }][];
    const wanted = catKey !== "te_gjitha" ? cats.filter(([k]) => k === CATEGORY_MAP[catKey]) : cats;
    const name = `${s.firstName} ${s.lastName}`;
    const tuition = fin?.tuition;
    const totals = wanted.reduce((a, [, c]) => ({ final: a.final + c.final, paid: a.paid + c.paid, balance: a.balance + c.balance }), { final: 0, paid: 0, balance: 0 });
    const round = (n: number) => Math.round(n * 100) / 100;
    const statusText = (st: string) => SIMPLE_LABEL[st] ?? PAGE_LABEL[st] ?? st;

    if (catKey !== "te_gjitha" && !wanted.length) {
      return {
        ok: true, forModel: { found: true, student: { name, class: s.class?.name ?? null }, category: catKey, has_category: false },
        display: emptyDisplay(`${name} nuk ka pagesa për ${FINANCE_CATEGORY_LABELS[CATEGORY_MAP[catKey]]} në vitin ${yearLabel(year)}.`, `Nxënësi: ${name} · Viti ${yearLabel(year)}`),
      };
    }

    return {
      ok: true,
      forModel: {
        found: true,
        student: { id: s.id, name, class: s.class?.name ?? null, active: s.status === "ACTIVE" },
        year: yearLabel(year),
        tuition_discount_pct: tuition?.discountPct ?? 0,
        timi_invest: !!tuition?.timiInvest,
        categories: wanted.map(([k, c]) => ({ category: FINANCE_CATEGORY_LABELS[k], final: round(c.final), paid: round(c.paid), balance: round(c.balance), status: statusText(c.status) })),
        totals: { final: round(totals.final), paid: round(totals.paid), balance: round(totals.balance) },
      },
      display: {
        big_number: { value: formatCurrency(totals.paid), label: wanted.length === 1 ? `paguar · ${FINANCE_CATEGORY_LABELS[wanted[0][0]]}` : "paguar gjithsej (të gjitha kategoritë)" },
        breakdown: wanted.map(([k, c]) => ({
          label: FINANCE_CATEGORY_LABELS[k],
          value: `${formatCurrency(c.paid)} nga ${formatCurrency(c.final)} · mbetja ${formatCurrency(c.balance)} · ${statusText(c.status)}`,
        })),
        items: [{ type: "student", id: s.id, title: name, subtitle: s.class?.name ?? "Pa klasë", badge: tuition?.timiInvest ? "Timi Invest" : undefined }],
        total_items: 1,
        actions: [
          ...(s.familyRefId ? [{ type: "open_profile" as const, label: "Hap profilin e familjes", params: { href: `/families/${s.familyRefId}` }, module: "families" }] : []),
          { type: "open_list" as const, label: "Hap te Nxënësit", params: { href: `/students?q=${encodeURIComponent(name)}&st=all` }, module: "students" },
          { type: "send_sms" as const, label: "Dërgo SMS prindit", params: { href: `/sms?students=${s.id}` }, module: "sms" },
        ],
        source: `Nxënësi: ${name} · ${wanted.length === 1 ? FINANCE_CATEGORY_LABELS[wanted[0][0]] : "të gjitha kategoritë"} · Viti ${yearLabel(year)}${tuition?.discountPct ? ` · zbritje ${tuition.discountPct}%` : ""}`,
        fallbackAnswer: `${name} ka paguar ${formatCurrency(totals.paid)} nga ${formatCurrency(totals.final)}; mbetja ${formatCurrency(totals.balance)}.`,
      },
    };
  },
};

function emptyDisplay(text: string, source: string) {
  return { big_number: null, breakdown: [], items: [], total_items: 0, actions: [], source, fallbackAnswer: text };
}
