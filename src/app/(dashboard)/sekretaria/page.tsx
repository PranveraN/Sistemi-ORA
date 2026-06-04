"use client";

import Header from "@/components/layout/Header";
import Link from "next/link";
import {
  FileSignature, FilePen, BadgeCheck,
  BookOpen, ClipboardCheck, ArrowUpRight, Users,
} from "lucide-react";

const cards = [
  {
    href: "/sekretaria/kontratat-nxenesve",
    icon: FileSignature,
    label: "Kontratat e Nxënësve",
    desc: "Menaxho dhe gjenero kontratat e nxënësve",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    ring: "hover:ring-blue-300 dark:hover:ring-blue-700",
  },
  {
    href: "/sekretaria/kontratat-mesimdhënesve",
    icon: FilePen,
    label: "Kontratat e Mësimdhënësve",
    desc: "Menaxho kontratat e stafit mësimdhënës",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30",
    ring: "hover:ring-violet-300 dark:hover:ring-violet-700",
  },
  {
    href: "/sekretaria/vertetime",
    icon: BadgeCheck,
    label: "Vërtetime",
    desc: "Gjenero vërtetime për nxënës dhe prindër",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/30",
    ring: "hover:ring-green-300 dark:hover:ring-green-700",
  },
  {
    href: "/sekretaria/libri-ame",
    icon: BookOpen,
    label: "Libri Amë",
    desc: "Regjistri kryesor i nxënësve dhe të dhënave",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
    ring: "hover:ring-amber-300 dark:hover:ring-amber-700",
  },
  {
    href: "/sekretaria/fletkalimet",
    icon: ClipboardCheck,
    label: "Fletëkalimet",
    desc: "Lësho dhe gjurmo fletëkalimet e nxënësve",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/30",
    ring: "hover:ring-rose-300 dark:hover:ring-rose-700",
  },
  {
    href: "/sekretaria/stafi",
    icon: Users,
    label: "Stafi",
    desc: "Menaxho të dhënat e stafit të shkollës",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/30",
    ring: "hover:ring-teal-300 dark:hover:ring-teal-700",
  },
];

export default function SekretariaPage() {
  return (
    <>
      <Header title="Sekretaria" />
      <div className="p-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`card p-5 flex items-start gap-4 hover:ring-2 ${c.ring} transition-all group`}
            >
              <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-slate-800 dark:text-white text-sm`}>{c.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{c.desc}</p>
              </div>
              <ArrowUpRight className={`w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5 group-hover:${c.color} transition-colors`} />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
