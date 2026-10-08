import { NextResponse } from "next/server";
import { asClosedDayError } from "./closedDay";

/**
 * Mbështjell një handler API: refuzimi për ditë të mbyllur të arkës
 * (ClosedDayError, nga shtresa te src/lib/prisma.ts) kthehet si 409 me mesazh
 * të qartë — jo si "gabim 500" pa shpjegim. Çdo gabim tjetër kalon i pandryshuar.
 */
export function guardClosedDay<A extends unknown[], R extends Response>(handler: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (e) {
      const cd = asClosedDayError(e);
      if (cd) return NextResponse.json({ error: cd.message, code: cd.code, day: cd.day, lockDay: cd.lockDay }, { status: 409 });
      throw e;
    }
  };
}
