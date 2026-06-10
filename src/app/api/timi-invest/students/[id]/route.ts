import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const now = new Date().toISOString();
  const sid = parseInt(id);
  if (body.firstName    !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET firstName=?, updatedAt=? WHERE id=?`,    body.firstName, now, sid);
  if (body.lastName     !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET lastName=?, updatedAt=? WHERE id=?`,     body.lastName,  now, sid);
  if (body.parentName   !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET parentName=?, updatedAt=? WHERE id=?`,   body.parentName, now, sid);
  if (body.parentPhone  !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET parentPhone=?, updatedAt=? WHERE id=?`,  body.parentPhone, now, sid);
  if (body.regularPrice !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET regularPrice=?, updatedAt=? WHERE id=?`, parseFloat(body.regularPrice), now, sid);
  if (body.discountPct  !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET discountPct=?, updatedAt=? WHERE id=?`,  parseFloat(body.discountPct), now, sid);
  if (body.manualDiscAmt !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET manualDiscAmt=?, updatedAt=? WHERE id=?`, parseFloat(body.manualDiscAmt), now, sid);
  if (body.notes        !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET notes=?, updatedAt=? WHERE id=?`,        body.notes, now, sid);
  if (body.active       !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET active=?, updatedAt=? WHERE id=?`,       body.active ? 1 : 0, now, sid);
  if ("studentId"       in body)       await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET studentId=?, updatedAt=? WHERE id=?`,    body.studentId ? parseInt(body.studentId) : null, now, sid);

  const [student] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM TimiInvestStudent WHERE id=?`, sid);
  return NextResponse.json(student);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.timiInvestStudent.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
