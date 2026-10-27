import KujdestareHome from "@/components/lirimi/KujdestareHome";

export const metadata = { title: "Kujdestaria — Akademia Ora" };

export default async function Page({ searchParams }: { searchParams: Promise<{ "pa-qasje"?: string }> }) {
  const sp = await searchParams;
  return <KujdestareHome paQasje={sp["pa-qasje"] === "1"} />;
}
