"use client";

import Header from "@/components/layout/Header";
import SekretariaHub from "@/components/sekretaria/SekretariaHub";

// Paneli i punës së Sekretarisë — gjendja e moduleve, "Për sot", dokumentet e
// fundit dhe Mbyllja e Vitit. Shih src/components/sekretaria/.
export default function SekretariaPage() {
  return (
    <>
      <Header title="Sekretaria" />
      <SekretariaHub />
    </>
  );
}
