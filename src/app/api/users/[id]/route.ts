import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const before = await prisma.user.findUnique({ where: { id: parseInt(id) } });
  if (!before) return NextResponse.json({ error: "Përdoruesi s'u gjet" }, { status: 404 });

  // Menaxhimi i STAFIT (Admin/Financë/Sekretari/Super Admin) mbetet
  // ekskluzivisht te Super Admin. Sekretaria mund të veprojë VETËM mbi
  // llogari mësimdhënësish (aprovim/editim/fshirje rutinë) — jo t'i
  // ndryshojë rolin drejt diçkaje tjetër.
  const sessionRole = (session.user as { role?: string })?.role;
  const isSuperAdmin = sessionRole === "SUPERADMIN";
  const isSecretaryManagingTeacher = sessionRole === "SECRETARY" && before.role === "TEACHER";
  if (!isSuperAdmin && !isSecretaryManagingTeacher) {
    return NextResponse.json({ error: "S'keni të drejtë të modifikoni këtë përdorues" }, { status: 403 });
  }

  const body = await req.json();
  if (body.role !== undefined && body.role !== before.role && !isSuperAdmin) {
    return NextResponse.json({ error: "Vetëm Super Admin mund të ndryshojë rolin e një përdoruesi" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (body.name   !== undefined) data.name   = body.name;
  if (body.email  !== undefined) data.email  = body.email;
  if (body.role   !== undefined) data.role   = body.role;
  if (body.active !== undefined) data.active = body.active;
  if (body.password) {
    if (body.password.length < 8 || !/[a-zA-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
      return NextResponse.json({ error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere, me shkronja dhe numra" }, { status: 400 });
    }
    data.password = await bcrypt.hash(body.password, 10);
  }

  const user = await prisma.user.update({
    where: { id: parseInt(id) },
    data,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  const justApproved = !before.active && user.active;
  await logAction(session, "UPDATE", "User", user.id,
    `${justApproved ? "Aprovoi" : "Ndryshoi"} përdoruesin ${user.name} (${user.email}) — rol ${user.role}`);

  // Njofton mësimdhënësin vetëm kur llogaria kalon nga joaktive në aktive
  // (aprovimi) — jo në çdo modifikim tjetër (emër, email, fjalëkalim, etj.).
  if (before && !before.active && user.active && user.role === "TEACHER") {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? ""}/login`;
    await sendEmail(
      user.email,
      "Regjistrimi juaj u aprovua",
      `<div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">Regjistrimi juaj u aprovua</h2>
        <p style="color: #64748b; margin-top: 0;">Akademia Ora</p>
        <p>Regjistrimi juaj u aprovua, kyçuni këtu me të dhënat me të cilat jeni regjistruar për të porositur materiale.</p>
        <p><a href="${loginUrl}" style="color:#7c3aed;font-weight:600;">${loginUrl}</a></p>
      </div>`
    );
  }

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
  if (!user) return NextResponse.json({ error: "Përdoruesi s'u gjet" }, { status: 404 });

  // Njësoj si te PATCH: Sekretaria mund të fshijë VETËM mësimdhënës, jo staf.
  const sessionRole = (session.user as { role?: string })?.role;
  const isSuperAdmin = sessionRole === "SUPERADMIN";
  const isSecretaryManagingTeacher = sessionRole === "SECRETARY" && user.role === "TEACHER";
  if (!isSuperAdmin && !isSecretaryManagingTeacher) {
    return NextResponse.json({ error: "S'keni të drejtë ta fshini këtë përdorues" }, { status: 403 });
  }

  // Mbrojtje: meqë tani VETËM Super Admin mund të menaxhojë staf, s'duhet
  // fshirë i fundit — përndryshe askush s'do të mund të menaxhonte më
  // përdorues fare (mbyllje e vetvetishme, e pakthyeshme pa qasje në server).
  const superAdminCount = await prisma.user.count({ where: { role: "SUPERADMIN", active: true } });
  if (user.role === "SUPERADMIN" && superAdminCount <= 1) {
    return NextResponse.json({ error: "Nuk mund të fshish Super Adminin e fundit" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: parseInt(id) } });
  } catch (err) {
    // P2003 = shkelje e kufizimit të çelësit të huaj — p.sh. mësimdhënësi ka
    // kërkesa materiale (MaterialRequest) të lidhura, që s'kanë onDelete
    // cascade/setNull të qëllimshëm (historiku i kërkesave duhet ruajtur).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json(
        { error: "Ky përdorues ka të dhëna të lidhura (p.sh. kërkesa materiale) — nuk mund të fshihet. Çaktivizojeni (Statusi) në vend të fshirjes." },
        { status: 400 }
      );
    }
    throw err;
  }

  await logAction(session, "DELETE", "User", user.id, `Fshiu përdoruesin ${user.name} (${user.email}) — rol ${user.role}`);

  return NextResponse.json({ success: true });
}
