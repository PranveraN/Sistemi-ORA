import { NextRequest, NextResponse } from "next/server";
import { guardClosedDay } from "@/lib/audit/routeGuard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAccess() {
  const session = await auth();
  if (!session) return null;
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "SUPERADMIN", "FINANCE"].includes(role ?? "")) return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await prisma.investim.findUnique({ where: { id: parseInt(id) } });
  if (!row) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });
  return NextResponse.json(row);
}

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { tipi, data, pershkrim, kategoria, vlera, metoda, dokumenti, regjistruarNga } = body;

  await prisma.investim.update({
    where: { id: parseInt(id) },
    data: {
      tipi,
      data: data ? new Date(data) : new Date(),
      pershkrim,
      kategoria: kategoria || null,
      vlera: parseFloat(String(vlera)),
      metoda: metoda || "CASH",
      dokumenti: dokumenti || null,
      regjistruarNga: regjistruarNga || null,
    },
  });

  return NextResponse.json({ ok: true });
}

async function DELETE_handler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.investim.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}

// Refuzimi për ditë të mbyllur të arkës → 409 me mesazh (Faza 2 e auditimit)
export const PUT = guardClosedDay(PUT_handler);
export const DELETE = guardClosedDay(DELETE_handler);
