"use client";

import TimiInvestModal from "@/components/TimiInvestModal";

// Faza 1: skedat ekzistuese "Faturat" dhe "Krijo Profaturë" të popup-it, të ngulitura.
export default function TimiProfaturatPage() {
  return <TimiInvestModal embedded initialView="invoices" views={["invoices", "create"]} onClose={() => {}} />;
}
