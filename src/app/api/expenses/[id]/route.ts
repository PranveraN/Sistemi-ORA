import { NextRequest, NextResponse } from "next/server";
import { guardClosedDay } from "@/lib/audit/routeGuard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function PUT_handler(
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

async function DELETE_handler(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.expense.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}

// Refuzimi për ditë të mbyllur të arkës → 409 me mesazh (Faza 2 e auditimit)
export const PUT = guardClosedDay(PUT_handler);
export const DELETE = guardClosedDay(DELETE_handler);
