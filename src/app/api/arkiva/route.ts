import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 2026-09-29: më parë s'kishte AS NJË kontroll identifikimi (çdokush mund ta
// thërriste drejtpërdrejt), dhe ndërtonte SQL me ngjitje teksti (rrezik
// injektimi). Rishkruar me auth() + query-t e sigurta të vetë Prisma-s.
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
  const type = searchParams.get("type") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "30");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { studentName: { contains: search } },
      { className: { contains: search } },
    ];
  }

  const [docs, total] = await Promise.all([
    prisma.docArchive.findMany({
      where,
      select: { id: true, type: true, studentId: true, studentName: true, className: true, generatedBy: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.docArchive.count({ where }),
  ]);

  return NextResponse.json({ docs, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, studentId, studentName, className, data, generatedBy } = body;

  if (!type || !studentName) {
    return NextResponse.json({ error: "type dhe studentName janë të detyrueshme" }, { status: 400 });
  }

  const doc = await prisma.docArchive.create({
    data: {
      type,
      studentId: studentId ? parseInt(String(studentId)) : null,
      studentName,
      className: className || null,
      data: typeof data === "string" ? data : JSON.stringify(data),
      generatedBy: generatedBy || null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
