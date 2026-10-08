import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { moduleForPath, firstAllowedPath, isConfigurableRole } from "@/lib/modules";

// Prefikse API që i përkasin EKSKLUZIVISHT një moduli të vetëm (pa u ndarë me
// module të tjera) — "Lejet e Moduleve" deri tani fshihnin vetëm lidhjen e
// menysë, por vetë API-të s'i kontrollonin fare (çdo i kyçur mund t'i thërriste
// direkt, pavarësisht lejeve). Këtu zbatohet REALISHT, njësoj si për faqet.
// QËLLIMISHT s'përfshihen API "të përbashkëta" mes disa moduleve (p.sh.
// /api/students, /api/category-payments, /api/payments, /api/expenses,
// /api/categories) — një rregull i tillë do të bllokonte thirrje legjitime
// nga module të tjera të lejuara.
const API_MODULE_PREFIXES: { prefix: string; moduleKey: string }[] = [
  { prefix: "/api/investime",          moduleKey: "investime" },
  { prefix: "/api/arka",               moduleKey: "arka" },
  { prefix: "/api/auditimi",           moduleKey: "auditimi" },
  { prefix: "/api/timi-invest",        moduleKey: "investime" },
  { prefix: "/api/arkiva",             moduleKey: "arkiva" },
  { prefix: "/api/shpenzime",          moduleKey: "shpenzime" },
  { prefix: "/api/librat",             moduleKey: "librat" },
  { prefix: "/api/uniforms",           moduleKey: "uniforma" },
  { prefix: "/api/materials",          moduleKey: "materiale" },
  { prefix: "/api/material-categories", moduleKey: "materiale" },
  { prefix: "/api/material-orders",    moduleKey: "materiale" },
  { prefix: "/api/material-requests",  moduleKey: "kerkesat" },
  // Stafi (paga, llogari bankare) — përdoret vetëm nga faqet e Sekretarisë
  { prefix: "/api/staff",              moduleKey: "sekretaria" },
  { prefix: "/api/sekretaria",         moduleKey: "sekretaria" },
  { prefix: "/api/eshkollori",         moduleKey: "eshkollori" },
];

// Fshirjet e rekordeve financiare kërkojnë arsye (header-i X-Audit-Reason, i
// dërguar nga askDeleteReason/reasonHeaders te src/lib/auditReason.ts). Arsyeja
// ruhet te gjurma e auditimit (FinAuditLog) nga shtresa te src/lib/prisma.ts.
const FINANCIAL_DELETE_PATTERNS: RegExp[] = [
  /^\/api\/payments\/\d+$/,
  /^\/api\/category-payments\/old-debt\/\d+$/,
  /^\/api\/expenses\/\d+$/,
  /^\/api\/hyrat\/\d+$/,
  /^\/api\/investime\/\d+$/,
  /^\/api\/invoices\/\d+$/,
  /^\/api\/librat\/handovers\/\d+$/,
  /^\/api\/payment-handovers\/\d+$/,
  /^\/api\/shpenzime\/\d+$/,
  /^\/api\/shpenzime\/\d+\/pagesat\/\d+$/,
  /^\/api\/students\/\d+$/,
  /^\/api\/timi-invest\/invoices\/\d+$/,
  /^\/api\/uniforms\/handovers\/\d+$/,
  /^\/api\/uniforms\/sales\/\d+$/,
];

function hasDeleteReason(header: string | null): boolean {
  if (!header) return false;
  let r = header;
  try { r = decodeURIComponent(header); } catch { /* lihet siç është */ }
  return r.trim().length >= 3;
}

