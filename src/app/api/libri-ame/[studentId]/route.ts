import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ studentId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await params;
  const id = parseInt(studentId);

  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      id: true, firstName: true, lastName: true, birthDate: true,
      personalNumber: true, address: true, diaryNumber: true,
      fatherName: true, fatherProf: true, motherName: true, motherProf: true,
      class: { select: { name: true, level: true } },
    },
  });

  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet" }, { status: 404 });

  let libriAme = null;
  try {
    const rows = await prisma.$queryRaw<{
      id: number; studentId: number;
      vendiLindjes: string | null; shteti: string | null;
      shtetas: string | null; komuna: string | null;
      adresaPrindit: string | null;
      notat: string | null; levizjet: string | null;
      notatFillore: string | null; levizjetFillore: string | null;
    }[]>`SELECT * FROM LibriAme WHERE studentId = ${id} LIMIT 1`;
    libriAme = rows[0] ?? null;
  } catch { /* table not yet available */ }

  return NextResponse.json({ ...student, libriAme });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await params;
  const id = parseInt(studentId);
  const body = await req.json();

  const {
    vendiLindjes = "", shteti = "", shtetas = "", komuna = "", adresaPrindit = "",
    notat, levizjet, notatFillore, levizjetFillore,
  } = body;

  const notatStr         = notat          ? JSON.stringify(notat)          : null;
  const levizjetStr      = levizjet       ? JSON.stringify(levizjet)       : null;
  const notatFStr        = notatFillore   ? JSON.stringify(notatFillore)   : null;
  const levizjetFStr     = levizjetFillore? JSON.stringify(levizjetFillore): null;
  const now = new Date().toISOString();

  try {
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM LibriAme WHERE studentId = ${id} LIMIT 1
    `;

    if (existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE LibriAme SET
          vendiLindjes    = ${vendiLindjes},
          shteti          = ${shteti},
          shtetas         = ${shtetas},
          komuna          = ${komuna},
          adresaPrindit   = ${adresaPrindit},
          notat           = ${notatStr},
          levizjet        = ${levizjetStr},
          notatFillore    = ${notatFStr},
          levizjetFillore = ${levizjetFStr},
          updatedAt       = ${now}
        WHERE studentId = ${id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO LibriAme
          (studentId, vendiLindjes, shteti, shtetas, komuna, adresaPrindit,
           notat, levizjet, notatFillore, levizjetFillore, createdAt, updatedAt)
        VALUES
          (${id}, ${vendiLindjes}, ${shteti}, ${shtetas}, ${komuna}, ${adresaPrindit},
           ${notatStr}, ${levizjetStr}, ${notatFStr}, ${levizjetFStr}, ${now}, ${now})
      `;
    }
  } catch (e) {
    console.error("LibriAme save error:", e);
    return NextResponse.json({ error: "Gabim gjatë ruajtjes" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
