import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { auth } from "@/lib/auth";
import { getBackupFilePath } from "@/lib/backup";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund t'i shkarkojnë backup-et" }, { status: 403 });
  }

  const { filename } = await params;
  const filePath = getBackupFilePath(filename);
  if (!filePath) return NextResponse.json({ error: "Backup-i nuk u gjet" }, { status: 404 });

  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
