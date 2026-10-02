import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { logAction } from "@/lib/audit";
import { MESSAGE_TYPES, statusLabel, type MessageType, type MessageStatus } from "@/lib/smsStatus";
import { recordStudentEvent, type StudentEventInput } from "@/lib/studentHistory";

interface RecipientInput { phone: string; name?: string; studentId?: number | string; studentIds?: (number | string)[]; message?: string; paymentStatus?: string }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // FINANCE përfshihet: butonat "Njofto/Dërgo SMS" për borxhet ndodhen pikërisht
  // te modulet e Financës (Shkollimi, Ushqimi, Uniforma, Librat, Pasqyra
  // Financiare, profili i nxënësit) — pa të, çdo dërgim prej tyre dështonte 403.
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SUPERADMIN" && role !== "SECRETARY" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const message = String(body.message ?? "").trim();
  // Opsionale (moduli i ri i mesazheve) — për mbrojtjen nga dërgimi i dyfishtë.
  // Thirrjet e vjetra (pa këtë fushë) ruhen si më parë, me null.
  const messageType = MESSAGE_TYPES.some(t => t.key === body.messageType) ? String(body.messageType) : null;
  const rawRecipients: RecipientInput[] = Array.isArray(body.recipients) ? body.recipients : [];

  // Mesazhi i përbashkët (klasë/familje/individual/debt) mbetet i detyrueshëm
  // si më parë, PËRVEÇ kur çdo marrës ka mesazhin e vet të gatshëm — rasti i
  // njoftimeve të gjeneruara automatikisht (shih notificationTemplates.ts),
  // ku çdo marrës ndryshon në shifra reale, jo vetëm emër/klasë.
  const everyRecipientHasOwnMessage = rawRecipients.length > 0 && rawRecipients.every(r => String(r.message ?? "").trim());
  if (!message && !everyRecipientHasOwnMessage) return NextResponse.json({ error: "Mesazhi mungon" }, { status: 400 });
  if (!rawRecipients.length) return NextResponse.json({ error: "Zgjidh të paktën një marrës" }, { status: 400 });

  // Deduplikim sipas telefonit + mesazhit — dërgimi "në grup" (klasë/familje)
  // mund të përfshijë të njëjtin numër dy herë (p.sh. dy fëmijë të një
  // prindi) me TË NJËJTIN tekst (rastet e vjetra, s'ka pse të dërgohet dy
  // herë). POR kur dy fëmijë ndajnë telefonin e prindit e kanë secili
  // mesazhin e VET (shuma të ndryshme borxhi — shih notificationTemplates.ts),
  // ndaj deduplikimi vetëm sipas telefonit do të fshihte njërin prej tyre
  // heshtazi; përfshihet edhe mesazhi në çelës, që të dyja mesazhet e
  // ndryshme të dërgohen te i njëjti numër.
  const seen = new Set<string>();
  const recipients = rawRecipients.filter(r => {
    const phone = String(r.phone ?? "").trim();
    if (!phone) return false;
    const key = `${phone}__${String(r.message ?? "").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!recipients.length) {
    return NextResponse.json({ error: "Asnjë numër telefoni i vlefshëm" }, { status: 400 });
  }

  const batchId = recipients.length > 1 ? randomUUID() : null;

  // {emri}/{klasa} lejojnë një mesazh të vetëm "shabllon" për gjithë grupin
  // (p.sh. tërë klasën) që personalizohet automatikisht për secilin marrës —
  // të dhënat merren nga vetë Student (jo nga `name`-i i dërguar nga klienti),
  // që të jetë gjithmonë emri i saktë i nxënësit, jo i prindit.
  const needsPersonalize = (message.includes("{emri}") || message.includes("{klasa}"))
    && recipients.some(r => !String(r.message ?? "").trim());
  const studentIds = Array.from(new Set(
    recipients.filter(r => r.studentId).map(r => parseInt(String(r.studentId)))
  ));
  const students = needsPersonalize && studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
      })
    : [];
  const studentMap = new Map(students.map(s => [s.id, s]));

  function personalize(r: RecipientInput): string {
    const ownMessage = String(r.message ?? "").trim();
    if (ownMessage) return ownMessage;
    if (!needsPersonalize) return message;
    const sid = r.studentId ? parseInt(String(r.studentId)) : null;
    const student = sid ? studentMap.get(sid) : undefined;
    const emri = student
      ? `${student.firstName} ${student.lastName}`
      : String(r.name ?? "").replace(/\s*\(prindi\)\s*$/i, "").trim();
    const klasa = student?.class?.name ?? "";
    return message.replaceAll("{emri}", emri).replaceAll("{klasa}", klasa).replace(/ {2,}/g, " ").trim();
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const historyEvents: StudentEventInput[] = [];
  const typeLabel = messageType ? (MESSAGE_TYPES.find(t => t.key === messageType)?.label ?? null) : null;

  for (const r of recipients) {
    const phone = String(r.phone).trim();
    const personalizedMessage = personalize(r);
    const result = await sendSms(phone, personalizedMessage);

    await prisma.smsMessage.create({
      data: {
        organizationId: orgId,
        batchId,
        recipientPhone: phone,
        recipientName: r.name ? String(r.name).trim() : null,
        studentId: r.studentId ? parseInt(String(r.studentId)) : null,
        message: personalizedMessage,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.ok ? null : result.error,
        sentById: userId,
        messageType,
        paymentStatus: r.paymentStatus ? String(r.paymentStatus).slice(0, 100) : null,
      },
    });

    if (result.ok) sent++;
    else { failed++; if (result.error && !errors.includes(result.error)) errors.push(result.error); }

    // Historiku i nxënësit — për çdo fëmijë të përfshirë (edhe te "Një SMS për familje")
    if (result.ok) {
      const ids = Array.from(new Set(
        (Array.isArray(r.studentIds) && r.studentIds.length ? r.studentIds : [r.studentId])
          .map(x => parseInt(String(x ?? ""))).filter(n => n > 0)
      ));
      const st = r.paymentStatus && messageType
        ? String(r.paymentStatus).split(",").map(x => statusLabel(messageType as MessageType, x as MessageStatus)).join(", ")
        : null;
      for (const sid of ids) {
        historyEvents.push({
          studentId: sid, type: "SMS",
          title: typeLabel ? `SMS · ${typeLabel}` : "SMS te prindi",
          description: personalizedMessage,
          data: { phone, messageType, paymentStatus: r.paymentStatus ?? null, statusLabel: st },
        });
      }
    }
  }
  await recordStudentEvent(session, historyEvents);

  await logAction(session, "CREATE", "SmsMessage", null,
    `Dërgoi SMS te ${recipients.length} marrës (${sent} me sukses, ${failed} dështuan)`);

  return NextResponse.json({ sent, failed, total: recipients.length, errors });
}
