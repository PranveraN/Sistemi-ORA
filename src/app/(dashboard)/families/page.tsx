import { Suspense } from "react";
import FamiliesView from "@/components/families/FamiliesView";

// Familjet — lista + përmbledhje (pa familje të zgjedhur)
export default function FamiliesPage() {
  return (
    <Suspense>
      <FamiliesView selectedId={null} />
    </Suspense>
  );
}
