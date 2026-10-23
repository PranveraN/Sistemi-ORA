import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveTimiDoc, MAX_TIMI_DOC_SIZE } from "@/lib/timi-doc-storage";

// Ngarkimi i dokumentit të një transferi TIMI (multipart "file") → { dokumenti, dokumentiEmri }
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes((session.user as { role?: string }).role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Zgjidhni një skedar." }, { status: 400 });
  if (file.size > MAX_TIMI_DOC_SIZE) return NextResponse.json({ error: "Skedari është më i madh se 15 MB." }, { status: 400 });
  try {
    const name = await saveTimiDoc(Buffer.from(await file.arrayBuffer()), file.type, file.name);
    return NextResponse.json({ dokumenti: name, dokumentiEmri: file.name.slice(0, 200) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
