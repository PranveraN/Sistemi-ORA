import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Fshirja e një pagese pjesore të faturës. Arsyeja është e detyrueshme (middleware,
// header X-Audit-Reason) dhe ruhet te gjurma e auditimit. Statusi i faturës rillogaritet.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr, pid: pidStr } = await params;
  const id = parseInt(idStr) || 0, pid = parseInt(pidStr) || 0;
  const p = await prisma.shpenzimPagese.findFirst({ where: { id: pid, shpenzimId: id } });
  if (!p) return NextResponse.json({ error: "Pagesa s'u gjet." }, { status: 404 });
  const s = await prisma.shpenzim.findUnique({ where: { id }, select: { shuma: true, nrFature: true } });
  await prisma.$transaction(async tx => {
    await tx.shpenzimPagese.delete({ where: { id: pid } });
    const rest = await tx.shpenzimPagese.aggregate({ where: { shpenzimId: id }, _sum: { shumaCents: true } });
    // mePagesa mbetet true: fatura vazhdon të ndiqet sipas pagesave (tani më pak e paguar)
    await tx.shpenzim.update({ where: { id }, data: { paguar: (rest._sum.shumaCents ?? 0) >= Math.round((s?.shuma ?? 0) * 100) } });
  });
  await logAction(session, "DELETE", "ShpenzimPagese", id, `Fshiu pagesën ${(p.shumaCents / 100).toFixed(2)} € (${p.metoda}) të faturës ${s?.nrFature ?? `#${id}`}`);
  return NextResponse.json({ ok: true });
}
