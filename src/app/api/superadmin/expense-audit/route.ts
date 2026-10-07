import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runExpenseAudit } from "@/lib/expenseAudit";

// Auditimi i shpenzimeve (Faza 1) — vetëm Super Admin, vetëm lexim.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  }
  return NextResponse.json(await runExpenseAudit());
}
