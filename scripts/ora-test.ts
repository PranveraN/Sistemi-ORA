// Testet e saktësisë së Orës — npm run test:ora  (shto --live për testet me modelin e vërtetë)
import { runOraTests } from "../src/ora/testSuite";
import { prisma } from "../src/lib/prisma";

(async () => {
  const live = process.argv.includes("--live");
  const report = await runOraTests({
    live,
    onProgress: c => console.log(`${c.skipped ? "–" : c.pass ? "✓" : "✗"} ${c.name}${c.detail ? `  [${c.detail}]` : ""}`),
  });
  console.log(`\n${report.passed} kaluan · ${report.failed} dështuan · ${report.skipped} u anashkaluan · ${Math.round(report.ms / 1000)} s${report.live ? " · me modelin e vërtetë" : ""}`);
  await prisma.$disconnect();
  process.exit(report.failed ? 1 : 0);
})();
