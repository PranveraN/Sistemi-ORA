"use client";

import TimiInvestModal from "@/components/TimiInvestModal";

// Faza 1: lista ekzistuese e popup-it (shtim / ndryshim / fazat / profaturë e shpejtë), e ngulitur.
// Kartela e re e fëmijës me historik dhe storno vjen në Fazën 2.
export default function TimiFemijetPage() {
  return <TimiInvestModal embedded initialView="list" views={["list"]} onClose={() => {}} />;
}
