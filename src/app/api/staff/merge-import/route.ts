import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { logAction } from "@/lib/audit";
import { normalizeSearch } from "@/lib/utils";

// Import "i butë" nga template-i Excel i stafit — NDRYSHE nga /api/staff/import
// (që fshin GJITHË stafin dhe e zëvendëson): këtu, rreshtat përputhen me
// stafin EKZISTUES sipas emrit (normalizuar, pa diakritikë), dhe VETËM fushat
// që ende mungojnë (janë bosh në bazë) plotësohen — asnjë e dhënë ekzistuese
// s'mbishkruhet. Nxënës/staf të papërputhur (emër i ri) krijohen si rreshta
// të rinj.

interface ImportRow {
  emri: string;
  nrPersonal?: string | null;
  dataLindjes?: string | null;
  vendlindja?: string | null;
  gjinia?: string | null;
  shtetesia?: string | null;
  telefoni?: string | null;
  email?: string | null;
  dataFillimit?: string | null;
  tipi?: string | null;
  orari?: string | null;
  niveliShkollimit?: string | null;
  profesioni?: string | null;
  pozita?: string | null;
}

const FILL_FIELDS = [
  "nrPersonal", "vendlindja", "gjinia", "shtetesia", "telefoni", "email",
  "tipi", "orari", "niveliShkollimit", "profesioni", "pozita",
] as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Të dhëna të ndjeshme të stafit (paga, llogari bankare, kontrata) — vetëm me modulin "Sekretaria"
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const body = await req.json();
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Lista është bosh." }, { status: 400 });
  }

  const existing = await prisma.staff.findMany();
  const byName = new Map(existing.map(s => [normalizeSearch(s.emri), s]));

  let updated = 0, created = 0;

  for (const row of rows) {
    const name = (row.emri || "").trim();
    if (!name) continue;
    const match = byName.get(normalizeSearch(name));

    if (match) {
      const data: Record<string, unknown> = {};
      for (const field of FILL_FIELDS) {
        if (!match[field] && row[field]) data[field] = row[field];
      }
      if (!match.dataLindjes && row.dataLindjes) data.dataLindjes = new Date(row.dataLindjes);
      if (!match.dataFillimit && row.dataFillimit) data.dataFillimit = new Date(row.dataFillimit);
      if (Object.keys(data).length > 0) {
        await prisma.staff.update({ where: { id: match.id }, data });
        updated++;
      }
    } else {
      await prisma.staff.create({
        data: {
          emri: name,
          nrPersonal: row.nrPersonal || null,
          dataLindjes: row.dataLindjes ? new Date(row.dataLindjes) : null,
          vendlindja: row.vendlindja || null,
          gjinia: row.gjinia || null,
          shtetesia: row.shtetesia || null,
          telefoni: row.telefoni || null,
          email: row.email || null,
          dataFillimit: row.dataFillimit ? new Date(row.dataFillimit) : null,
          tipi: row.tipi || null,
          orari: row.orari || null,
          niveliShkollimit: row.niveliShkollimit || null,
          profesioni: row.profesioni || null,
          pozita: row.pozita || null,
          status: "ACTIVE",
        },
      });
      created++;
    }
  }

  await logAction(session, "CREATE", "Staff", null,
    `Importoi listën e stafit nga Excel — ${updated} të plotësuar, ${created} të rinj`);

  return NextResponse.json({ updated, created });
}
