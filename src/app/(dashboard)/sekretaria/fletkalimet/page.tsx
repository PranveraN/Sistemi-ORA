"use client";
import Header from "@/components/layout/Header";
import { ClipboardCheck } from "lucide-react";
export default function Page() {
  return (<><Header title="Fletëkalimet" /><div className="p-6 flex flex-col items-center justify-center py-24 text-slate-400"><ClipboardCheck className="w-10 h-10 opacity-20 mb-3" /><p className="text-sm">Në zhvillim e sipër...</p></div></>);
}
