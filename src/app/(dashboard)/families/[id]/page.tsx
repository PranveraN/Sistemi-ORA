import { Suspense } from "react";
import FamiliesView from "@/components/families/FamiliesView";

// Familjet — profili i familjes së zgjedhur (/families/:id, i ndashëm si link)
export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <FamiliesView selectedId={parseInt(id) || null} />
    </Suspense>
  );
}
