import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { computeStudentFinanceRows } from "@/lib/studentFinanceRows";
import { sessionHasModule } from "@/lib/specialCarePermissions";

// Lista e faqes "Nxënësit" — filtrimi, renditja dhe faqosja bëhen KËTU (në
// server), jo në shfletues: shfletuesi merr vetëm një faqe rreshtash.
//   1. Kufizimet bazë (Aktivë, klasa, kërkimi) → në databazë.
//   2. Pagesa/borxhi/statusi i shkollimit për vitin e zgjedhur → llogaritet
//      këtu për rreshtat bazë (statusi varet nga këstet + lidhja Timi Invest,
//      prandaj s'shprehet dot si SQL i thjeshtë).
//   3. Filtrat e tabelës, renditja (shqip: ë, ç) dhe faqosja → këtu.
// VETËM PAMJE — s'ndryshon asnjë të dhënë dhe s'prek pagesat/raportet.
// E veçantë nga /api/students (i përdorur nga 10+ faqe), që ato të mos preken.

const collator = new Intl.Collator("sq", { sensitivity: "base", numeric: true });

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Të dhëna financiare — vetëm për rolet me modulin "Nxënësit" (p.sh. jo Pedagogia)
  if (!sessionHasModule(session, "students")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const yearType = (sp.get("yearType") || "academic") as YearType;
  const status = sp.get("status") || "";
  const classId = sp.get("classId") || "";
  const search = (sp.get("search") || "").trim();
  const card = sp.get("card") || "all";               // all | paid | debt | ti
  const fStudent = (sp.get("fStudent") || "").trim().toLowerCase();
  const fParent = (sp.get("fParent") || "").trim().toLowerCase();
  const fPay = sp.get("fPay") || "";                  // none | partial | full | discount
  const fDebt = sp.get("fDebt") || "";                // UNPAID | PARTIAL | PAID | TIMI_INVEST
  const fContract = sp.get("fContract") || "";        // yes | no
  const fHist = sp.get("fHist") || "";                // lloji i ngjarjes së fundit
  const sort = sp.get("sort") || "name";              // name | parent | pay | debt | history
  const dir = sp.get("dir") === "desc" ? -1 : 1;
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "20")));
  const exportAll = sp.get("export") === "1";
  const idsParam = sp.get("ids");

  /* ── 1. Kufizimet bazë në databazë (si /api/students) ── */
  const where: Record<string, unknown> = { organizationId: orgId };
  if (search) {
    const parts = search.split(/\s+/);
    const base = [
      { firstName: { contains: search } }, { lastName: { contains: search } },
      { personalNumber: { contains: search } }, { parentPhone: { contains: search } },
      { fatherPhone: { contains: search } }, { motherPhone: { contains: search } },
      { parentName: { contains: search } },
    ];
    where.OR = parts.length >= 2
      ? [...base,
          { AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] },
          { AND: [{ firstName: { contains: parts[parts.length - 1] } }, { lastName: { contains: parts.slice(0, -1).join(" ") } }] }]
      : base;
  }
  if (status) where.status = status;
  if (classId) where.classId = parseInt(classId);
  if (idsParam) where.id = { in: idsParam.split(",").map(Number).filter(n => n > 0) };

  const { rows, defaultAmount } = await computeStudentFinanceRows(where, { year, yearType, exportAll });

  /* ── Kartat: numrat sipas kufizimeve bazë (viti/Aktivë/klasa/kërkimi) ── */
  const counts = {
    all: rows.length,
    paid: rows.filter(r => r.payStatus === "PAID").length,
    debt: rows.filter(r => r.payStatus === "UNPAID" || r.payStatus === "PARTIAL").length,
    ti: rows.filter(r => r.payStatus === "TIMI_INVEST").length,
  };

  /* ── 3. Filtrat e tabelës ── */
  let filtered = rows;
  if (card === "paid") filtered = filtered.filter(r => r.payStatus === "PAID");
  else if (card === "debt") filtered = filtered.filter(r => r.payStatus === "UNPAID" || r.payStatus === "PARTIAL");
  else if (card === "ti") filtered = filtered.filter(r => r.payStatus === "TIMI_INVEST");

  if (fStudent) filtered = filtered.filter(r =>
    `${r.firstName} ${r.lastName} ${r.lastName} ${r.firstName} ${r.className ?? ""} ${r.personalNumber ?? ""}`.toLowerCase().includes(fStudent));
  if (fParent) filtered = filtered.filter(r =>
    `${r.parentName ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(fParent));
  if (fPay === "none") filtered = filtered.filter(r => r.paid <= 0.005);
  else if (fPay === "partial") filtered = filtered.filter(r => r.paid > 0.005 && r.balance > 0.005);
  else if (fPay === "full") filtered = filtered.filter(r => r.paid > 0.005 && r.balance <= 0.005);
  else if (fPay === "discount") filtered = filtered.filter(r => r.discountPct > 0);
  if (fDebt) filtered = filtered.filter(r => r.payStatus === fDebt);
  if (fContract === "yes") filtered = filtered.filter(r => r.hasContract);
  else if (fContract === "no") filtered = filtered.filter(r => !r.hasContract);
  if (fHist === "NONE") filtered = filtered.filter(r => !r.lastEvent);
  else if (fHist) filtered = filtered.filter(r => r.lastEvent?.type === fHist);

  /* ── Renditja (shqip) ── */
  const byName = (a: typeof rows[0], b: typeof rows[0]) =>
    collator.compare(a.firstName, b.firstName) || collator.compare(a.lastName, b.lastName);
  const cmp: Record<string, (a: typeof rows[0], b: typeof rows[0]) => number> = {
    name: byName,
    parent: (a, b) => collator.compare(a.parentName ?? "", b.parentName ?? ""),
    pay: (a, b) => (a.finalPrice ? a.paid / a.finalPrice : 0) - (b.finalPrice ? b.paid / b.finalPrice : 0),
    debt: (a, b) => a.balance - b.balance,
    history: (a, b) => (a.lastEvent?.at ?? "").localeCompare(b.lastEvent?.at ?? ""),
  };
  const f = cmp[sort] ?? byName;
  filtered = [...filtered].sort((a, b) => f(a, b) * dir || byName(a, b));

  const total = filtered.length;
  const pageRows = exportAll ? filtered : filtered.slice((page - 1) * limit, page * limit);
  const historyTypes = Array.from(new Set(rows.map(r => r.lastEvent?.type).filter((t): t is string => !!t))).sort();

  return NextResponse.json({
    rows: pageRows,
    total,
    page,
    limit,
    counts,
    defaultAmount,
    historyTypes,
  });
}
