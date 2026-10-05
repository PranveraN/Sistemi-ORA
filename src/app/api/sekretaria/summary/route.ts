import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { getSekretariaSummary } from "@/lib/sekretariaSummary";

// Të gjithë numrat e panelit të Sekretarisë në një thirrje (cache 60 s).
// Leje: moduli "sekretaria" (si vetë modulet). Numri i nxënësve me borxh
// kthehet vetëm me modulin "students" (të dhënë financiare).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const canStudents = sessionHasModule(session, "students");
  const summary = await getSekretariaSummary(orgId, { includeDebts: canStudents });
  const role = (session.user as { role?: string }).role;

  return NextResponse.json(
    {
      ...summary,
      yearClosing: { ...summary.yearClosing, debtCount: canStudents ? summary.yearClosing.debtCount : null },
      permissions: {
        canWrite: role !== "ADMIN", // Admini: vetëm shikim (i zbatuar edhe nga middleware)
        classes: sessionHasModule(session, "classes"),
        arkiva: sessionHasModule(session, "arkiva"),
        students: canStudents,
      },
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