// API-të e lejuara për rolin TEACHER (shih TeacherRequestsClient.tsx).
// Kërkesat e veta: çdo metodë (vetë route-t e kufizojnë mësuesin te kërkesat
// e TIJ dhe i ndalojnë veprimet e menaxhimit). Katalogët: vetëm lexim.
function isTeacherApiAllowed(pathname: string, method: string): boolean {
  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (under("/api/material-requests")) return true;
  if (under("/api/public") || under("/api/teacher-auth")) return true;
  const readOnly = method === "GET" || method === "HEAD";
  if (readOnly && ["/api/materials", "/api/material-categories", "/api/subjects", "/api/classes"].some(p => pathname === p)) return true;
  return false;
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string })?.role;
  const allowedModules = (req.auth?.user as { allowedModules?: string[] })?.allowedModules ?? [];

  // Roli "Admin" ka VETËM të drejtë shikimi — asnjë veprim shkrimi (krijim/
  // ndryshim/fshirje), pavarësisht modulit. Zbatohet këtu, në një vend të
  // vetëm, mbi çdo kërkesë API — jo e përsëritur në çdo skedar route.ts.
  if (nextUrl.pathname.startsWith("/api")) {
    // /api/auth/* (kyçja/daljja e vetë NextAuth-it) përjashtohet gjithmonë —
    // mekanizëm autentikimi, jo veprim mbi të dhëna, s'duhet bllokuar kurrë.
    const isAuthApi = nextUrl.pathname.startsWith("/api/auth");
    if (!isAuthApi && isLoggedIn && role === "ADMIN" && req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      return NextResponse.json({ error: "Roli 'Admin' ka vetëm qasje shikimi — ky veprim nuk lejohet." }, { status: 403 });
    }

    // Roli "Auditor": vetëm lexim kudo — shkruan vetëm te Auditimi (statusi i
    // gjetjeve, komentet, "Ekzekuto tani"). Faza 4 e auditimit.
    if (!isAuthApi && isLoggedIn && role === "AUDITOR" && req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS"
      && !nextUrl.pathname.startsWith("/api/auditimi")) {
      return NextResponse.json({ error: "Roli 'Auditor' ka vetëm qasje shikimi — ky veprim nuk lejohet." }, { status: 403 });
    }

    if (isLoggedIn && req.method === "DELETE" && FINANCIAL_DELETE_PATTERNS.some(re => re.test(nextUrl.pathname))
      && !hasDeleteReason(req.headers.get("x-audit-reason"))) {
      return NextResponse.json({ error: "Shkruani arsyen e fshirjes (të paktën 3 shenja)." }, { status: 400 });
    }

    // Mësimdhënësit (portal i veçantë /kerkesa-material) — VETËM API-të që
    // përdor vetë portali. Më parë faqet ishin të bllokuara, por API-të jo:
    // shumica e route.ts kontrollojnë vetëm "a je i kyçur", ndaj një mësues i
    // aprovuar mund të lexonte/ndryshonte nxënës, pagesa, stafin etj. direkt.
    if (!isAuthApi && isLoggedIn && role === "TEACHER" && !isTeacherApiAllowed(nextUrl.pathname, req.method)) {
      return NextResponse.json({ error: "Nuk ke leje për këtë veprim." }, { status: 403 });
    }

    if (!isAuthApi && isLoggedIn && role && isConfigurableRole(role)) {
      const match = API_MODULE_PREFIXES.find(m => nextUrl.pathname.startsWith(m.prefix));
      if (match && !allowedModules.includes(match.moduleKey)) {
        return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  const isLoginPage = nextUrl.pathname === "/login";
  const isSuperAdminPage = nextUrl.pathname.startsWith("/superadmin");
  const isTeacherArea = nextUrl.pathname.startsWith("/kerkesa-material");
  const isTeacherPublicPage = nextUrl.pathname === "/kerkesa-material/regjistrohu";
  const isEnrollmentPublicPage = nextUrl.pathname === "/apliko";

  if (isLoginPage && isLoggedIn) {
    if (role === "SUPERADMIN") return NextResponse.redirect(new URL("/superadmin", nextUrl));
    if (role === "TEACHER") return NextResponse.redirect(new URL("/kerkesa-material", nextUrl));
    if (role && isConfigurableRole(role)) {
      return NextResponse.redirect(new URL(firstAllowedPath(allowedModules) ?? "/dashboard", nextUrl));
    }
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (!isLoginPage && !isTeacherPublicPage && !isEnrollmentPublicPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isSuperAdminPage && role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Mësimdhënësit shohin VETËM zonën e tyre — jo asnjë faqe tjetër të stafit.
  // (Portal krejt i veçantë, jashtë sistemit të përgjithshëm të moduleve.)
  if (isLoggedIn && role === "TEACHER" && !isTeacherArea) {
    return NextResponse.redirect(new URL("/kerkesa-material", nextUrl));
  }

  // Rolet e konfigurueshme (Admin, Financë, Sekretari, Pedagogia) — qasja në
  // faqe drejtohet nga lejet e moduleve (të konfigurueshme te /superadmin →
  // "Lejet e Moduleve"), jo më nga lista e ngurtë e kodit.
  if (isLoggedIn && role && isConfigurableRole(role)) {
    const mod = moduleForPath(nextUrl.pathname);
    if (mod && !allowedModules.includes(mod.key)) {
      const fallback = firstAllowedPath(allowedModules);
      if (fallback && fallback !== nextUrl.pathname) return NextResponse.redirect(new URL(fallback, nextUrl));
      // Asnjë modul i lejuar (rast i pazakontë, konfigurim bosh) — s'ka ku ta
      // ridrejtojmë pa hyrë në lak; lëmë faqen ta trajtojë (do të shfaqet
      // bosh/e mbrojtur nga vetë API-t, që gjithsesi kontrollojnë sesionin).
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
