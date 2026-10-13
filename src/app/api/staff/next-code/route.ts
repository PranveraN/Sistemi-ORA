import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { nextStaffCode } from "@/lib/staffCode";

// Kodi i radhës i stafit (EM...) — për butonin "Gjenero" te formulari i stafit.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  return NextResponse.json({ kodi: await nextStaffCode(prisma) });
}
