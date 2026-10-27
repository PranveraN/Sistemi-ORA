// Kujtesa për administratën: kërkesë lirimi "Në pritje" pa përgjigje nga kujdestarja
// për më shumë se 30 minuta → një SMS (vetëm një herë për kërkesë). Kontroll çdo 5 minuta.
import { prisma } from "@/lib/prisma";
import { ADMIN_PAS_MIN, SETTING_ADMIN_TEL, baseUrl, emriNxenesit, fmtDay, smsLirim } from "@/lib/lirimi";

export async function kontrolloLirimet() {
  const tel = (await prisma.setting.findUnique({ where: { key: SETTING_ADMIN_TEL } }))?.value;
  if (!tel) return; // s'është vendosur numri i administratës
  const vonuara = await prisma.lirimKerkese.findMany({
    where: { statusi: "NE_PRITJE", adminNjoftuarAt: null, createdAt: { lte: new Date(Date.now() - ADMIN_PAS_MIN * 60_000) } },
    take: 20,
  });
  for (const k of vonuara) {
    // Shënohet para dërgimit, që një dështim i SMS-së të mos e përsërisë çdo 5 minuta
    const r = await prisma.lirimKerkese.updateMany({ where: { id: k.id, adminNjoftuarAt: null }, data: { adminNjoftuarAt: new Date() } });
    if (!r.count) continue;
    const { emri, klasa } = await emriNxenesit(k.studentId);
    await smsLirim(k.id, tel,
      `Kërkesë lirimi pa përgjigje (${ADMIN_PAS_MIN} min): ${emri}, ${klasa}, ${fmtDay(k.data)} në ${k.ora}. Hap: ${baseUrl()}/lirimet`,
      "administrata");
  }
}

const g = globalThis as unknown as { __lirimiScheduler?: boolean };

export function startLirimiScheduler() {
  if (g.__lirimiScheduler) return;
  g.__lirimiScheduler = true;
  setInterval(() => { kontrolloLirimet().catch(e => console.error("[lirimi] kontrolli dështoi:", e)); }, 5 * 60_000);
}
