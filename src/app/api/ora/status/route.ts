import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { oraAccess } from "@/ora/access";
import { EXAMPLE_QUESTIONS } from "@/ora/intent";

// A e sheh përdoruesi fushën "Pyet Orën"? (roli + Ora aktive). Vetëm lexim.
export async function GET() {
  const access = await oraAccess(await auth());
  return NextResponse.json(
    { available: access.ok, examples: access.ok ? EXAMPLE_QUESTIONS : [] },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
