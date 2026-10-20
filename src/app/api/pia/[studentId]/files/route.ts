import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { canEditSpecialCare, canViewSpecialCare } from "@/lib/specialCarePermissions";
import { MAX_PIA_FILE_SIZE, savePiaFile } from "@/lib/pia-file-storage";

// Evidencat e PIA-s — materiale, teste, punime (të dhëna të NDJESHME).
// GET  ?year=2026 → lista (pa të fshehurat)
// POST ?year=2026 (multipart) file[], category, date, title?, goal?, note?

const PIA_FILE_CATEGORIES = ["TEST", "MATERIAL", "PUNIM", "RAPORT", "TJETER"];
const GOALS = ["R1", "R2", "R3", "R4"];
const roleOf = (s: unknown) => ((s as { user?: { role?: string } })?.user?.role) ?? "";
const yearOf = (req: NextRequest) => parseInt(req.nextUrl.searchParams.get("year") || "") || DEFAULT_ACADEMIC_YEAR;

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këto të dhëna" }, { status: 403 });
  const studentId = parseInt((await params).studentId);
  const files = await prisma.piaFile.findMany({
    where: { studentId, academicYear: yearOf(req), deletedAt: null },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { id: true, date: true, category: true, title: true, goal: true, note: true, originalFileName: true, mimeType: true, size: true, uploadedByName: true, createdAt: true },
  });
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const studentId = parseInt((await params).studentId);
  const year = yearOf(req);
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Zgjidh të paktën një skedar" }, { status: 400 });
  const big = files.find(f => f.size > MAX_PIA_FILE_SIZE);
  if (big) return NextResponse.json({ error: `"${big.name}" kalon 25MB` }, { status: 400 });

  const category = PIA_FILE_CATEGORIES.includes(String(form.get("category"))) ? String(form.get("category")) : "TJETER";
  const date = form.get("date") ? new Date(String(form.get("date"))) : new Date();
  if (isNaN(date.getTime())) return NextResponse.json({ error: "Data s'është e vlefshme" }, { status: 400 });
  const goal = GOALS.includes(String(form.get("goal"))) ? String(form.get("goal")) : null;
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const note = String(form.get("note") ?? "").trim().slice(0, 1000) || null;
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const by = (session.user as { name?: string | null }).name ?? null;

  const created = [];
  for (const f of files) {
    let saved;
    try {
      saved = await savePiaFile(Buffer.from(await f.arrayBuffer()), f.type, f.name);
    } catch (e) {
      return NextResponse.json({ error: `"${f.name}": ${(e as Error).message}`, saved: created.length }, { status: 400 });
    }
    created.push(await prisma.piaFile.create({
      data: {
        organizationId: orgId, studentId, academicYear: year, date, category, goal, note,
        title: (files.length === 1 && title) ? title : (title ? `${title} — ${f.name}` : f.name.replace(/\.[^.]+$/, "")).slice(0, 200),
        fileName: saved.fileName, originalFileName: f.name.slice(0, 255), mimeType: saved.mimeType, size: f.size, uploadedByName: by,
      },
      select: { id: true },
    }));
  }
  return NextResponse.json({ count: created.length }, { status: 201 });
}
