import { Suspense } from "react";
import MaterialsModule from "@/components/material-requests/module/MaterialsModule";

// "Materialet": /materialet/{kerkesat|porosite|mesimdhenesit|analitika}/{id}
// Vetëm administrata (middleware: moduli "kerkesat"; API-të kontrollojnë rolin).
export default function MaterialetPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Duke ngarkuar...</p>}>
      <MaterialsModule />
    </Suspense>
  );
}
