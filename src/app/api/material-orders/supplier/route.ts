import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadSupplierInfo, ORDER_ADMIN_ROLES } from "@/lib/supplierOrder";

// Të dhënat e FurnitoriOra (nga Cilësimet) për panelin "Për t'u porositur" — vetëm administrata.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { role?: string; name?: string | null; email?: string | null };
  if (!ORDER_ADMIN_ROLES.has(user.role ?? "")) {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const info = await loadSupplierInfo();
  return NextResponse.json({ ...info, adminName: user.name ?? "", adminEmail: user.email ?? "" });
}
