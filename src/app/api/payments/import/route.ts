import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface ImportPaymentRow {
  personalNumber?: string;
  firstName?: string;
  lastName?: string;
  amount: number;
  discount?: number;
  discountType?: string;
  scholarship?: number;
  finalAmount: number;
  paidAmount?: number;
  method?: string;
  dueDate?: string;
  paidDate?: string | null;
  description?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { rows, categoryId, month, year } = body as {
    rows: ImportPaymentRow[];
    categoryId: number;
    month?: number;
    year: number;
  };

  if (!rows?.length || !categoryId || !year) {
    return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });
  }

  // Load all students for matching
  const allStudents = await prisma.student.findMany({
    select: { id: true, firstName: true, lastName: true, personalNumber: true },
  });

  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      // Match student
      let student = null;

      const pn = String(row.personalNumber || "").replace(/\s/g, "").trim();
      if (pn) {
        student = allStudents.find(s =>
          (s.personalNumber ?? "").replace(/\s/g, "") === pn
        );
      }

      if (!student && row.firstName && row.lastName) {
        const fn = row.firstName.trim().toLowerCase();
        const ln = row.lastName.trim().toLowerCase();
        student = allStudents.find(
          s => s.firstName.toLowerCase() === fn && s.lastName.toLowerCase() === ln
        );
      }

      if (!student) {
        results.skipped++;
        results.errors.push(
          `Nuk u gjet: ${row.firstName || ""} ${row.lastName || ""} (${row.personalNumber || "—"})`
        );
        continue;
      }

      const discount    = row.discount    ?? 0;
      const scholarship = row.scholarship ?? 0;
      const paidAmount  = row.paidAmount  ?? 0;
      const finalAmount = row.finalAmount ?? Math.max(0, row.amount - discount - scholarship);
      const balance     = Math.max(0, finalAmount - paidAmount);

      const now = new Date();
      const dueDate = row.dueDate
        ? parseDateStr(row.dueDate)
        : new Date(year, (month ?? 1) - 1, 10);

      const paidDate = paidAmount > 0
        ? (row.paidDate ? parseDateStr(row.paidDate) : now)
        : null;

      const status =
        paidAmount >= finalAmount ? "PAID"
        : paidAmount > 0         ? "PARTIAL"
        : dueDate < now          ? "OVERDUE"
        : "PENDING";

      // Check if payment already exists
      const existing = await prisma.payment.findFirst({
        where: {
          studentId:  student.id,
          categoryId,
          ...(month ? { month, year } : { year }),
        },
      });

      const data = {
        studentId:    student.id,
        categoryId,
        amount:       row.amount,
        discount,
        discountType: row.discountType || "fixed",
        scholarship,
        finalAmount,
        paidAmount,
        balance,
        method:       row.method   || null,
        dueDate,
        paidDate,
        status,
        month:        month ?? null,
        year,
        description:  row.description || null,
      };

      if (existing) {
        await prisma.payment.update({ where: { id: existing.id }, data });
        results.updated++;
      } else {
        await prisma.payment.create({ data });
        results.created++;
      }
    } catch (err) {
      results.errors.push(`Gabim: ${row.firstName} ${row.lastName} — ${String(err)}`);
    }
  }

  return NextResponse.json(results);
}

// I RËNDËSISHËM: "." dhe "/" duhet trajtuar IDENTIKISHT (DD.MM.YYYY / DD/MM/YYYY) —
// përpara, vetëm "/" njihej si ditë-mujë-vit; një datë me pika (p.sh. nga një
// qelizë Excel e konvertuar në tekst nga faqja e importit) binte te
// `new Date(s)`, të cilën motori i JS-it e lexon si MM.DD.YYYY (amerikanisht),
// duke e KTHYER në heshtje ditën me muajin (02.09.2026 → 9 Shkurt, jo 2 Shtator).
function parseDateStr(raw: string): Date {
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return new Date(`${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}
