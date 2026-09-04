import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveMaterialAttachment } from "@/lib/material-attachment-storage";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "TEACHER") {
    return NextResponse.json({ error: "Vetëm mësimdhënësit mund të bashkëngjisin skedarë" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Skedari mungon" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Skedari s'duhet të kalojë 8MB" }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = await saveMaterialAttachment(buffer, file.type);
    return NextResponse.json({ path: filename, originalName: file.name });
  } catch {
    return NextResponse.json({ error: "Vetëm foto (JPEG/PNG/WebP) ose PDF lejohen" }, { status: 400 });
  }
}
