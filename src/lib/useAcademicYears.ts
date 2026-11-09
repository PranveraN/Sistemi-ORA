"use client";

import { useEffect, useState } from "react";
import { ACADEMIC_YEARS } from "@/lib/academicYear";
import { labelStartYear } from "@/lib/schoolYears";

// Vitet shkollore për listat/filtrat e faqeve = vitet e REGJISTRUARA te Cilësimet → Vitet
// Shkollore (viti fillestar, rritës). Vitet kalendarike mbeten automatike (CALENDAR_YEARS).
// Gjatë ngarkimit, ose nëse kërkesa dështon, përdoret lista e vjetër automatike, që asnjë
// faqe të mos mbetet pa vite.
let cache: number[] | null = null;
let inflight: Promise<number[] | null> | null = null;

function load(): Promise<number[] | null> {
  inflight ??= fetch("/api/school-years")
    .then(r => (r.ok ? r.json() : null))
    .then((rows: { label: string }[] | null) => {
      const ys = (rows ?? []).map(r => labelStartYear(r.label)).filter((y): y is number => y !== null).sort((a, b) => a - b);
      if (ys.length) cache = ys;
      return cache;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

export function useAcademicYears(): readonly number[] {
  const [years, setYears] = useState<readonly number[]>(cache ?? ACADEMIC_YEARS);
  useEffect(() => {
    let alive = true;
    load().then(ys => { if (alive && ys) setYears(ys); });
    return () => { alive = false; };
  }, []);
  return years;
}

/** Pas shtimit/fshirjes së një viti te Cilësimet — që listat të rifreskohen. */
export function invalidateAcademicYears() { cache = null; }
