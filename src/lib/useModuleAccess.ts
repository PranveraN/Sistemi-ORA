"use client";

import { useSession } from "next-auth/react";
import { moduleForPath } from "@/lib/modules";

// Lejet reale të moduleve (njësoj si Sidebar.tsx dhe middleware.ts) — për
// lidhje/butona BRENDA faqeve që çojnë në një modul tjetër. Pa këtë, p.sh.
// Sekretaria shihte "Regjistro Pagesë" te Dashboard, por klikimi ridrejtohej
// heshtazi nga middleware përsëri te Dashboard → butoni dukej "i vdekur".
// Gjatë ngarkimit të sesionit kthen `true` (middleware mbetet mbrojtja reale),
// që butonat të mos "dridhen" për rolet që i kanë lejet.
export function useModuleAccess() {
  const { data: session, status } = useSession();
  const allowed = (session?.user as { allowedModules?: string[] } | undefined)?.allowedModules;

  function canAccess(href: string): boolean {
    if (status !== "authenticated" || !Array.isArray(allowed)) return true;
    const mod = moduleForPath(href.split(/[?#]/)[0]);
    return mod ? allowed.includes(mod.key) : true;
  }

  return { canAccess };
}
