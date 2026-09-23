import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "FINANCE") {
      return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
    }

    const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
    const { id } = await params;
    const requestId = parseInt(id);

    const body = await req.json();
    const phone = String(body.phone ?? "").trim();
    if (!phone) {
      return NextResponse.json({ error: "Numri i telefonit i marrësit mungon" }, { status: 400 });
    }

    const materialRequest = await prisma.materialRequest.findFirst({
      where: { id: requestId, organizationId: orgId },
      include: {
        teacher: { select: { name: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
        items: { include: { material: { select: { name: true } } }, orderBy: { id: "asc" } },
      },
    });
    if (!materialRequest) {
      return NextResponse.json({ error: "Kërkesa nuk u gjet" }, { status: 404 });
    }
    if (materialRequest.status !== "APPROVED" && materialRequest.status !== "PARTIALLY_APPROVED") {
      return NextResponse.json({ error: "Vetëm kërkesat e aprovuara (plotësisht ose pjesërisht) mund të dërgohen" }, { status: 400 });
    }

    const approvedItems = materialRequest.items.filter(it => it.status === "APPROVED");
    if (!approvedItems.length) {
      return NextResponse.json({ error: "Asnjë artikull i aprovuar për të dërguar" }, { status: 400 });
    }

    // SMS-të kanë kufi karakteresh — jo tabelë HTML si te email, vetëm një
    // listë e shkurtër "Emri x Sasi", e ndarë me presje.
    const itemLines = materialRequest.items.length
      ? approvedItems.map(it => {
          const name = it.isCustom ? it.customItemName : it.material?.name;
          const qty = it.approvedQuantity ?? it.quantity;
          return `${name}${it.color ? ` (${it.color})` : ""} x${qty}${it.unit ? ` ${it.unit}` : ""}`;
        }).join(", ")
      : `${materialRequest.item} x${materialRequest.quantity}${materialRequest.unit ? ` ${materialRequest.unit}` : ""}`;

    const subjectOrClassLine = materialRequest.subject?.name || materialRequest.class?.name || materialRequest.subjectOrClass;

    const message = [
      "Porosi Akademia Ora:",
      itemLines,
      subjectOrClassLine ? `(${subjectOrClassLine})` : null,
      `Kërkuar nga ${materialRequest.teacher.name}`,
    ].filter(Boolean).join(" ");

    const result = await sendSms(phone, message);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Dërgimi dështoi" }, { status: 502 });
    }

    const updated = await prisma.materialRequest.update({
      where: { id: requestId },
      data: { sentSmsAt: new Date(), sentToPhone: phone },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gabim i papritur në server";
    console.error("[material-requests/send-sms] gabim i papritur:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
