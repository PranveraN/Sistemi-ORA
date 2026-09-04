import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readMaterialAttachment } from "@/lib/material-attachment-storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename } = await params;
  const file = await readMaterialAttachment(filename);
  if (!file) return NextResponse.json({ error: "Skedari nuk u gjet" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=300" },
  });
}
