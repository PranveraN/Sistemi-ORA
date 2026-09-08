// Wrapper mbi SMS Gateway (sms.porositweb.com — bazuar te RBSoft SMS Gateway),
// vetë-hostuar, e lidhur me një telefon Android real që dërgon SMS-të.
//
// Formati i vërtetuar drejtpërdrejt nga "Generate Link to Test API" i panelit
// (API → Generate Link), 2026-09-08:
//   GET {url}/services/send.php?key=...&number=...&message=...&devices=...&type=sms&prioritize=0
//
// KONFIGURIMI (.env / .env.production):
//   SMS_GATEWAY_URL       — URL bazë e instancës (p.sh. https://sms.porositweb.com)
//   SMS_GATEWAY_TOKEN     — "API Key" nga paneli (skeda API)
//   SMS_GATEWAY_DEVICE_ID — ID e pajisjes që dërgon (shifra në kllapa te "Devices",
//                           p.sh. "49" për "Galaxy A13 [49]")
function getConfig(): { url: string; token: string; deviceId: string } | null {
  const url = process.env.SMS_GATEWAY_URL;
  const token = process.env.SMS_GATEWAY_TOKEN;
  const deviceId = process.env.SMS_GATEWAY_DEVICE_ID;
  if (!url || !token || !deviceId) return null;
  return { url: url.replace(/\/$/, ""), token, deviceId };
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
    console.warn(`[sms] SMS_GATEWAY_URL/SMS_GATEWAY_TOKEN/SMS_GATEWAY_DEVICE_ID mungojnë — s'u dërgua SMS te ${to}`);
    return { ok: false, error: "SMS Gateway s'është konfiguruar (SMS_GATEWAY_URL/SMS_GATEWAY_TOKEN/SMS_GATEWAY_DEVICE_ID mungojnë)" };
  }

  const params = new URLSearchParams({
    key: config.token,
    number: toInternationalPhone(to),
    message,
    devices: config.deviceId,
    type: "sms",
    prioritize: "0",
  });

  try {
    const res = await fetch(`${config.url}/services/send.php?${params.toString()}`);
    const text = await res.text();

    if (!res.ok) {
      return { ok: false, error: `Gateway ktheu gabim (HTTP ${res.status})` };
    }

    // Përgjigja e send.php s'është e dokumentuar zyrtarisht — provojmë ta
    // lexojmë si JSON (shumica e këtij lloji gateway-sh kthejnë {"success":true/false}
    // ose {"error":{...}}); nëse s'është JSON, e trajtojmë HTTP 200 si sukses.
    try {
      const data = JSON.parse(text);
      if (data?.success === false || data?.error) {
        return { ok: false, error: typeof data.error === "string" ? data.error : JSON.stringify(data.error ?? data) };
      }
    } catch {
      // përgjigje jo-JSON — HTTP 200 mjafton si sinjal suksesi
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gabim i panjohur nga SMS Gateway";
    console.warn(`[sms] Dështoi lidhja me SMS Gateway duke dërguar te ${to}: ${msg}`);
    return { ok: false, error: msg };
  }
}
