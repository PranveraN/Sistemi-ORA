import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { deleteApplicationDir } from "@/lib/application-storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await prisma.enrollmentApplication.findUnique({
    where: { id: parseInt(id) },
    include: {
      class: { select: { name: true, level: true } },
      documents: { select: { id: true, docType: true, originalName: true, contentType: true, size: true } },
    },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(app);
}

// Fshin vetë aplikimin (+ dokumentet e bashkëngjitura, në disk dhe në DB —
// ApplicationDocument fshihet automatikisht me Cascade). NUK prek Student-in
// e krijuar nëse aplikimi ishte pranuar (createdStudentId) — janë të ndara.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const applicationId = parseInt(id);

  const app = await prisma.enrollmentApplication.findUnique({ where: { id: applicationId } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteApplicationDir(applicationId);
  await prisma.enrollmentApplication.delete({ where: { id: applicationId } });

  await logAction(session, "DELETE", "EnrollmentApplication", applicationId,
    `Fshiu aplikimin e ${app.firstName} ${app.lastName} (${app.referenceNumber ?? `#${applicationId}`})`);

  return NextResponse.json({ ok: true });
}
