import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Listë aplikimesh (Regjistrimet) — vetëm për stafin e kyçur.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "PENDING";

  // Pa "select" — kthen të gjitha fushat skalare (jo vetëm ato që shfaqen te
  // tabela), që eksporti Excel (shih EnrollmentApplicationExport) të ketë
  // gjithçka pa një thirrje/endpoint të dytë.
  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      organizationId: orgId,
      ...(status !== "ALL" ? { status } : {}),
    },
    include: {
      class: { select: { name: true } }, // caktuar vetëm pas pranimit — shih approve/route.ts
      documents: { select: { docType: true } },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(applications);
}
