import { prisma } from "@/lib/prisma";
import { formatCurrency, normalizeSearch } from "@/lib/utils";
import { computeStudentFinanceRows } from "@/lib/studentFinanceRows";
import { computeStudentAllFinance, sumFinance, FINANCE_CATEGORY_LABELS, type FinanceCategory, type StudentAllFinance } from "@/lib/studentCategoryFinance";
import { familyLabel } from "@/lib/families";
import { DEFAULT_CAPACITY } from "@/lib/classYears";
import { REQUEST_STAGES, stageOf } from "@/lib/materialConstants";
import { isAssistant, isTeacher } from "@/lib/sekretariaConstants";
import type { OraContext, OraTool, ToolResult, OraItem } from "../types";
import { studentsMatching } from "./students";

// Veglat e tjera të fazës 1. Secila thërret të njëjtat funksione/pyetje si
// faqja përkatëse dhe kërkon të njëjtin modul leje. Vetëm lexim.

const norm = (s: string) => normalizeSearch(s).replace(/\s+/g, " ").trim();
const yearLabel = (y: number) => `${y}–${y + 1}`;
const empty = (text: string, source: string) => ({ big_number: null, breakdown: [], items: [], total_items: 0, actions: [], source, fallbackAnswer: text });
const yearOf = (input: Record<string, unknown>, ctx: OraContext) => {
  const y = Number(input.year);
  return Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : ctx.year;
};

