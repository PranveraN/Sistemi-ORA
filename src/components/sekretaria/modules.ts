import { FileSignature, FilePen, BadgeCheck, BookOpen, ClipboardCheck, Users, GraduationCap } from "lucide-react";

// Modulet e Sekretarisë me ngjyrat e tyre aktuale (si te faqja e mëparshme).
export const SEK_MODULES = {
  kontratatNxenesve:     { href: "/sekretaria/kontratat-nxenesve",     icon: FileSignature,  label: "Kontratat e Nxënësve",      desc: "Menaxho dhe gjenero kontratat e nxënësve",          color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-900/30",     ring: "hover:ring-blue-300 dark:hover:ring-blue-700" },
  kontratatMesimdhenesve: { href: "/sekretaria/kontratat-mesimdhnesve", icon: FilePen,        label: "Kontratat e Mësimdhënësve", desc: "Menaxho kontratat e stafit mësimdhënës",            color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/30", ring: "hover:ring-violet-300 dark:hover:ring-violet-700" },
  vertetime:             { href: "/sekretaria/vertetime",              icon: BadgeCheck,     label: "Vërtetimet",                desc: "Gjenero vërtetime për nxënës dhe staf",             color: "text-green-600 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-900/30",   ring: "hover:ring-green-300 dark:hover:ring-green-700" },
  fletkalimet:           { href: "/sekretaria/fletkalimet",            icon: ClipboardCheck, label: "Fletëkalimet",              desc: "Lësho dhe gjurmo fletëkalimet e nxënësve",          color: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-900/30",     ring: "hover:ring-rose-300 dark:hover:ring-rose-700" },
  libriAme:              { href: "/sekretaria/libri-ame",              icon: BookOpen,       label: "Libri Amë",                 desc: "Regjistri kryesor i nxënësve dhe të dhënave",       color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/30",   ring: "hover:ring-amber-300 dark:hover:ring-amber-700" },
  stafi:                 { href: "/sekretaria/stafi",                  icon: Users,          label: "Stafi",                     desc: "Menaxho të dhënat e stafit të shkollës",            color: "text-teal-600 dark:text-teal-400",     bg: "bg-teal-50 dark:bg-teal-900/30",     ring: "hover:ring-teal-300 dark:hover:ring-teal-700" },
  vitiShkollor:          { href: "/sekretaria/viti-shkollor",          icon: GraduationCap,  label: "Mbyllja e Vitit",           desc: "Kalo nxënësit në klasën e re dhe hap vitin e ardhshëm", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", ring: "hover:ring-indigo-300 dark:hover:ring-indigo-700" },
} as const;

export type SekModule = (typeof SEK_MODULES)[keyof typeof SEK_MODULES];
