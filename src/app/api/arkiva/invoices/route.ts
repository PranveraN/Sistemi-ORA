import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAccess() {
  const session = await auth();
  if (!session) return null;
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "SUPERADMIN", "FINANCE", "SECRETARY"].includes(role ?? "")) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");

  const where: Record<string, unknown> = search
    ? {
        OR: [
          { number: { contains: search } },
          { student: { firstName: { contains: search } } },
          { student: { lastName: { contains: search } } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      select: {
        id: true, number: true, type: true, status: true, total: true, createdAt: true,
        student: { select: { firstName: true, lastName: true, class: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  const invoices = rows.map(r => ({
    id: r.id, number: r.number, type: r.type, status: r.status, total: r.total, createdAt: r.createdAt,
    studentName: `${r.student.firstName} ${r.student.lastName}`,
    className: r.student.class?.name ?? null,
  }));

  return NextResponse.json({ invoices, total, page, limit });
}
