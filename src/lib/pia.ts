// Plani Individual i Arsimit (PIA) — strukturat dhe pastrimi i të dhënave.
// Ndjek dokumentin "PIA — version i thjeshtuar" (6 pjesë). Përdoret nga API
// (pastron çfarëdo vjen nga klienti) dhe nga faqja/printimi.

export const PAVARESIA = [
  { key: "P", label: "I pavarur" },
  { key: "MP", label: "Me mbështetje të pjesshme" },
  { key: "MA", label: "Me mbështetje të plotë (asistente)" },
] as const;

export const NIVELI = [
  { key: "R", label: "I realizuar", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { key: "PR", label: "Pjesërisht i realizuar", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { key: "NP", label: "Në progres", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { key: "NR", label: "Nuk është realizuar ende", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

export const ASISTENTJA = ["Po", "Jo", "Pjesërisht"];
export const ORGANIZIMI = ["Në klasë", "Individual", "Kombinuar"];
export const DOKUMENTET = ["Raport i komisionit", "Raport mjekësor", "Raport psikologjik"];
export const MBESHTETJA = ["Verbale", "Vizuale", "Modelim", "Materiale"];
export const INSTRUMENTET = ["Vëzhgim", "Listë kontrolli", "Fletë pune", "Portofol", "Detyrë praktike / produkt", "Pyetje me gojë", "Test i përshtatur", "Rubrikë", "Foto / video (me pëlqim)"];
export const PERSHTATJET = ["Me gojë", "Kohë shtesë", "Më pak pyetje", "Në hapa të vegjël", "Materiale vizuale", "Udhëzime me zë", "Prania e asistentes"];
export const VENDIMI = ["PIA vazhdon pa ndryshime", "PIA rishikohet", "Shtohen rezultate të reja", "Mbështetja zvogëlohet", "Mbështetja rritet"];
export const PERIUDHAT = ["Tremujori I", "Tremujori II", "Tremujori III", "Fundi i vitit"];

export interface PiaFusha { fusha: string; cfareBen: string; veshtiresite: string }
export interface PiaRezultat { rezultati: string; pavaresia: string; mbeshtetja: string[] }
export interface PiaData {
  lendet: string; mesimdhenesi: string; asistentja: string; oreJave: string; organizimi: string;
  nga: string; deri: string; dataRishikimit: string; dokumentet: string[]; dokumentTjeter: string;
  fushat: PiaFusha[]; motivimi: string;
  rezultatet: PiaRezultat[];
  instrumentet: string[]; pershtatjet: string[]; zvogelimi: string;
}
export interface PiaReviewRez { evidenca: string; niveli: string; pavaresia: string; nevojat: string }
export interface PiaReviewData {
  periudha: string; rezultatet: PiaReviewRez[];
  progresi: string; rekomandimet: string; vendimi: string[];
}

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const pick = (v: unknown, allowed: readonly string[]) => (typeof v === "string" && allowed.includes(v) ? v : "");
const pickMany = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : []);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const keys = (list: readonly { key: string }[]) => list.map(x => x.key);

/** Numri i rreshtave në formular (si te dokumenti): 3 fusha, 4 rezultate (R1–R4). */
export const FUSHA_COUNT = 3;
export const REZ_COUNT = 4;

export function emptyPia(): PiaData {
  return normalizePia({});
}

export function normalizePia(raw: unknown): PiaData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fushat = arr(r.fushat).slice(0, FUSHA_COUNT).map(f => {
    const o = (f ?? {}) as Record<string, unknown>;
    return { fusha: str(o.fusha, 300), cfareBen: str(o.cfareBen), veshtiresite: str(o.veshtiresite) };
  });
  while (fushat.length < FUSHA_COUNT) fushat.push({ fusha: "", cfareBen: "", veshtiresite: "" });
  const rezultatet = arr(r.rezultatet).slice(0, REZ_COUNT).map(x => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { rezultati: str(o.rezultati), pavaresia: pick(o.pavaresia, keys(PAVARESIA)), mbeshtetja: pickMany(o.mbeshtetja, MBESHTETJA) };
  });
  while (rezultatet.length < REZ_COUNT) rezultatet.push({ rezultati: "", pavaresia: "", mbeshtetja: [] });
  return {
    lendet: str(r.lendet, 300), mesimdhenesi: str(r.mesimdhenesi, 300),
    asistentja: pick(r.asistentja, ASISTENTJA), oreJave: str(r.oreJave, 20), organizimi: pick(r.organizimi, ORGANIZIMI),
    nga: str(r.nga, 10), deri: str(r.deri, 10), dataRishikimit: str(r.dataRishikimit, 10),
    dokumentet: pickMany(r.dokumentet, DOKUMENTET), dokumentTjeter: str(r.dokumentTjeter, 300),
    fushat, motivimi: str(r.motivimi),
    rezultatet,
    instrumentet: pickMany(r.instrumentet, INSTRUMENTET), pershtatjet: pickMany(r.pershtatjet, PERSHTATJET), zvogelimi: str(r.zvogelimi),
  };
}

export function emptyReview(): PiaReviewData {
  return normalizeReview({});
}

export function normalizeReview(raw: unknown): PiaReviewData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rezultatet = arr(r.rezultatet).slice(0, REZ_COUNT).map(x => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { evidenca: str(o.evidenca), niveli: pick(o.niveli, keys(NIVELI)), pavaresia: pick(o.pavaresia, keys(PAVARESIA)), nevojat: str(o.nevojat) };
  });
  while (rezultatet.length < REZ_COUNT) rezultatet.push({ evidenca: "", niveli: "", pavaresia: "", nevojat: "" });
  return {
    periudha: str(r.periudha, 60), rezultatet,
    progresi: str(r.progresi), rekomandimet: str(r.rekomandimet), vendimi: pickMany(r.vendimi, VENDIMI),
  };
}

export function parseJson<T>(s: string | null | undefined, norm: (x: unknown) => T): T {
  try { return norm(JSON.parse(s || "{}")); } catch { return norm({}); }
}
