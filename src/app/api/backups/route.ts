import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listBackups, createManualBackup } from "@/lib/backup";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund t'i menaxhojnë backup-et" }, { status: 403 });
  }

  return NextResponse.json({ backups: listBackups() });
}

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund t'i menaxhojnë backup-et" }, { status: 403 });
  }

  try {
    const filename = await createManualBackup();
    return NextResponse.json({ filename }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
