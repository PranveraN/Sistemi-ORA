import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { formatDate } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // I mbështjellë gjithçka me try/catch — çdo përjashtim i papritur (p.sh. lidhje
  // e dështuar me bazën) përndryshe kthehej si përgjigje jo-JSON e Next.js-it,
  // dhe klienti e shihte vetëm si "Dërgimi dështoi" gjenerik, pa asnjë sqarim.
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
    const email = String(body.email ?? "").trim();
    if (!email) {
      return NextResponse.json({ error: "Email-i i marrësit mungon" }, { status: 400 });
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

    // Vetëm artikujt e aprovuar dërgohen — një kërkesë e aprovuar pjesërisht
    // s'duhet t'i porosisë furnitorit edhe artikujt e refuzuar/të papërcaktuar.
    const approvedItems = materialRequest.items.filter(it => it.status === "APPROVED");
    if (!approvedItems.length) {
      return NextResponse.json({ error: "Asnjë artikull i aprovuar për të dërguar" }, { status: 400 });
    }

    // Kërkesat e vjetra (flat, pa items[]) bien mbrapa te fusha e vjetër `item`
    // që të mos thyhet dërgimi për kërkesat e migruara/historike.
    const itemLines = materialRequest.items.length
      ? approvedItems.map(it => {
          const name = it.isCustom ? it.customItemName : it.material?.name;
          const qty = it.approvedQuantity ?? it.quantity;
          return `<tr>
            <td style="padding: 6px 0; color: #64748b;">${name}${it.color ? ` (${it.color})` : ""}</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right;">${qty} ${it.unit}</td>
          </tr>`;
        }).join("")
      : `<tr><td style="padding: 6px 0; color: #64748b;">${materialRequest.item}</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${materialRequest.quantity} ${materialRequest.unit}</td></tr>`;

    const subjectOrClassLine = materialRequest.subject?.name || materialRequest.class?.name || materialRequest.subjectOrClass;

    const subjectLine = approvedItems.length === 1
      ? `Porosi: ${approvedItems[0].isCustom ? approvedItems[0].customItemName : approvedItems[0].material?.name} × ${approvedItems[0].approvedQuantity ?? approvedItems[0].quantity} ${approvedItems[0].unit}`
      : `Porosi: ${approvedItems.length || 1} artikuj nga ${materialRequest.teacher.name}`;

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">Kërkesë e Aprovuar për Material</h2>
        <p style="color: #64748b; margin-top: 0;">Akademia Ora</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          ${itemLines}
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
          ${subjectOrClassLine ? `<tr><td style="padding: 6px 0; color: #64748b;">Lënda/Klasa</td><td style="padding: 6px 0;">${subjectOrClassLine}</td></tr>` : ""}
          <tr><td style="padding: 6px 0; color: #64748b;">Arsyeja</td><td style="padding: 6px 0;">${materialRequest.reason}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Kërkuar nga</td><td style="padding: 6px 0;">${materialRequest.teacher.name}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Data</td><td style="padding: 6px 0;">${formatDate(materialRequest.createdAt)}</td></tr>
        </table>
      </div>
    `;

    const result = await sendEmail(email, subjectLine, html);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Dërgimi dështoi" }, { status: 502 });
    }

    const updated = await prisma.materialRequest.update({
      where: { id: requestId },
      data: { sentAt: new Date(), sentToEmail: email },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gabim i papritur në server";
    console.error("[material-requests/send] gabim i papritur:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
