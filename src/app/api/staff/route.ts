import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const tipi = searchParams.get("tipi") || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { emri: { contains: search } },
      { lenda: { contains: search } },
      { kodi: { contains: search } },
    ];
  }
  if (tipi) where.tipi = tipi;

  const staff = await prisma.staff.findMany({
    where,
    orderBy: [{ tipi: "asc" }, { emri: "asc" }],
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const member = await prisma.staff.create({
    data: {
      emri:        body.emri        || "",
      telefoni:    body.telefoni    || null,
      lenda:       body.lenda       || null,
      nrPersonal:  body.nrPersonal  || null,
      nrLlogarise: body.nrLlogarise || null,
      banka:       body.banka       || null,
      totalBruto:  body.totalBruto  != null ? parseFloat(body.totalBruto) : null,
      kontrata:    body.kontrata    || null,
      kodi:        body.kodi        || null,
      tipi:        body.tipi        || null,
      status:      body.status      || "ACTIVE",
    },
  });
  return NextResponse.json(member, { status: 201 });
}
