import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Kufi tentativash për IP (faqe publike, pa login) — pengon krijimin masiv të
// llogarive false dhe dërgimin e email-eve "Regjistrimi u krye" në adresa të
// çfarëdoshme. I qëllimshëm bujar (20/orë): gjithë stafi mund të regjistrohet
// njëkohësisht nga Wi-Fi i shkollës (e njëjta IP) pa u bllokuar. Një gabim në
// formular harxhon thjesht një tentativë — s'bllokon asnjë email.
// Në memorie (pa ndryshim në databazë); rinis me rinisjen e serverit.
const MAX_ATTEMPTS_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;
const attempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS_PER_HOUR) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  // Pastrim periodik që Map-i të mos rritet pa fund
  if (attempts.size > 5000) {
    for (const [k, ts] of attempts) if (!ts.some(t => now - t < WINDOW_MS)) attempts.delete(k);
  }
  return false;
}

function clientIp(req: NextRequest): string {
  // X-Real-IP vendoset nga nginx ($remote_addr) — s'mund të falsifikohet nga
  // klienti, ndryshe nga elementi i parë i X-Forwarded-For.
  return req.headers.get("x-real-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",").pop()?.trim()
    ?? "unknown";
}

export async function POST(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Shumë tentativa regjistrimi nga ky rrjet. Provo përsëri pas pak minutash." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Fjalëkalimi duhet të ketë të paktën 6 shkronja/numra" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ky email është përdorur tashmë. Provo të kyçesh." }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  // Llogaria krijohet JOAKTIVE — dikush që gjen këtë faqe publike mund të
  // regjistrohet me çfarëdo emri/emaili (madje edhe duke zgjedhur emrin e
  // një stafi tjetër ekzistues, pasi emri vjen nga një dropdown, jo verifikim
  // identiteti). Admini duhet ta aktivizojë manualisht nga Cilësimet →
  // Përdoruesit para se llogaria të mund të kyçet fare.
  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "TEACHER",
      active: false,
      organizationId: 1,
    },
  });

  await sendEmail(
    email,
    "Regjistrimi u krye me sukses",
    `<div style="font-family: system-ui, sans-serif; max-width: 480px;">
      <h2 style="margin-bottom: 4px;">Regjistrimi u krye me sukses</h2>
      <p style="color: #64748b; margin-top: 0;">Akademia Ora</p>
      <p>Regjistrimi juaj u krye me sukses, ju lutem pritni për aprovimin nga personi përgjegjës.</p>
    </div>`
  );

  return NextResponse.json({ success: true, pending: true });
}
