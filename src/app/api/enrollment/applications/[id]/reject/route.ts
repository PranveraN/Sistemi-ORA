import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const app = await prisma.enrollmentApplication.findUnique({ where: { id: parseInt(id) } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "PENDING") return NextResponse.json({ message: "Vetëm aplikimet 'Për Shqyrtim' mund të refuzohen." }, { status: 409 });

  const updated = await prisma.enrollmentApplication.update({
    where: { id: app.id },
    data: { status: "REJECTED", reviewNote: body.reviewNote || null, reviewedAt: new Date() },
  });

  await logAction(session, "UPDATE", "EnrollmentApplication", app.id, `Refuzoi aplikimin e ${app.firstName} ${app.lastName}`);

  return NextResponse.json(updated);
}
