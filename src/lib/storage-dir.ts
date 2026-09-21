import path from "path";

// I njëjti volum/direktori si baza SQLite (DATABASE_URL="file:...") — çdo gjë
// e ruajtur këtu (foto, bashkëngjitje, dokumente) mbijeton rindërtimeve/
// rideploy-eve pikërisht si databaza, pa nevojë për një volum të veçantë.
export function getDbDir(): string {
  const url = process.env.DATABASE_URL || "file:./akademia-ora.db";
  const filePath = url.replace(/^file:/, "");
  if (path.isAbsolute(filePath)) return path.dirname(filePath);
  // Prisma zgjidh URL-të relative të SQLite-it relativisht ndaj
  // prisma/schema.prisma, jo process.cwd() — përputhemi me këtë.
  return path.dirname(path.resolve(process.cwd(), "prisma", filePath));
}
