import type { PrismaClient } from "@prisma/client";
import { runAudit, type RunTrigger } from "./engine";

// Ekzekutimi i natës (Faza 3), brenda serverit. Çdo 10 minuta kontrollohet nëse
// i takon një ekzekutim; kushtet:
//   • pas orës 02:00 (ora e Kosovës) dhe s'ka asnjë ekzekutim të nisur sot pas 02:00, ose
//   • ekzekutimi i fundit është më i vjetër se 26 orë (p.sh. serveri ishte i fikur natën).
// Kontrolli i parë bëhet menjëherë në nisje — kështu një natë e humbur ekzekutohet
// sapo serveri ndizet. Mbivendosjen e ndalon bllokimi te engine.ts.

const TZ = "Europe/Belgrade";
const HOUR = 2;
const parts = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(d).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};

/** A i takon një ekzekutim tani? (e pastër — e testueshme) */
export function isRunDue(now: Date, lastStartedAt: Date | null): boolean {
  if (!lastStartedAt) return true;
  if (now.getTime() - lastStartedAt.getTime() > 26 * 60 * 60 * 1000) return true;
  const n = parts(now), l = parts(lastStartedAt);
  if (n.hour < HOUR) return false;
  return l.day < n.day || (l.day === n.day && l.hour < HOUR);
}

let started = false;

export function startAuditScheduler(db: PrismaClient) {
  if (started) return;
  started = true;
  const tick = async (trigger: RunTrigger) => {
    try {
      const last = await db.auditRun.findFirst({ where: { trigger: { in: ["NATA", "NISJA"] } }, orderBy: { startedAt: "desc" }, select: { startedAt: true } });
      if (!isRunDue(new Date(), last?.startedAt ?? null)) return;
      const r = await runAudit(db, { trigger });
      if (!r.skipped) console.log(`[auditimi] ekzekutimi ${trigger}: ${r.findingsNew} gjetje të reja, ${r.findingsSeen} gjithsej (${r.status})`);
    } catch (e) {
      console.error("[auditimi] ekzekutimi i planifikuar dështoi:", e);
    }
  };
  // Pak pas nisjes (që serveri të ngrohet), pastaj çdo 10 minuta
  const first = setTimeout(() => tick("NISJA"), 60 * 1000);
  first.unref();
  const interval = setInterval(() => tick("NATA"), 10 * 60 * 1000);
  interval.unref();
}
