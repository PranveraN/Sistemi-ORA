// Evidenca e regjistrimit — vlerësimi pedagogjik + pyetësori shëndetësor/
// logjistik. Shkalla e notimit (RATING) është fikse, sipas formularit të
// pedagogisë; kategoritë/pikat vetë janë të konfigurueshme (EvidencaCategory/
// EvidencaItem, shih prisma/schema.prisma).

export const RATING_SCALE = [
  { value: "5", label: "Shkëlqyeshëm" },
  { value: "4", label: "Shumë mirë" },
  { value: "3", label: "Mirë" },
  { value: "2", label: "Mjaftueshëm" },
] as const;

export const EVIDENCA_ITEM_TYPES = ["RATING", "YES_NO", "CHOICE", "TEXT", "TEXTAREA"] as const;
export type EvidencaItemType = (typeof EVIDENCA_ITEM_TYPES)[number];

export const EVIDENCA_ITEM_TYPE_LABELS: Record<EvidencaItemType, string> = {
  RATING: "Notë (5/4/3/2)",
  YES_NO: "Po / Jo",
  CHOICE: "Zgjedhje (opsione)",
  TEXT: "Tekst i shkurtër",
  TEXTAREA: "Tekst i gjatë",
};

export function specifyKey(itemId: number): string {
  return `${itemId}__specify`;
}

// Shablloni fillestar — kategoritë/pikat e vlerësimit të aftësive dhe pyetjet
// e pyetësorit shëndetësor/logjistik, saktësisht sipas dy formularëve fizikë
// të pedagogisë. Përdoret nga butoni "Ngarko Shabllonin Fillestar" te
// Cilësimet, që administrata t'i ngarkojë me një klikim (pa i shkruar një
// nga një) në çdo instalim të ri (p.sh. prodhimin), pa kërkuar qasje direkte
// te databaza.
export const DEFAULT_EVIDENCA_TEMPLATE: {
  skills: { label: string; items: string[] }[];
  general: { label: string; type: "YES_NO" | "CHOICE"; hasSpecify?: boolean; options?: string[] }[];
} = {
  skills: [
    {
      label: "Njohuritë Gjuhësore",
      items: [
        "Njohja e shkronjave",
        "Shqipton drejt tingujt, rrokjet dhe fjalë",
        "Ritregon me fjalë të thjeshta brendësinë e një teksti",
      ],
    },
    {
      label: "Njohuritë Matematikore",
      items: [
        "Kryen veprime matematikore, mbledh, zbret",
        "Vizaton rrethin, katrorin, trekëndëshin dhe drejtkëndëshin",
        "Identifikon vetitë e figurave dhe format e objekteve",
        "Krahason duke përdorur shprehjet më pak, më shumë",
        "Krahason duke përdorur shprehjet më i vogël, më i madh",
      ],
    },
    {
      label: "Njohuritë në Fushën e Shkencës, Shoqërisë dhe Mjedisit",
      items: [
        "Dallon frutat dhe perimet",
        "Numëron disa produkte ushqimore që marrim nga kafshët",
        "Përshkruan karakteristikat si ngjyrën e syve, flokët etj.",
      ],
    },
    {
      label: "Njohuritë Logjike",
      items: ["Pyetjet logjike", "Memory card", "Detektivi, gjetja e figurave", "Labirinti"],
    },
    {
      label: "Shkathtësitë Motorike",
      items: ["Modelimi me shkrepse", "Shkrimi i numrave dhe shkronjave"],
    },
  ],
  general: [
    { label: "A ka fëmija juaj histori mjekësore alergjike?", type: "YES_NO", hasSpecify: true },
    { label: "A ka ndonjë problem tjetër shëndetësor, për të cilin shkolla do të duhej të ishte e informuar?", type: "YES_NO", hasSpecify: true },
    { label: "A ka fëmija juaj ndonjë nevojë që kërkon trajtim të veçantë?", type: "YES_NO", hasSpecify: true },
    { label: "A vaksinohet fëmija juaj?", type: "YES_NO" },
    { label: "A e ka nënshkruar kontratën me shkollën?", type: "YES_NO" },
    { label: "Çështja e ushqimit", type: "CHOICE", options: ["Me shkollën", "Individuale"] },
    { label: "Çështja e transportit", type: "CHOICE", options: ["Me shkollën", "Individuale"] },
  ],
};
