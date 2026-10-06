import { redirect } from "next/navigation";

// Kërkesat u bashkuan te "Materialet" — lidhjet e vjetra (/kerkesat?id=…&s=…) ridrejtohen.
export default async function KerkesatPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.s && sp.s !== "ALL") qs.set("s", sp.s);
  if (sp.q) qs.set("q", sp.q);
  if (sp.t) qs.set("t", sp.t);
  const id = parseInt(sp.id ?? "") || null;
  redirect(`/materialet/kerkesat${id ? `/${id}` : ""}${qs.size ? `?${qs}` : ""}`);
}
