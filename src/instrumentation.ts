export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backup");
    startBackupScheduler();

    // Auditimi financiar: triggers e SQLite (Prisma s'i menaxhon — krijohen këtu
    // në çdo nisje, pas `prisma db push` të entrypoint-it). Një gabim këtu s'e
    // ndalon aplikacionin, por shënohet qartë në log.
    try {
      const { prisma } = await import("@/lib/prisma");
      const { ensureAuditTriggers } = await import("@/lib/audit/triggers");
      const r = await ensureAuditTriggers(prisma);
      console.log(`[auditimi] triggers: ${r.created} të krijuara, ${r.unchanged} të pandryshuara${r.skipped.length ? `, mungojnë tabelat: ${r.skipped.join(", ")}` : ""}`);
    } catch (err) {
      console.error("[auditimi] GABIM — triggers s'u krijuan, gjurma e auditimit NUK po regjistrohet:", err);
    }

    // Motori i rregullave: ekzekutimi i natës (02:00), dhe në nisje nëse një natë humbi
    try {
      const { prisma } = await import("@/lib/prisma");
      const { startAuditScheduler } = await import("@/lib/audit/scheduler");
      startAuditScheduler(prisma);
    } catch (err) {
      console.error("[auditimi] planifikuesi s'u nis:", err);
    }
  }
}