// ── 4. family_summary ─────────────────────────────────────────────────────
export const familySummary: OraTool = {
  name: "family_summary",
  module: "families",
  description:
    "Gjen një familje sipas mbiemrit ose emrit të prindit/fëmijës dhe kthen fëmijët (aktivë), totalin, paguar dhe borxhin e familjes (të gjitha kategoritë) — si profili i familjes. " +
    "Nëse përputhen disa familje, kthen kandidatët për sqarim. Shumat vetëm me qasje te Nxënësit.",
  input_schema: {
    type: "object",
    properties: {
      family_query: { type: "string", description: "Mbiemri i familjes ose emri i prindit/fëmijës." },
      year: { type: "integer", description: "Viti akademik fillestar; 0 = viti aktual." },
    },
    required: ["family_query", "year"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    const q = norm(String(input.family_query ?? "")).replace(/^familja\s+/, "").replace(/^familjes\s+/, "");
    const year = yearOf(input, ctx);
    if (q.length < 2) return { ok: false, error: "Shkruaj mbiemrin e familjes.", forModel: { error: "mbiemri mungon" } };
    const fams = await prisma.family.findMany({
      where: { organizationId: ctx.orgId },
      select: {
        id: true, displayName: true,
        students: { select: { id: true, firstName: true, lastName: true, status: true, fatherName: true, motherName: true, class: { select: { name: true } } } },
      },
    });
    const tokens = q.split(" ");
    const tokMatch = (w: string, t: string) => w === t || (t.length >= 4 && w.startsWith(t)) || (w.length >= 4 && t.startsWith(w) && t.length - w.length <= 3);
    const scored = fams.map(f => {
      const label = familyLabel(f.displayName, f.students.map(s => s.lastName));
      const texts = [label, ...f.students.flatMap(s => [`${s.firstName} ${s.lastName}`, s.fatherName ?? "", s.motherName ?? ""])].map(norm);
      const exactLabel = norm(label) === q;
      const hit = tokens.every(t => texts.some(x => x.split(" ").some(w => tokMatch(w, t))));
      // Mbiemri i familjes ka përparësi para emrave të prindërve/fëmijëve
      const labelHit = tokens.every(t => norm(label).split(" ").some(w => tokMatch(w, t)));
      return { f, label, exactLabel, hit, labelHit };
    }).filter(x => x.hit && x.f.students.some(s => s.status === "ACTIVE"));
    let matches = scored.some(x => x.exactLabel) ? scored.filter(x => x.exactLabel) : scored.some(x => x.labelHit) ? scored.filter(x => x.labelHit) : scored;
    if (!matches.length) return { ok: true, forModel: { found: false }, display: empty(`Asnjë familje me "${input.family_query}".`, "Kërkim familjesh") };
    if (matches.length > 1) {
      matches = matches.slice(0, 8);
      const question = `Cilën familje e keni parasysh: ${matches.map(m => `${m.label} (${m.f.students.filter(s => s.status === "ACTIVE").map(s => s.firstName).join(", ")})`).join("; ")}?`;
      return {
        ok: true, clarification: question, forModel: { found: "multiple", candidates: matches.map(m => ({ id: m.f.id, label: m.label })) },
        display: { ...empty(question, "Kërkim familjesh"), total_items: matches.length, items: matches.map(m => ({ type: "family" as const, id: m.f.id, title: `Familja ${m.label}`, subtitle: m.f.students.filter(s => s.status === "ACTIVE").map(s => `${s.firstName} ${s.class?.name ?? ""}`.trim()).join(" · ") })) },
      };
    }
    const { f, label } = matches[0];
    const active = f.students.filter(s => s.status === "ACTIVE");
    const canMoney = ctx.hasModule("students");
    const fin: Map<number, StudentAllFinance> = canMoney ? await computeStudentAllFinance(ctx.orgId, active.map(s => s.id), year) : new Map();
    const totals = canMoney ? sumFinance(active.map(s => fin.get(s.id)!).filter(Boolean)) : null;
    const items: OraItem[] = active.map(s => {
      const c = fin.get(s.id)?.categories;
      const bal = c ? Object.values(c).reduce((a: number, x) => a + (x?.balance ?? 0), 0) : 0;
      return { type: "student", id: s.id, title: `${s.firstName} ${s.lastName}`, subtitle: s.class?.name ?? "Pa klasë", badge: canMoney ? (bal > 0.005 ? `Borxh ${formatCurrency(bal)}` : "Pa borxh") : undefined };
    });
    return {
      ok: true,
      forModel: { found: true, family: label, children: active.length, totals: totals ? { final: totals.final, paid: totals.paid, balance: totals.balance } : "pa qasje në shuma" },
      display: {
        big_number: totals ? { value: formatCurrency(totals.balance), label: `borxhi i familjes ${label}` } : { value: String(active.length), label: `fëmijë aktivë · familja ${label}` },
        breakdown: totals ? Object.entries(totals.byCategory).map(([k, v]) => ({ label: FINANCE_CATEGORY_LABELS[k as FinanceCategory], value: `paguar ${formatCurrency(v!.paid)} nga ${formatCurrency(v!.final)} · mbetja ${formatCurrency(v!.balance)}` })) : [],
        items: [{ type: "family", id: f.id, title: `Familja ${label}`, subtitle: `${active.length} fëmijë aktivë` }, ...items],
        total_items: active.length + 1,
        actions: [
          { type: "open_profile", label: "Hap profilin e familjes", params: { href: `/families/${f.id}` }, module: "families" },
          ...(active.length ? [{ type: "send_sms" as const, label: "Dërgo SMS familjes", params: { href: `/sms?students=${active.map(s => s.id).join(",")}&family=1` }, module: "sms" }] : []),
        ],
        source: `Familja ${label} · fëmijët aktivë · të gjitha kategoritë · Viti ${yearLabel(year)}`,
        fallbackAnswer: totals
          ? `Familja ${label} ka ${active.length} fëmijë aktivë: total ${formatCurrency(totals.final)}, paguar ${formatCurrency(totals.paid)}, borxh ${formatCurrency(totals.balance)}.`
          : `Familja ${label} ka ${active.length} fëmijë aktivë.`,
      },
    };
  },
};

// ── 5. debtors ────────────────────────────────────────────────────────────
export const debtors: OraTool = {
  name: "debtors",
  module: "students",
  description:
    "Nxënësit me borxh (si karta 'Me borxh' te Nxënësit), sipas kategorisë dhe klasës/nivelit, të renditur sipas shumës së mbetur (më e madhja e para), plus shuma totale e borxhit. " +
    "Përdore për 'borxhet më të mëdha', 'debitorët', 'kush ka më shumë borxh'.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", enum: ["shkollimi", "ushqimi", "uniforma", "eshkollori", "librat_anglishte"], description: "Kategoria; parazgjedhje 'shkollimi'." },
      class_name: { type: "string", description: "Klasa, p.sh. '2A'; '' = të gjitha." },
      level: { type: "string", enum: ["", "1", "2", "3", "4", "5", "6", "7", "8", "9"], description: "Niveli 1–9; '' = të gjitha." },
      limit: { type: "integer", description: "1–50; parazgjedhje 10." },
    },
    required: ["category", "class_name", "level", "limit"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    // E njëjta listë "me borxh" si list_students / faqja Nxënësit, e gjitha (pa kufi)
    const r = await studentsMatching({ payment_status: "me_borxh", category: input.category, class_name: input.class_name, level: input.level, active: "aktiv", year: 0 }, ctx);
    if ("error" in r) return { ok: false, error: r.error, forModel: { error: r.error } };
    const limit = Math.min(50, Math.max(1, Number(input.limit) || 10));
    const sorted = [...r.rows].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, "sq"));
    const totalDebt = Math.round(sorted.reduce((a, x) => a + x.balance, 0) * 100) / 100;
    return {
      ok: true,
      forModel: { total_students: sorted.length, total_debt: totalDebt, top: sorted.slice(0, limit).map(x => ({ id: x.id, name: x.name, class: x.className, balance: x.balance })) },
      display: {
        big_number: { value: formatCurrency(totalDebt), label: `borxh gjithsej · ${sorted.length} nxënës` },
        breakdown: [], items: sorted.slice(0, limit).map(r.toItem), total_items: sorted.length, actions: r.actions,
        source: r.source + " · renditur sipas borxhit",
        fallbackAnswer: `${sorted.length} nxënës kanë borxh gjithsej ${formatCurrency(totalDebt)}.`,
      },
    };
  },
};

