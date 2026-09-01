import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Publike (pa login) — përdoret te faqja e regjistrimit të mësimdhënësve,
// që të zgjedhin emrin e tyre nga një listë, jo ta shkruajnë manualisht.
export async function GET() {
  const classes = await prisma.class.findMany({
    where: { organizationId: 1, teacher: { not: null } },
    select: { teacher: true },
    distinct: ["teacher"],
  });

  const names = classes
    .map(c => (c.teacher ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "sq"));

  return NextResponse.json({ teachers: names });
}
