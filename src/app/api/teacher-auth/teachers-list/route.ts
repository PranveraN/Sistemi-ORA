import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Publike (pa login) — përdoret te faqja e regjistrimit të mësimdhënësve,
// që të zgjedhin emrin e tyre nga një listë, jo ta shkruajnë manualisht.
// Lista vjen nga TABELA E STAFIT (gjithë stafi aktiv — Primar, Sekondar,
// Menaxhment), jo nga Class.teacher — ai fusheu mbush vetëm mësuesit e
// caktuar si titullarë klase, ndaj linte jashtë shumicën e stafit.
export async function GET() {
  const staff = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    select: { emri: true },
    orderBy: { emri: "asc" },
  });

  const names = [...new Set(staff.map(s => s.emri.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "sq"));

  return NextResponse.json({ teachers: names });
}
