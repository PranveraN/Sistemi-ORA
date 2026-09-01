import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const { id } = await params;
  const requestId = parseInt(id);
  const userId = Number((session.user as { id?: string }).id);

  const body = await req.json();
  const status = String(body.status ?? "");
  const reviewNote = body.reviewNote ? String(body.reviewNote).trim() : null;

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Status i pavlefshëm" }, { status: 400 });
  }

  const updated = await prisma.materialRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewNote,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
    include: { teacher: { select: { name: true, email: true } } },
  });

  return NextResponse.json(updated);
}
