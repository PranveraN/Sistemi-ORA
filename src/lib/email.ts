import { Resend } from "resend";

const FROM = "Akademia Ora <onboarding@akademiaora.com>";

let resendClient: Resend | null = null;
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const client = getClient();
  if (!client) {
    console.warn(`[email] RESEND_API_KEY mungon — s'u dërgua email te ${to}: "${subject}"`);
    return { ok: false, error: "Email-i nuk është konfiguruar (RESEND_API_KEY mungon)" };
  }

  const { error } = await client.emails.send({ from: FROM, to, subject, html });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
