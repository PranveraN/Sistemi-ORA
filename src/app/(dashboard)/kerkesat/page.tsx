"use client";

import { Suspense } from "react";
import Header from "@/components/layout/Header";
import RequestsBoard from "@/components/material-requests/admin/RequestsBoard";

// "Materialet" — kërkesat e mësuesve: kartat sipas rrjedhës, lista, detajet dhe
// lista "Për t'u porositur". Shih src/components/material-requests/admin/.
export default function KerkesatPage() {
  return (
    <>
      <Header title="Materialet" />
      <Suspense fallback={<p className="p-6 text-sm text-slate-400">Duke ngarkuar...</p>}>
        <RequestsBoard />
      </Suspense>
    </>
  );
}
