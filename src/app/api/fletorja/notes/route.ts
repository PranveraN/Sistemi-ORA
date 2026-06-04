import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";
  const search   = searchParams.get("search") || "";
  const color    = searchParams.get("color") || "";

  const where: Record<string, unknown> = { archived };
  if (search) where.OR = [
    { title: { contains: search } },
    { content: { contains: search } },
    { tags: { contains: search } },
  ];
  if (color) where.color = color;

  const notes = await prisma.adminNote.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const note = await prisma.adminNote.create({
    data: {
      title:   body.title   || null,
      content: body.content || "",
      color:   body.color   || "slate",
      tags:    body.tags    || null,
      pinned:  body.pinned  ?? false,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
