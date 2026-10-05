import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runOraTests } from "@/ora/testSuite";

// "Ekzekuto testet e saktësisë" nga faqja e administrimit (vetëm Super Admin).
// Të njëjtat teste si `npm run test:ora` — vetëm lexim, pa AI.
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Vetëm Super Admini." }, { status: 403 });
  }
  const orgId: number = (session!.user as { organizationId?: number }).organizationId ?? 1;
  const report = await runOraTests({ live: false, orgId });
  return NextResponse.json(report);
}
