import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const date = new Date(body.date);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: `Datë e pavlefshme: "${body.date}"` }, { status: 400 });
  }

  // month/year rrjedhin nga vetë data (shih komentin te POST /api/expenses) —
  // rillogariten edhe këtu që nëse dikush e ndryshon datën gjatë modifikimit,
  // rreshti të mos "ngecë" me muajin/vitin e vjetër.
  const expense = await prisma.expense.update({
    where: { id: parseInt(id) },
    data: {
      amount:      parseFloat(body.amount),
      description: body.description || null,
      recipient:   body.recipient   || null,
      method:      body.method      || null,
      reference:   body.reference   || null,
      date,
      month: date.getMonth() + 1,
      year:  date.getFullYear(),
    },
  });

  return NextResponse.json(expense);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.expense.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
