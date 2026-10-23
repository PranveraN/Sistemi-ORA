import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readTimiDoc } from "@/lib/timi-doc-storage";

// Hapja e dokumentit të një transferi TIMI (vetëm për stafin financiar)
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes((session.user as { role?: string }).role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const d = await readTimiDoc((await params).file);
  if (!d) return NextResponse.json({ error: "Dokumenti s'u gjet." }, { status: 404 });
  return new NextResponse(new Uint8Array(d.buffer), { headers: { "Content-Type": d.contentType, "Cache-Control": "private, max-age=3600" } });
}
