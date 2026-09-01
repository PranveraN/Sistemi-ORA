import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const familyReceipt = await prisma.familyReceipt.findUnique({
    where: { id: parseInt(id) },
    include: {
      payments: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } } },
          category: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      },
      uniSales: { orderBy: { id: "asc" } },
      bookSales: { orderBy: { id: "asc" } },
    },
  });

  if (!familyReceipt) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  return NextResponse.json(familyReceipt);
}
