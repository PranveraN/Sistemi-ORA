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

function parseDate(raw: string | undefined | null): Date {
  if (!raw) return new Date();
  const s = String(raw).trim();

  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);

  // DD/MM/YYYY ose DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (mdy) return new Date(`${mdy[3].length === 2 ? "20" + mdy[3] : mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`);

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    const date = parseDate(body.date);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: `Datë e pavlefshme: "${body.date}"` }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        categoryId:  parseInt(body.categoryId),
        type:        body.type,
        amount:      parseFloat(body.amount),
        description: body.description || null,
        recipient:   body.recipient   || null,
        method:      body.method      || null,
        reference:   body.reference   || null,
        date,
        month: body.month || null,
        year:  body.year  || null,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
