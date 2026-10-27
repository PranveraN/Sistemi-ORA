import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { femijetSipasTelefonit, lexoToken } from "@/lib/lirimi";

// Fëmijët e prindit (vetëm të tijtë) + kërkesat e tij të fundit (30 ditë).
export async function GET(req: NextRequest) {
  const phone = lexoToken(req.headers.get("x-lirim-token"));
  if (!phone) return NextResponse.json({ error: "Sesioni ka skaduar. Verifikoni numrin përsëri." }, { status: 401 });

  const femijet = await femijetSipasTelefonit(phone);
  const ids = femijet.map(f => f.id);
  const kerkesat = await prisma.lirimKerkese.findMany({
    where: { telefoni: phone, studentId: { in: ids }, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, studentId: true, data: true, ora: true, arsyeja: true, marresEmri: true, statusi: true, arsyeRefuzimi: true, createdAt: true },
  });
  return NextResponse.json({
    femijet: femijet.map(f => ({ id: f.id, emri: f.emri, klasa: f.klasa })),
    kerkesat: kerkesat.map(k => ({ ...k, emri: femijet.find(f => f.id === k.studentId)?.emri ?? "" })),
  });
}
