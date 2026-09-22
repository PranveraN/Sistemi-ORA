import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

interface Entry {
  id: number;
  enrollDate: string;
  admissionScore?: number | null;
  originCountry?: string | null;
}

// Zbaton "Ngjit Listë" — për çdo nxënës EKZISTUES të konfirmuar, vendos datën
// që e bën të shfaqet te "Nxënës të Rinj" (+ opsionalisht pikët/origjinën, nëse
// admini i ka pranuar te ekrani i konfirmimit). Asnjë nxënës i ri s'krijohet.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entries: Entry[] = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) return NextResponse.json({ message: "Asnjë nxënës i zgjedhur." }, { status: 400 });

  const results = await prisma.$transaction(
    entries.map(e => {
      const d = new Date(e.enrollDate);
      // hideFromNewRegistrations rikthehet në false — nëse ky nxënës ishte
      // fshirë më parë nga "Nxënës të Rinj" (shih hide-from-new/route.ts),
      // "Ngjit Listë" duhet ta rishfaqë, jo ta lërë të fshehur heshtazi.
      const data: Record<string, unknown> = {
        enrollDate: isNaN(d.getTime()) ? new Date() : d,
        hideFromNewRegistrations: false,
      };
      if (e.admissionScore != null) data.admissionScore = e.admissionScore;
      if (e.originCountry) data.originCountry = e.originCountry;
      return prisma.student.update({ where: { id: e.id }, data });
    })
  );

  await logAction(session, "UPDATE", "Student", null, `Shfaqi ${results.length} nxënës ekzistues te "Nxënës të Rinj" përmes "Ngjit Listë"`);

  return NextResponse.json({ ok: true, count: results.length });
}
