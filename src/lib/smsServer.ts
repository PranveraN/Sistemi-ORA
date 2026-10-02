import { prisma } from "./prisma";
import { sendSms } from "./sms";
import { recordStudentEvent } from "./studentHistory";

/**
 * Dërgon një SMS nga serveri (p.sh. konfirmimi i pranimit/refuzimit të një
 * aplikimi) DHE e regjistron njësoj si moduli i mesazheve: te historiku i
 * SMS-ve (SmsMessage) dhe — kur ka nxënës — te historiku i nxënësit.
 * S'hedh kurrë gabim: kthen { ok, error }.
 */
export async function sendLoggedSms(session: unknown, opts: {
  phone: string;
  message: string;
  recipientName?: string | null;
  studentId?: number | null;
  messageType?: string | null;
  orgId: number;
}): Promise<{ ok: boolean; error?: string }> {
  const userId = parseInt((session as { user?: { id?: string } } | null)?.user?.id ?? "0");
  const phone = opts.phone.trim();
  const message = opts.message.trim();
  if (!phone || !message) return { ok: false, error: "Numri ose mesazhi mungon" };
  let result: { ok: boolean; error?: string };
  try {
    result = await sendSms(phone, message);
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "Dërgimi dështoi" };
  }
  try {
    if (userId > 0) {
      await prisma.smsMessage.create({
        data: {
          organizationId: opts.orgId,
          recipientPhone: phone,
          recipientName: opts.recipientName ?? null,
          studentId: opts.studentId ?? null,
          message,
          status: result.ok ? "SENT" : "FAILED",
          errorMessage: result.ok ? null : result.error ?? null,
          sentById: userId,
          messageType: opts.messageType ?? "GENERAL",
        },
      });
    }
    if (result.ok && opts.studentId) {
      await recordStudentEvent(session, {
        studentId: opts.studentId, type: "SMS", title: "SMS te prindi", description: message, data: { phone },
      });
    }
  } catch (e) {
    console.error("[smsServer] regjistrimi i SMS-it dështoi:", e);
  }
  return result;
}
