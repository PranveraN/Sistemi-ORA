// Moduli "Lirimi i nxënësit" — logjika e përbashkët (vetëm server).
// Lexon nxënësit/klasat/prindërit; shkruan VETËM te tabelat e veta (LirimKerkese,
// LirimLog, LirimKod, KujdestareKlasa) dhe te Setting (çelësi i telefonit të administratës).
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

export const ARSYET: Record<string, string> = {
  MJEKU: "Vizitë te mjeku",
  FAMILJARE: "Arsye familjare",
  SEMUNDJE: "Sëmundje",
  TJETER: "Tjetër",
};
export const LIDHJET: Record<string, string> = { NENA: "Nëna", BABAI: "Babai", TJETER: "Tjetër" };
export const STATUSET: Record<string, string> = {
  NE_PRITJE: "Në pritje",
  APROVUAR: "Aprovuar",
  REFUZUAR: "Refuzuar",
  ANULUAR: "Anuluar",
};

export const KOD_VLEN_MIN = 10;
export const KOD_MAX_TENTATIVA = 5;
export const KOD_MAX_NE_ORE = 5;           // kode të dërguara për një numër brenda 1 ore
export const KERKESA_MAX_NE_DITE = 5;      // kërkesa për një numër telefoni në ditë
export const TOKEN_VLEN_ORE = 2;
export const ADMIN_PAS_MIN = 30;           // pa përgjigje → SMS te administrata
export const SETTING_ADMIN_TEL = "lirimi.adminTelefoni";

const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "lirimi-dev";

/** Numri në formë lokale: vetëm shifra, me 0 përpara (044123456). "" kur s'duket numër. */
export function normPhone(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00383")) d = d.slice(5);
  else if (d.startsWith("383")) d = d.slice(3);
  if (d && !d.startsWith("0")) d = `0${d}`;
  return d.length >= 8 ? d : "";
}

/** Dita e sotme (Europe/Belgrade) si YYYY-MM-DD. */
export function sotDay(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" });
}

/** Fillimi i ditës së sotme (Europe/Belgrade) si Date. */
function fillimiISotem(): Date {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Belgrade" }));
  const diff = now.getTime() - local.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() + diff);
}

export const fmtDay = (day: string) => day.split("-").reverse().join(".");

// ── Nxënësit e një prindi (sipas telefonit) ───────────────────────────────

export interface FemijeIPrindit { id: number; emri: string; klasa: string | null; classId: number | null }

export async function femijetSipasTelefonit(phone: string, orgId = 1): Promise<FemijeIPrindit[]> {
  const p = normPhone(phone);
  if (!p) return [];
  const students = await prisma.student.findMany({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      OR: [{ fatherPhone: { not: null } }, { motherPhone: { not: null } }, { parentPhone: { not: null } }],
    },
    select: { id: true, firstName: true, lastName: true, classId: true, fatherPhone: true, motherPhone: true, parentPhone: true, class: { select: { name: true } } },
  });
  return students
    .filter(s => [s.fatherPhone, s.motherPhone, s.parentPhone].some(x => normPhone(x) === p))
    .map(s => ({ id: s.id, emri: `${s.firstName} ${s.lastName}`.replace(/\s+/g, " ").trim(), klasa: s.class?.name ?? null, classId: s.classId }))
    .sort((a, b) => a.emri.localeCompare(b.emri, "sq"));
}

// ── Kodi 6-shifror ─────────────────────────────────────────────────────────

const hashKod = (phone: string, kod: string) => crypto.createHmac("sha256", secret()).update(`${phone}:${kod}`).digest("hex");

/** Krijon dhe dërgon kodin. Kthen `devKod` VETËM jashtë prodhimit kur SMS s'është konfiguruar (për prova). */
export async function dergoKodin(phone: string): Promise<{ ok: true; devKod?: string } | { ok: false; error: string; status: number }> {
  const p = normPhone(phone);
  const nga = new Date(Date.now() - 60 * 60_000);
  const sa = await prisma.lirimKod.count({ where: { telefoni: p, createdAt: { gte: nga } } });
  if (sa >= KOD_MAX_NE_ORE) return { ok: false, status: 429, error: "Keni kërkuar shumë kode. Provoni përsëri pas pak." };
  const kod = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.lirimKod.create({ data: { telefoni: p, kodHash: hashKod(p, kod), skadon: new Date(Date.now() + KOD_VLEN_MIN * 60_000) } });
  const r = await sendSms(p, `Kodi juaj për kërkesën e lirimit: ${kod} (vlen ${KOD_VLEN_MIN} minuta). Akademia Ora`);
  if (!r.ok) {
    if (process.env.NODE_ENV !== "production") return { ok: true, devKod: kod };
    return { ok: false, status: 502, error: "SMS me kodin nuk u dërgua. Provoni përsëri ose kontaktoni shkollën." };
  }
  return { ok: true };
}

