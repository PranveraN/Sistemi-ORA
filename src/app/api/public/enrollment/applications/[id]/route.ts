import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildApplicationData, findApplicationByToken } from "@/lib/enrollmentApplication";

// Rimarrja e një drafti (kur prindi rikthehet te /apliko dhe localStorage ka
// {id, resumeToken}) — kërkon token-in si query param, sepse është GET.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");

  const app = await findApplicationByToken(parseInt(id), token);
  if (!app) return NextResponse.json({ message: "Aplikimi nuk u gjet." }, { status: 403 });

  const documents = await prisma.applicationDocument.findMany({
    where: { applicationId: app.id },
    select: { id: true, docType: true, originalName: true, contentType: true, size: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ...app, documents });
}

// Autosave — vetëm ndërsa aplikimi është ende DRAFT (pas dorëzimit s'lejohet
// më editim përmes këtij endpointi).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const app = await findApplicationByToken(parseInt(id), body.resumeToken);
  if (!app) return NextResponse.json({ message: "Aplikimi nuk u gjet." }, { status: 403 });
  if (app.status !== "DRAFT") return NextResponse.json({ message: "Aplikimi tashmë është dorëzuar dhe s'mund të ndryshohet." }, { status: 409 });

  const data = buildApplicationData(body);
  await prisma.enrollmentApplication.update({ where: { id: app.id }, data });

  return NextResponse.json({ ok: true });
}
