import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Linku publik i dokumentit për prindërit — krijohet herën e parë dhe mbetet i njëjtë
// (edhe kur zëvendësohet skedari). Kthen rrugën relative; klienti shton domenin.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; organizationId?: number };
  if (!["ADMIN", "SUPERADMIN", "SECRETARY"].includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.schoolDocument.findFirst({ where: { id: parseInt(id), organizationId: u.organizationId ?? 1 } });
  if (!doc) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  const token = doc.publicToken ?? randomBytes(12).toString("base64url");
  if (!doc.publicToken) await prisma.schoolDocument.update({ where: { id: doc.id }, data: { publicToken: token } });
  return NextResponse.json({ path: `/api/public/dok/${token}` });
}
