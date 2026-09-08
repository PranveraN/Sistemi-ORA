// Wrapper mbi RBSoft SMS Gateway (ose çdo gateway tjetër me API të ngjashme) —
// vetë-hostuar, e lidhur me një telefon Android real që dërgon SMS-të.
//
// KONFIGURIMI (.env / .env.production):
//   SMS_GATEWAY_URL   — URL bazë e instancës tënde (p.sh. https://sms.shkolla-jote.com)
//   SMS_GATEWAY_TOKEN — Token API-je, gjenerohet nga paneli i gateway-t
//
// KUJDES: rruga /api/send/sms + formati i kërkesës më poshtë janë konvencioni
// më i zakonshëm për këtë familje produktesh (Laravel + token Bearer), por
// DUHET VERIFIKUAR kundër dokumentacionit real të instancës tënde (zakonisht
// një skedë "API" në panel, me shembuj `curl` gati) para përdorimit në
// prodhim — nëse rruga/fushat ndryshojnë, mjafton të përshtatet vetëm ky
// skedar, pjesa tjetër e sistemit s'preket.
function getConfig(): { url: string; token: string } | null {
  const url = process.env.SMS_GATEWAY_URL;
  const token = process.env.SMS_GATEWAY_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

// Numrat ruhen lokalisht pa prefiks vendi (p.sh. "045545183") — gateway-t e
// SMS-ve zakonisht kërkojnë format ndërkombëtar (+38345545183).
export function toInternationalPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("383")) return `+${digits}`;
  if (digits.startsWith("0")) return `+383${digits.slice(1)}`;
  return `+${digits}`;
}

export async function sendSms(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  if (!config) {
    console.warn(`[sms] SMS_GATEWAY_URL/SMS_GATEWAY_TOKEN mungojnë — s'u dërgua SMS te ${to}`);
    return { ok: false, error: "SMS Gateway s'është konfiguruar (SMS_GATEWAY_URL/SMS_GATEWAY_TOKEN mungojnë)" };
  }

  try {
    const res = await fetch(`${config.url}/api/send/sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ recipient: toInternationalPhone(to), message }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.message || `Gateway ktheu gabim (HTTP ${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gabim i panjohur nga SMS Gateway";
    console.warn(`[sms] Dështoi lidhja me SMS Gateway duke dërguar te ${to}: ${msg}`);
    return { ok: false, error: msg };
  }
}
