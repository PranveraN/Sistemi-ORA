import { prisma } from "@/lib/prisma";

// Fushat e lejuara që prindi mund t'i dërgojë (krijim DRAFT ose PATCH autosave)
// — model "whitelist" i njëjtë me PATCH /api/students/[id]/route.ts, thjesht
// më i gjatë sepse formulari ka shumë më shumë fusha.
const DATE_FIELDS = new Set(["birthDate", "motherBirth", "fatherBirth", "desiredStartDate"]);
const INT_FIELDS = new Set(["desiredGrade"]);
const BOOL_FIELDS = new Set(["consentDataAccurate", "waitlisted"]);
const JSON_FIELDS = new Set(["customAnswers"]); // objekt {[fieldId]: përgjigje} — ruhet si JSON string (shih EnrollmentFormField)

// SHËNIM: "classId" NUK është pjesë e kësaj liste me qëllim — prindi zgjedh
// vetëm klasën/numrin (desiredGrade); paralelja konkrete (classId) caktohet
// vetëm nga administrata te "Prano" (shih /api/enrollment/applications/[id]/approve).
export const APPLICATION_FIELDS = [
  "schoolYear", "desiredGrade", "previousSchool", "lastCompletedGrade", "desiredStartDate", "applicationReason", "waitlisted",
  "firstName", "lastName", "birthDate", "gender", "personalNumber", "citizenship", "birthCountry", "originType", "originCountry",
  "motherName", "motherBirth", "motherProf", "motherPhone", "motherEmail", "motherAddress",
  "fatherName", "fatherBirth", "fatherProf", "fatherPhone", "fatherEmail", "fatherAddress",
  "primaryContact", "guardianOtherName", "guardianOtherRelation", "guardianOtherPhone", "guardianOtherEmail",
  "address", "city", "country",
  "emergencyContactName", "emergencyContactRelation", "emergencyContactPhone",
  "additionalInfo", "consentDataAccurate", "customAnswers",
];

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

// Ndërton objektin `data` për prisma.enrollmentApplication.create/update — vetëm
// fushat që janë realisht `in body`, njësoj si PATCH-i i studentit.
export function buildApplicationData(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of APPLICATION_FIELDS) {
    if (!(field in body)) continue;
    const val = body[field];
    if (DATE_FIELDS.has(field)) {
      data[field] = parseDate(val);
    } else if (INT_FIELDS.has(field)) {
      data[field] = val === "" || val == null ? null : Number(val);
    } else if (BOOL_FIELDS.has(field)) {
      data[field] = Boolean(val);
    } else if (JSON_FIELDS.has(field)) {
      data[field] = val && typeof val === "object" && Object.keys(val).length > 0 ? JSON.stringify(val) : null;
    } else {
      data[field] = val === "" ? null : val;
    }
  }
  return data;
}

export async function findApplicationByToken(id: number, token: string | null) {
  if (!token) return null;
  const app = await prisma.enrollmentApplication.findUnique({ where: { id } });
  if (!app || app.resumeToken !== token) return null;
  return app;
}

// Kufi i thjeshtë ditor për IP — mjafton për të penguar krijimin masiv të
// aplikimeve (jo mbrojtje kundër botëve të sofistikuar, shih planin).
const MAX_DRAFTS_PER_IP_PER_DAY = 8;

export async function isRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.enrollmentApplication.count({
    where: { submitterIp: ip, createdAt: { gte: since } },
  });
  return count >= MAX_DRAFTS_PER_IP_PER_DAY;
}

export function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
