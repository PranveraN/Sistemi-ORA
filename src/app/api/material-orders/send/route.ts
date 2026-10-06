import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { recomputeRequestStatuses, notifyStatusChanges, ACTIVE_ORDER_LINK } from "@/lib/materialRequestStatus";
import { loadSupplierInfo, nextOrderNumber, ORDER_ADMIN_ROLES } from "@/lib/supplierOrder";
import { buildEmailHtml, toSmsSafe } from "@/lib/supplierOrderText";

// Dërgimi i porosisë te FurnitoriOra me SMS dhe/ose email (paneli "Për t'u
// porositur" dhe "Dërgo përsëri" te Porositë). Vetëm administrata.
// Porosia (MaterialOrder, statusi ORDERED) krijohet VETËM kur të paktën një
// kanal ka sukses — atëherë artikujt/kërkesat kalojnë në "Porositur".

interface LineIn {
  materialId?: number | null;
  customItemName?: string | null;
  name: string;
  color?: string | null;
  unit: string;
  quantity: number;
  requestItemIds?: number[];
}

/** Kërkesat që lejohen te "Për t'u porositur" (jo Në pritje / Në shqyrtim). */
const ORDERABLE_REQUEST = { status: { in: ["APPROVED", "PARTIALLY_APPROVED", "ORDERED"] } };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id?: string; role?: string; name?: string | null; email?: string | null; organizationId?: number };
  if (!ORDER_ADMIN_ROLES.has(user.role ?? "")) {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const userId = Number(user.id);
  const orgId = user.organizationId ?? 1;

  const body = await req.json().catch(() => ({}));
  const lines: LineIn[] = Array.isArray(body.lines) ? body.lines : [];
  const wantSms = !!body.channels?.sms;
  const wantEmail = !!body.channels?.email;
  const resendOrderId = body.orderId ? parseInt(String(body.orderId)) : null;

  if (!lines.length) return NextResponse.json({ error: "Zgjidhni të paktën një artikull." }, { status: 400 });
  if (!wantSms && !wantEmail) return NextResponse.json({ error: "Zgjidhni të paktën një mënyrë dërgimi (SMS ose Email)." }, { status: 400 });
  for (const l of lines) {
    if (!String(l.name ?? "").trim() || !(Number(l.quantity) > 0)) {
      return NextResponse.json({ error: "Çdo artikull duhet të ketë emër dhe sasi më të madhe se 0." }, { status: 400 });
    }
  }

  const supplier = await loadSupplierInfo();
  if (wantSms && !supplier.phone) return NextResponse.json({ error: "Telefoni i furnitorit mungon te Cilësimet." }, { status: 400 });
  if (wantEmail && !supplier.email) return NextResponse.json({ error: "Email-i i furnitorit mungon te Cilësimet." }, { status: 400 });

  // ── Porosi e re: artikujt e kërkesave duhet të jenë ende për t'u porositur ──
  let contributions: { line: LineIn; links: { requestItemId: number; quantity: number }[] }[] = [];
  let resendOrder: { id: number; orderNumber: string } | null = null;
  if (resendOrderId) {
    resendOrder = await prisma.materialOrder.findFirst({ where: { id: resendOrderId, organizationId: orgId }, select: { id: true, orderNumber: true } });
    if (!resendOrder) return NextResponse.json({ error: "Porosia nuk u gjet." }, { status: 404 });
  } else {
    const ids = [...new Set(lines.flatMap(l => l.requestItemIds ?? []))];
    if (!ids.length || lines.some(l => !l.requestItemIds?.length)) {
      return NextResponse.json({ error: "Artikujt duhet të vijnë nga kërkesat e aprovuara." }, { status: 400 });
    }
    const items = await prisma.materialRequestItem.findMany({
      where: { id: { in: ids }, status: "APPROVED", approvedQuantity: { gt: 0 }, request: { organizationId: orgId, ...ORDERABLE_REQUEST } },
      select: { id: true, approvedQuantity: true, orderLinks: { where: ACTIVE_ORDER_LINK, select: { quantityContributed: true } } },
    });
    const remaining = new Map(items.map(it => [it.id, (it.approvedQuantity ?? 0) - it.orderLinks.reduce((s, l) => s + l.quantityContributed, 0)]));
    for (const id of ids) {
      if (!((remaining.get(id) ?? 0) > 0)) {
        return NextResponse.json({ error: "Lista e artikujve ka ndryshuar ndërkohë — rifreskoni faqen dhe provoni përsëri." }, { status: 409 });
      }
    }
    // Çdo artikull kërkese porositet i tëri (sasia e mbetur); sasia e rreshtit mund të ndryshohet me stepper.
    contributions = lines.map(line => ({ line, links: (line.requestItemIds ?? []).map(id => ({ requestItemId: id, quantity: remaining.get(id)! })) }));
  }

  // ── Tekstet ──
  const textLines = lines.map(l => ({ name: String(l.name).trim(), quantity: Math.round(Number(l.quantity)), unit: l.unit || null }));
  const smsText = wantSms ? toSmsSafe(String(body.smsText ?? "").trim()) : null;
  const subject = wantEmail ? String(body.emailSubject ?? "").trim() : null;
  const emailHtml = wantEmail ? buildEmailHtml(textLines, String(body.emailIntro ?? ""), String(body.emailClosing ?? "")) : null;
  if (wantSms && !smsText) return NextResponse.json({ error: "Teksti i SMS-it është bosh." }, { status: 400 });
  if (wantEmail && !subject) return NextResponse.json({ error: "Subjekti i email-it është bosh." }, { status: 400 });

  // ── Dërgimi ──
  const [sms, email] = await Promise.all([
    wantSms ? sendSms(supplier.phone, smsText!) : Promise.resolve(null),
    wantEmail ? sendEmail(supplier.email, subject!, emailHtml!, undefined, { replyTo: user.email || undefined }) : Promise.resolve(null),
  ]);
  const anyOk = !!sms?.ok || !!email?.ok;
  const channels = [wantSms && "SMS", wantEmail && "EMAIL"].filter(Boolean).join(",");

  // ── Porosia + statuset (vetëm kur ka sukses të paktën një kanal) ──
  let order = resendOrder;
  if (anyOk && !resendOrder) {
    const sentVia = [sms?.ok && "SMS", email?.ok && "email"].filter(Boolean).join(" + ");
    const result = await prisma.$transaction(async (tx) => {
      const orderNumber = await nextOrderNumber(tx);
      const created = await tx.materialOrder.create({
        data: {
          organizationId: orgId,
          orderNumber,
          status: "ORDERED",
          notes: `Dërguar te ${supplier.name} me ${sentVia}`,
          totalItems: contributions.length,
          totalQuantity: contributions.reduce((s, c) => s + Math.round(Number(c.line.quantity)), 0),
          createdById: userId,
          items: {
            create: contributions.map(({ line, links }) => ({
              materialId: line.materialId ?? null,
              customItemName: line.materialId ? null : (line.customItemName || line.name).trim(),
              color: line.color || null,
              unit: line.unit,
              quantity: Math.round(Number(line.quantity)),
              requestLinks: { create: links.map(l => ({ requestItemId: l.requestItemId, quantityContributed: l.quantity })) },
            })),
          },
        },
        select: { id: true, orderNumber: true, items: { select: { requestLinks: { select: { requestItem: { select: { requestId: true } } } } } } },
      });
      const requestIds = [...new Set(created.items.flatMap(i => i.requestLinks.map(l => l.requestItem.requestId)))];
      const changes = await recomputeRequestStatuses(tx, requestIds, userId, `Porositur te ${supplier.name}`);
      return { created, changes };
    });
    notifyStatusChanges(result.changes).catch(() => {});
    order = { id: result.created.id, orderNumber: result.created.orderNumber };
  }

  const dispatch = await prisma.materialOrderDispatch.create({
    data: {
      organizationId: orgId,
      orderId: order?.id ?? null,
      supplierName: supplier.name,
      toEmail: wantEmail ? supplier.email : null,
      toPhone: wantSms ? supplier.phone : null,
      replyTo: wantEmail ? user.email ?? null : null,
      channels,
      smsText, emailSubject: subject, emailHtml,
      itemsJson: JSON.stringify(textLines),
      smsStatus: sms ? (sms.ok ? "SENT" : "FAILED") : null,
      smsError: sms && !sms.ok ? sms.error ?? "Dërgimi dështoi" : null,
      emailStatus: email ? (email.ok ? "SENT" : "FAILED") : null,
      emailError: email && !email.ok ? email.error ?? "Dërgimi dështoi" : null,
      sentById: userId,
      sentByName: user.name ?? null,
    },
  });

  await logAction(session, "CREATE", "MaterialOrderDispatch", dispatch.id,
    `${resendOrder ? "Ridërgoi" : "Dërgoi"} porosinë${order ? ` ${order.orderNumber}` : ""} te ${supplier.name} (${channels}) — SMS: ${dispatch.smsStatus ?? "–"}, email: ${dispatch.emailStatus ?? "–"}`);

  return NextResponse.json({
    dispatchId: dispatch.id,
    orderId: order?.id ?? null,
    orderNumber: order?.orderNumber ?? null,
    supplierName: supplier.name,
    orderedItems: resendOrder ? 0 : anyOk ? lines.length : 0,
    sms: sms && { ok: sms.ok, error: sms.error ?? null },
    email: email && { ok: email.ok, error: email.error ?? null },
  }, { status: anyOk ? 201 : 502 });
}