// ── 6. payments_summary ───────────────────────────────────────────────────
const CAT_NAMES: Record<string, string> = { shkollimi: "Shkollimi", ushqimi: "Ushqimi", uniforma: "Uniforma", eshkollori: "Eshkollori" };
const PERIOD_LABEL: Record<string, string> = { sot: "sot", dje: "dje", kete_jave: "këtë javë", javen_e_kaluar: "javën e kaluar", kete_muaj: "këtë muaj", muajin_e_kaluar: "muajin e kaluar", kete_vit: "këtë vit akademik" };
function periodRange(p: string, ctx: OraContext): [Date, Date] {
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 86400000;
  const monday = new Date(d0.getTime() - ((d0.getDay() + 6) % 7) * day);
  switch (p) {
    case "dje": return [new Date(d0.getTime() - day), d0];
    case "kete_jave": return [monday, new Date(d0.getTime() + day)];
    case "javen_e_kaluar": return [new Date(monday.getTime() - 7 * day), monday];
    case "kete_muaj": return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(d0.getTime() + day)];
    case "muajin_e_kaluar": return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
    case "kete_vit": return [new Date(ctx.year, 8, 1), new Date(d0.getTime() + day)];
    default: return [d0, new Date(d0.getTime() + day)];
  }
}
export const paymentsSummary: OraTool = {
  name: "payments_summary",
  module: "payments",
  description:
    "Numri dhe shuma e pagesave për një periudhë (sot, dje, këtë javë, javën e kaluar, këtë muaj, muajin e kaluar, këtë vit), sipas kategorisë. " +
    "KUJDES: sistemi ruan për çdo këst vetëm datën e pagesës së fundit, ndaj llogaritet sipas asaj date (si 'Pagesat e fundit' te Paneli).",
  input_schema: {
    type: "object",
    properties: {
      period: { type: "string", enum: Object.keys(PERIOD_LABEL), description: "Periudha." },
      category: { type: "string", enum: ["te_gjitha", ...Object.keys(CAT_NAMES)], description: "Kategoria; 'te_gjitha' kur s'përmendet." },
    },
    required: ["period", "category"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    const period = PERIOD_LABEL[String(input.period)] ? String(input.period) : "sot";
    const cat = String(input.category ?? "te_gjitha");
    const [from, to] = periodRange(period, ctx);
    const rows = await prisma.payment.findMany({
      where: {
        organizationId: ctx.orgId, paidAmount: { gt: 0 }, paidDate: { gte: from, lt: to },
        ...(CAT_NAMES[cat] ? { category: { name: CAT_NAMES[cat] } } : {}),
      },
      select: { paidAmount: true, category: { select: { name: true } } },
    });
    const sum = Math.round(rows.reduce((a, p) => a + p.paidAmount, 0) * 100) / 100;
    const byCat = new Map<string, { n: number; sum: number }>();
    for (const p of rows) { const c = byCat.get(p.category.name) ?? { n: 0, sum: 0 }; c.n++; c.sum += p.paidAmount; byCat.set(p.category.name, c); }
    const label = `${PERIOD_LABEL[period]}${CAT_NAMES[cat] ? ` · ${CAT_NAMES[cat]}` : ""}`;
    return {
      ok: true,
      forModel: { period: PERIOD_LABEL[period], count: rows.length, sum, by_category: [...byCat.entries()].map(([k, v]) => ({ category: k, count: v.n, sum: Math.round(v.sum * 100) / 100 })) },
      display: {
        big_number: { value: String(rows.length), label: `pagesa ${label}` },
        breakdown: [{ label: "Shuma", value: formatCurrency(sum) }, ...[...byCat.entries()].map(([k, v]) => ({ label: k, value: `${v.n} · ${formatCurrency(v.sum)}` }))],
        items: [], total_items: rows.length,
        actions: [{ type: "open_list", label: "Hap Pagesat", params: { href: "/payments" }, module: "payments" }],
        source: `Pagesat ${label} · sipas datës së pagesës së fundit të këstit`,
        fallbackAnswer: `${rows.length} pagesa ${PERIOD_LABEL[period]}, gjithsej ${formatCurrency(sum)}.`,
      },
    };
  },
};

// ── 7. class_overview ─────────────────────────────────────────────────────
export const classOverview: OraTool = {
  name: "class_overview",
  module: "classes",
  description:
    "Pasqyra e një klase: mësuesi kujdestar, nxënës aktivë / kapaciteti, vende të lira dhe sa nxënës kanë borxh (si te faqja Klasat). Përdore për 'sa vende të lira ka 1A', 'kush është mësuesi i 3B'.",
  input_schema: {
    type: "object",
    properties: { class_name: { type: "string", description: "Klasa, p.sh. '1A'." } },
    required: ["class_name"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    const want = norm(String(input.class_name ?? "")).replace(/klasa|klase/g, "").replace(/\s|-/g, "").toUpperCase();
    const classes = await prisma.class.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, name: true, teacher: true, capacity: true, active: true } });
    const c = classes.find(x => x.name.toUpperCase() === want);
    if (!c) return { ok: false, error: `Klasa "${input.class_name}" nuk ekziston. Klasat: ${classes.map(x => x.name).join(", ")}.`, forModel: null };
    // E njëjta bazë si /api/classes/overview (viti aktual): nxënësit aktivë + computeStudentFinanceRows
    const { rows } = await computeStudentFinanceRows({ organizationId: ctx.orgId, status: "ACTIVE", classId: c.id }, { year: ctx.year, yearType: "academic" });
    const cap = c.capacity ?? DEFAULT_CAPACITY;
    const free = cap - rows.length;
    const showDebt = ctx.hasModule("students");
    const debt = rows.filter(r => r.payStatus === "UNPAID" || r.payStatus === "PARTIAL").length;
    return {
      ok: true,
      forModel: { class: c.name, teacher: c.teacher, students: rows.length, capacity: cap, free_seats: free, with_debt: showDebt ? debt : "pa qasje" },
      display: {
        big_number: { value: String(Math.max(0, free)), label: `vende të lira në ${c.name}` },
        breakdown: [
          { label: "Nxënës", value: `${rows.length} / ${cap}${c.capacity == null ? " (kapacitet parazgjedhje)" : ""}` },
          { label: "Mësuesi kujdestar", value: c.teacher ?? "—" },
          ...(showDebt ? [{ label: "Me borxh", value: String(debt) }] : []),
          ...(free < 0 ? [{ label: "Mbi kapacitet", value: String(-free) }] : []),
        ],
        items: [{ type: "class", id: c.id, title: `Klasa ${c.name}`, subtitle: c.teacher ?? undefined }], total_items: 1,
        actions: [
          { type: "open_profile", label: `Hap klasën ${c.name}`, params: { href: `/classes/${c.id}` }, module: "classes" },
          { type: "open_list", label: "Nxënësit e klasës", params: { href: `/students?cl=${c.id}` }, module: "students" },
        ],
        source: `Klasa ${c.name} · nxënës aktivë · Viti ${yearLabel(ctx.year)}`,
        fallbackAnswer: `Klasa ${c.name} ka ${rows.length} nxënës nga ${cap} vende — ${Math.max(0, free)} vende të lira.`,
      },
    };
  },
};

