"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Ndërprerësi i pamjeve të "Materialet" — zëvendëson butonat e veçantë
// Mësimdhënësit/Porositë/Analitika; çdo pamje mbetet faqja e saj ekzistuese.
const VIEWS = [
  { href: "/kerkesat", label: "Kërkesat", match: (p: string) => p === "/kerkesat" || p.startsWith("/kerkesat/historiku") },
  { href: "/materiale/porosite", label: "Porositë", match: (p: string) => p.startsWith("/materiale/porosite") },
  { href: "/kerkesat/mesimdhenesit", label: "Mësimdhënësit", match: (p: string) => p.startsWith("/kerkesat/mesimdhenesit") },
  { href: "/kerkesat/analitika", label: "Analitika", match: (p: string) => p.startsWith("/kerkesat/analitika") },
];

export default function MaterialsViewSwitch() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Pamjet e materialeve" className="inline-flex flex-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-0.5">
      {VIEWS.map(v => {
        const active = v.match(pathname);
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-white dark:bg-slate-700 text-primary-700 dark:text-primary-300 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
