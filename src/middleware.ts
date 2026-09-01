import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string })?.role;

  const isLoginPage = nextUrl.pathname === "/login";
  const isSuperAdminPage = nextUrl.pathname.startsWith("/superadmin");
  const isTeacherArea = nextUrl.pathname.startsWith("/kerkesa-material");
  const isTeacherPublicPage = nextUrl.pathname === "/kerkesa-material/regjistrohu";

  if (isLoginPage && isLoggedIn) {
    if (role === "SUPERADMIN") return NextResponse.redirect(new URL("/superadmin", nextUrl));
    if (role === "TEACHER") return NextResponse.redirect(new URL("/kerkesa-material", nextUrl));
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (!isLoginPage && !isTeacherPublicPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isSuperAdminPage && role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Mësimdhënësit shohin VETËM zonën e tyre — jo asnjë faqe tjetër të stafit.
  if (isLoggedIn && role === "TEACHER" && !isTeacherArea) {
    return NextResponse.redirect(new URL("/kerkesa-material", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
