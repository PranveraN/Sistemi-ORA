import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buildApplicationData, isRateLimited, getClientIp } from "@/lib/enrollmentApplication";
import { getEnrollmentRules, getOfficeSession } from "@/lib/enrollmentRules";

// Endpoint PUBLIK (pa auth) — krijon draftin e aplikimit sapo prindi kalon nga
// hapi i parë. Askush s'ka sesion këtu, ndaj çdo aplikim merr një `resumeToken`
// të rastësishëm (256-bit) që funksionon si "biletë" për ta lexuar/edituar/
// dorëzuar më vonë — shih findApplicationByToken().
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Honeypot — fushë e fshehur në formular, njerëzit s'e prekin kurrë. Nëse
  // është plotësuar, kthejmë "sukses" të rremë pa krijuar asnjë rresht real,
  // që bot-i të mos e kuptojë se u refuzua.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ id: 0, resumeToken: "0" });
  }

  if (!body.firstName || !body.lastName) {
    return NextResponse.json({ message: "Emri dhe mbiemri i nxënësit janë të domosdoshëm." }, { status: 400 });
  }

  // "Pranon aplikime" i fikur → mbyllur edhe në server (jo vetëm në pamje).
  // Stafi në zyrë ("Shto aplikim me dorë") lejohet gjithmonë.
  const office = await getOfficeSession();
  if (!office && !(await getEnrollmentRules()).enrollmentOpen) {
    return NextResponse.json({ message: "Regjistrimet janë të mbyllura për momentin." }, { status: 403 });
  }

  const ip = getClientIp(req);
  if (!office && await isRateLimited(ip)) {
    return NextResponse.json({ message: "Keni arritur kufirin e aplikimeve për sot. Provoni sërish nesër." }, { status: 429 });
  }

  const resumeToken = crypto.randomBytes(32).toString("hex");
  const data = buildApplicationData(body);

  const app = await prisma.enrollmentApplication.create({
    data: {
      ...data,
      firstName: String(body.firstName),
      lastName: String(body.lastName),
      schoolYear: typeof body.schoolYear === "string" ? body.schoolYear : "",
      organizationId: 1,
      resumeToken,
      submitterIp: ip,
      source: office ? "OFFICE" : "ONLINE",
    },
  });

  return NextResponse.json({ id: app.id, resumeToken: app.resumeToken });
}