// ── 8. staff_incomplete_data ──────────────────────────────────────────────
const STAFF_REQUIRED: { key: string; label: string; sensitive?: boolean }[] = [
  { key: "telefoni", label: "telefoni" }, { key: "nrPersonal", label: "nr. personal" }, { key: "email", label: "email-i" },
  { key: "dataLindjes", label: "datëlindja" }, { key: "adresa", label: "adresa" }, { key: "dataFillimit", label: "data e fillimit" },
  { key: "kontrata", label: "statusi i kontratës" }, { key: "nrLlogarise", label: "nr. i llogarisë", sensitive: true }, { key: "banka", label: "banka", sensitive: true },
];
export const staffIncompleteData: OraTool = {
  name: "staff_incomplete_data",
  module: "sekretaria",
  description:
    "Stafi aktiv me të dhëna të paplotësuara dhe cilat fusha mungojnë (telefoni, nr. personal, email, datëlindja, adresa, data e fillimit, statusi i kontratës, nr. llogarisë, banka). Sipas rolit: mësimdhënës, asistente, të tjerë ose të gjithë.",
  input_schema: {
    type: "object",
    properties: { role: { type: "string", enum: ["te_gjithe", "mesimdhenes", "asistente", "te_tjere"], description: "Roli i stafit." } },
    required: ["role"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    void ctx;
    const role = String(input.role ?? "te_gjithe");
    const staff = await prisma.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { emri: "asc" } });
    const inRole = staff.filter(s => role === "mesimdhenes" ? isTeacher(s) : role === "asistente" ? isAssistant(s) : role === "te_tjere" ? !isTeacher(s) && !isAssistant(s) : true);
    const rows = inRole.map(s => ({
      s, missing: STAFF_REQUIRED.filter(f => { const v = (s as Record<string, unknown>)[f.key]; return v == null || (typeof v === "string" && !v.trim()); }).map(f => f.label),
    })).filter(r => r.missing.length);
    const roleLabel = { te_gjithe: "staf", mesimdhenes: "mësimdhënës", asistente: "asistente", te_tjere: "staf tjetër" }[role] ?? "staf";
    return {
      ok: true,
      forModel: { total: rows.length, of: inRole.length, staff: rows.slice(0, 50).map(r => ({ name: r.s.emri, missing: r.missing })) },
      display: {
        big_number: { value: String(rows.length), label: `${roleLabel} me të dhëna të paplotësuara (nga ${inRole.length})` },
        breakdown: [], total_items: rows.length,
        actions: [{ type: "open_list", label: "Hap Stafin", params: { href: "/sekretaria/stafi" }, module: "sekretaria" }],
        items: rows.slice(0, 50).map(r => ({ type: "staff" as const, id: r.s.id, title: r.s.emri, subtitle: `Mungon: ${r.missing.join(", ")}`, badge: r.s.lenda ?? undefined })),
        source: `Stafi aktiv · ${roleLabel} · fushat e detyrueshme: ${STAFF_REQUIRED.map(f => f.label).join(", ")}`,
        fallbackAnswer: `${rows.length} nga ${inRole.length} ${roleLabel} kanë të dhëna të paplotësuara.`,
      },
    };
  },
};

