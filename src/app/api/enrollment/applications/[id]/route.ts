import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await prisma.enrollmentApplication.findUnique({
    where: { id: parseInt(id) },
    include: {
      class: { select: { name: true, level: true } },
      documents: { select: { id: true, docType: true, originalName: true, contentType: true, size: true } },
    },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(app);
}
