import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const handovers = await prisma.uniHandover.findMany({ orderBy: { handoverAt: "desc" } });
  return NextResponse.json(handovers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const handover = await prisma.uniHandover.create({
    data: {
      amount:      parseFloat(body.amount),
      description: body.description || null,
      recipient:   body.recipient   || null,
      method:      body.method      || "CASH",
      reference:   body.reference   || null,
      handoverAt:  body.handoverAt ? new Date(body.handoverAt) : new Date(),
    },
  });
  return NextResponse.json(handover, { status: 201 });
}