export async function verifikoKodin(phone: string, kod: string): Promise<boolean> {
  const p = normPhone(phone);
  const rec = await prisma.lirimKod.findFirst({
    where: { telefoni: p, perdorur: false, skadon: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!rec || rec.tentativa >= KOD_MAX_TENTATIVA) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(rec.kodHash), Buffer.from(hashKod(p, kod.replace(/\D/g, ""))));
  await prisma.lirimKod.update({ where: { id: rec.id }, data: ok ? { perdorur: true } : { tentativa: { increment: 1 } } });
  return ok;
}

// ── Token-i i prindit pas verifikimit (i nënshkruar, pa sesion) ────────────

export function krijoToken(phone: string): string {
  const payload = `${normPhone(phone)}.${Date.now() + TOKEN_VLEN_ORE * 3600_000}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

/** Telefoni nga token-i, ose null kur token-i s'është i vlefshëm / ka skaduar. */
export function lexoToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [phone, exp] = payload.split(".");
  if (!phone || !(Number(exp) > Date.now())) return null;
  return phone;
}

export const kerkesatSot = (phone: string) =>
  prisma.lirimKerkese.count({ where: { telefoni: normPhone(phone), createdAt: { gte: fillimiISotem() } } });

// ── Historiku dhe SMS-të ───────────────────────────────────────────────────

export async function logLirim(kerkeseId: number, veprimi: string, pershkrim: string | null, kush: string | null, userId: number | null = null) {
  try {
    await prisma.lirimLog.create({ data: { kerkeseId, veprimi, pershkrim, kush, userId } });
  } catch (e) {
    console.error("[lirimi] log dështoi:", e);
  }
}

/** Dërgon SMS dhe e shënon te historiku i kërkesës. S'hedh kurrë gabim. */
export async function smsLirim(kerkeseId: number, phone: string | null | undefined, message: string, marresi: string) {
  const p = normPhone(phone);
  if (!p) { await logLirim(kerkeseId, "SMS", `S'u dërgua te ${marresi}: mungon numri`, "Sistemi"); return; }
  let r: { ok: boolean; error?: string };
  try { r = await sendSms(p, message); } catch (e) { r = { ok: false, error: e instanceof Error ? e.message : "gabim" }; }
  await logLirim(kerkeseId, "SMS", `${r.ok ? "U dërgua" : `DËSHTOI (${r.error ?? "gabim"})`} te ${marresi} (${p}): ${message}`, "Sistemi");
}

/** URL-ja bazë e sistemit (për linqet në SMS). */
export function baseUrl(reqUrl?: string): string {
  const env = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  try { return reqUrl ? new URL(reqUrl).origin : ""; } catch { return ""; }
}

export async function emriNxenesit(studentId: number) {
  const s = await prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true, class: { select: { name: true } } } });
  return { emri: s ? `${s.firstName} ${s.lastName}`.replace(/\s+/g, " ").trim() : `#${studentId}`, klasa: s?.class?.name ?? "" };
}

/** Njofton kujdestaren/kujdestaret e klasës për një kërkesë të re. */
export async function njoftoKujdestaren(k: { id: number; studentId: number; classId: number | null; data: string; ora: string; arsyeja: string; shpjegim: string | null }, base: string) {
  const { emri, klasa } = await emriNxenesit(k.studentId);
  const arsye = `${ARSYET[k.arsyeja] ?? k.arsyeja}${k.shpjegim ? ` – ${k.shpjegim}` : ""}`;
  const msg = `Kërkesë lirimi: ${emri}, ${klasa}, ${fmtDay(k.data)} në ${k.ora}. Arsyeja: ${arsye}. Hap: ${base}/kujdestare/kerkesa/${k.id}`;
  const kujdestaret = k.classId ? await prisma.kujdestareKlasa.findMany({ where: { classId: k.classId } }) : [];
  if (!kujdestaret.length) { await logLirim(k.id, "SMS", "S'ka kujdestare të caktuar për këtë klasë — s'u dërgua SMS", "Sistemi"); return; }
  for (const kd of kujdestaret) await smsLirim(k.id, kd.telefoni, msg, "kujdestarja");
}

/** SMS te prindi për vendimin. */
export async function njoftoPrindin(k: { id: number; studentId: number; data: string; ora: string; telefoni: string; statusi: string; arsyeRefuzimi: string | null }) {
  const { emri } = await emriNxenesit(k.studentId);
  const msg = k.statusi === "APROVUAR"
    ? `Kërkesa për lirimin e ${emri} më ${fmtDay(k.data)} në ora ${k.ora} u aprovua. Akademia Ora`
    : `Kërkesa për lirimin e ${emri} u refuzua. Arsyeja: ${k.arsyeRefuzimi ?? "—"}. Akademia Ora`;
  await smsLirim(k.id, k.telefoni, msg, "prindi");
}