// ── 9. requests_summary ───────────────────────────────────────────────────
const REQ_STATUS: Record<string, string> = { te_gjitha: "ALL", ne_pritje: "SUBMITTED", ne_shqyrtim: "UNDER_REVIEW", aprovuara: "APPROVED", porositur: "ORDERED", dorezuar: "DELIVERED", refuzuara: "REJECTED" };
export const requestsSummary: OraTool = {
  name: "requests_summary",
  module: "kerkesat",
  description:
    "Kërkesat e materialeve sipas statusit (në pritje, në shqyrtim, aprovuara, porositur, dorëzuar, refuzuara) dhe opsionalisht sipas mësuesit — si kartat e faqes Kërkesat.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: Object.keys(REQ_STATUS), description: "Statusi." },
      teacher_query: { type: "string", description: "Emri i mësuesit; '' = të gjithë." },
    },
    required: ["status", "teacher_query"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    const st = REQ_STATUS[String(input.status)] ?? "ALL";
    const tq = norm(String(input.teacher_query ?? ""));
    const reqs = await prisma.materialRequest.findMany({
      where: { organizationId: ctx.orgId },
      select: { id: true, status: true, priority: true, createdAt: true, teacher: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    const mine = tq ? reqs.filter(r => tq.split(" ").every(t => norm(r.teacher.name).includes(t))) : reqs;
    const byStage = REQUEST_STAGES.map(s => ({ label: s.label, count: mine.filter(r => stageOf(r.status) === s.key).length }));
    const list = st === "ALL" ? mine : mine.filter(r => stageOf(r.status) === st);
    const stLabel = REQUEST_STAGES.find(s => s.key === st)?.label.toLowerCase();
    return {
      ok: true,
      forModel: { total: list.length, by_status: byStage, teacher: tq || null },
      display: {
        big_number: { value: String(list.length), label: `kërkesa materialesh${stLabel ? ` · ${stLabel}` : ""}${tq ? ` · ${input.teacher_query}` : ""}` },
        breakdown: st === "ALL" ? byStage.map(b => ({ label: b.label, value: String(b.count) })) : [],
        items: list.slice(0, 50).map(r => ({ type: "request" as const, id: r.id, title: r.teacher.name, subtitle: `${r._count.items} artikuj · ${r.createdAt.toISOString().slice(0, 10)}`, badge: r.priority === "URGENT" ? "Urgjente" : undefined })),
        total_items: list.length,
        actions: [{ type: "open_list", label: "Hap Kërkesat", params: { href: `/materialet/kerkesat?s=${st}` }, module: "kerkesat" }],
        source: `Kërkesat e materialeve${stLabel ? ` · ${stLabel}` : ""}${tq ? ` · mësuesi: ${input.teacher_query}` : ""}`,
        fallbackAnswer: `${list.length} kërkesa materialesh${stLabel ? ` ${stLabel}` : ""}${tq ? ` nga ${input.teacher_query}` : ""}.`,
      },
    };
  },
};

// ── 10. registrations_summary ─────────────────────────────────────────────
const APP_STATUS: Record<string, { key: string; label: string }> = {
  te_gjitha: { key: "ALL", label: "" }, ne_shqyrtim: { key: "PENDING", label: "për shqyrtim" }, evidenca: { key: "EVIDENCA", label: "në evidencë" },
  pranuar: { key: "APPROVED", label: "të pranuara" }, refuzuar: { key: "REJECTED", label: "të refuzuara" },
};
export const registrationsSummary: OraTool = {
  name: "registrations_summary",
  module: "regjistrimet",
  description:
    "Aplikimet e regjistrimit sipas statusit (për shqyrtim, evidenca, pranuar, refuzuar) dhe klasës së dëshiruar (1–9) — si tabat e faqes Regjistrimet.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: Object.keys(APP_STATUS), description: "Statusi." },
      grade: { type: "integer", description: "Klasa e dëshiruar 1–9; 0 = të gjitha." },
    },
    required: ["status", "grade"], additionalProperties: false,
  },
  async run(input, ctx): Promise<ToolResult> {
    const st = APP_STATUS[String(input.status)] ?? APP_STATUS.te_gjitha;
    const grade = Number(input.grade);
    const base: Record<string, unknown> = { organizationId: ctx.orgId };
    if (grade >= 1 && grade <= 9) base.desiredGrade = grade;
    const grouped = await prisma.enrollmentApplication.groupBy({ by: ["status"], where: base, _count: { _all: true } });
    const countOf = (s: string) => grouped.find(g => g.status === s)?._count._all ?? 0;
    const all = grouped.reduce((a, g) => a + g._count._all, 0);
    const n = st.key === "ALL" ? all : countOf(st.key);
    const list = await prisma.enrollmentApplication.findMany({
      where: { ...base, ...(st.key !== "ALL" ? { status: st.key } : {}) },
      select: { id: true, firstName: true, lastName: true, desiredGrade: true, status: true, submittedAt: true },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    const gradeTxt = grade >= 1 && grade <= 9 ? ` për klasën ${grade}` : "";
    return {
      ok: true,
      forModel: { total: n, by_status: { per_shqyrtim: countOf("PENDING"), evidenca: countOf("EVIDENCA"), pranuar: countOf("APPROVED"), refuzuar: countOf("REJECTED"), te_gjitha: all } },
      display: {
        big_number: { value: String(n), label: `aplikime regjistrimi${st.label ? ` ${st.label}` : ""}${gradeTxt}` },
        breakdown: st.key === "ALL" ? [{ label: "Për shqyrtim", value: String(countOf("PENDING")) }, { label: "Evidenca", value: String(countOf("EVIDENCA")) }, { label: "Pranuar", value: String(countOf("APPROVED")) }, { label: "Refuzuar", value: String(countOf("REJECTED")) }] : [],
        items: list.map(a => ({ type: "application" as const, id: a.id, title: `${a.firstName} ${a.lastName}`, subtitle: a.desiredGrade ? `Klasa ${a.desiredGrade}` : undefined })),
        total_items: n,
        actions: [{ type: "open_list", label: "Hap Regjistrimet", params: { href: `/regjistrimet?tab=${st.key === "ALL" ? "ALL" : st.key}${grade >= 1 && grade <= 9 ? `&grade=${grade}` : ""}` }, module: "regjistrimet" }],
        source: `Regjistrimet${st.label ? ` · ${st.label}` : " · të gjitha (përfshirë draft)"}${gradeTxt}`,
        fallbackAnswer: `${n} aplikime regjistrimi${st.label ? ` ${st.label}` : ""}${gradeTxt}.`,
      },
    };
  },
};
