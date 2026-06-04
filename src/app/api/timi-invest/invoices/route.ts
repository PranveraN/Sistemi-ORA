import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.timiInvestInvoice.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const date = body.date ? new Date(body.date) : new Date();
  const month = date.getMonth() + 1;
  const year  = date.getFullYear();

  const last = await prisma.timiInvestInvoice.findFirst({
    where: { month, year },
    orderBy: { seq: "desc" },
  });
  const seq    = last ? last.seq + 1 : 1;
  const number = `SHM${String(seq).padStart(2, "0")}/${String(month).padStart(2, "0")}-${year}`;

  const totalAmount = parseFloat(body.totalAmount) || 0;
  const timiDiscPct = parseFloat(body.timiDiscPct) || 5;
  const timiDiscAmt = Math.round(totalAmount * timiDiscPct) / 100;
  const finalAmount = Math.round((totalAmount - timiDiscAmt) * 100) / 100;

  const invoice = await prisma.timiInvestInvoice.create({
    data: {
      number,
      seq,
      month,
      year,
      parentName:  body.parentName || "",
      date,
      items:       JSON.stringify(body.items || []),
      totalAmount,
      timiDiscPct,
      timiDiscAmt,
      finalAmount,
      notes:       body.notes      || null,
      schoolYear:  body.schoolYear || null,
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
