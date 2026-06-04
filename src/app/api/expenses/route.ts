import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = parseInt(searchParams.get("categoryId") || "0");
  const type  = searchParams.get("type")  || "EXPENSE";
  const month = parseInt(searchParams.get("month") || "0");
  const year  = parseInt(searchParams.get("year")  || "0");

  const expenses = await prisma.expense.findMany({
    where: {
      categoryId,
      type,
      ...(month > 0 ? { month } : {}),
      ...(year  > 0 ? { year  } : {}),
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const expense = await prisma.expense.create({
    data: {
      categoryId:  parseInt(body.categoryId),
      type:        body.type,
      amount:      parseFloat(body.amount),
      description: body.description  || null,
      recipient:   body.recipient    || null,
      method:      body.method       || null,
      reference:   body.reference    || null,
      date:        new Date(body.date),
      month:       body.month        || null,
      year:        body.year         || null,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
