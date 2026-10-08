import { NextRequest, NextResponse } from "next/server";
import { guardClosedDay } from "@/lib/audit/routeGuard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expensePeriodWhere, expensePeriodWhereByDate } from "@/lib/expensePeriod";
import type { YearType } from "@/lib/academicYear";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = parseInt(searchParams.get("categoryId") || "0");
  const type  = searchParams.get("type")  || "EXPENSE";
  const month = parseInt(searchParams.get("month") || "0");
  const year  = parseInt(searchParams.get("year")  || "0");
  const yearType = (searchParams.get("yearType") || "calendar") as YearType;

  // Shkollimi: rreshtat pa muaj vendosen sipas datës reale (që s'numërohen në dy vite)
  const cat = categoryId ? await prisma.paymentCategory.findUnique({ where: { id: categoryId }, select: { name: true } }) : null;
  const period = cat?.name === "Shkollimi" ? expensePeriodWhereByDate : expensePeriodWhere;
  const expenses = await prisma.expense.findMany({
    where: {
      categoryId,
      type,
      ...period(month, year, yearType),
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

async function POST_handler(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    const date = parseDate(body.date);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: `Datë e pavlefshme: "${body.date}"` }, { status: 400 });
    }

    // `month`/`year` rrjedhin GJITHMONË nga vetë data e futur (jo nga filtri i
    // faqes në atë moment) — përndryshe një shpenzim/dorëzim i regjistruar kur
    // faqja ishte në "Të gjitha muajt" (month=0) ruhej me muaj bosh/NULL (`0 ||
    // null` e trajton 0-n si "false"), dhe një rresht i tillë s'i plotësonte
    // KURRË kushtet e `expensePeriodWhere` nën asnjë filtër "Akademik" — bëhej
    // i padukshëm përgjithmonë (defekt i raportuar: "shpenzimet u zhdukën").
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
        month: date.getMonth() + 1,
        year:  date.getFullYear(),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Refuzimi për ditë të mbyllur të arkës → 409 me mesazh (Faza 2 e auditimit)
export const POST = guardClosedDay(POST_handler);
