import { redirect } from "next/navigation";

export default async function TeacherFolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/materialet/mesimdhenesit/${parseInt(id) || ""}`);
}
