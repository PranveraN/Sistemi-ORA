import KujdestareKerkesa from "@/components/lirimi/KujdestareKerkesa";

export const metadata = { title: "Kërkesë lirimi — Akademia Ora" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KujdestareKerkesa id={parseInt(id)} />;
}
