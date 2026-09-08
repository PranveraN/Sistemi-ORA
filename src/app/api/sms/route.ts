import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SECRETARY") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "200");

  const messages = await prisma.smsMessage.findMany({
    where: { organizationId: orgId },
    include: { sentBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(messages);
}
