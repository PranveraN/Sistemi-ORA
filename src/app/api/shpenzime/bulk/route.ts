import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actions = await prisma.shpenzimBulkAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json(
    actions.map(a => ({
      id: a.id,
      action: a.action,
      count: a.count,
      undone: a.undone,
      createdAt: a.createdAt,
      userName: a.user.name,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map((n: unknown) => parseInt(String(n))) : [];
  const isDelete = body.action === "DELETE";

  if (!ids.length) return NextResponse.json({ error: "Asnjë rresht i zgjedhur" }, { status: 400 });
  if (!isDelete && (!body.patch || typeof body.patch !== "object")) {
    return NextResponse.json({ error: "Mungon patch-i" }, { status: 400 });
  }

  const userId = parseInt((session.user as { id?: string })?.id ?? "0");

  try {
    const result = await prisma.$transaction(async tx => {
      const rows = await tx.shpenzim.findMany({ where: { id: { in: ids } } });
      if (!rows.length) throw new Error("Rreshtat nuk u gjetën");

      const bulkAction = await tx.shpenzimBulkAction.create({
        data: {
          userId,
          action: isDelete ? "DELETE" : "PATCH",
          snapshot: JSON.stringify(rows),
          count: rows.length,
        },
      });

      if (isDelete) {
        const withPays = await tx.shpenzimPagese.groupBy({ by: ["shpenzimId"], where: { shpenzimId: { in: ids } } });
        if (withPays.length) throw new Error(`${withPays.length} nga faturat e zgjedhura kanë pagesa pjesë-pjesë. Fshini pagesat e tyre së pari, ose hiqini nga zgjedhja.`);
        // Fshirje logjike — rreshtat mbeten në databazë
        await tx.shpenzim.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), deletedById: userId || null, deletedByName: (session.user as { name?: string | null }).name ?? null } });
      } else {
        // Faturat me pagesa pjesë-pjesë: statusi "paguar" rrjedh nga pagesat — s'ndryshohet në grup
        const { paguar, ...rest } = body.patch as Record<string, unknown>;
        if (paguar !== undefined) {
          await tx.shpenzim.updateMany({ where: { id: { in: ids }, mePagesa: false }, data: { ...rest, paguar } as never });
          if (Object.keys(rest).length) await tx.shpenzim.updateMany({ where: { id: { in: ids }, mePagesa: true }, data: rest as never });
        } else {
          await tx.shpenzim.updateMany({ where: { id: { in: ids } }, data: body.patch });
        }
        // Kategoria e re kalon edhe te pagesat e faturave
        if (rest.kategoriId != null) await tx.shpenzimPagese.updateMany({ where: { shpenzimId: { in: ids } }, data: { kategoriId: Number(rest.kategoriId) } });
      }

      return { bulkActionId: bulkAction.id, count: rows.length };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
