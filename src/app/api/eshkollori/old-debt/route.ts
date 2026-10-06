import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requireEshkollori, getCategory, logChange, paymentStatus, round, yearLabel, OLD_DEBT, OLD_DEBT_CLOSED } from "@/lib/eshkollori";

// Borxhi i vjetër (Payment "BORXH_VJETER", një rresht për vit):
//   POST  { studentId, year, amount, reason }                       → shto / ndrysho për atë vit
//   PATCH { studentId, debtIds, action: EDIT|FORGIVE|VOID, amount?, reason }
// Falja dhe fshirja s'e heqin rreshtin nga databaza: statusi FORGIVEN / VOID, bilanci 0.

export async function POST(req: NextRequest) {
  const session = await auth();
  const a = requireEshkollori(session, true);
  if (a instanceof NextResponse) return a;
  const body = await req.json().catch(() => ({}));
  const studentId = parseInt(String(body.studentId)) || 0;
  const year = parseInt(String(body.year)) || 0;
  const amount = round(parseFloat(String(body.amount ?? "").replace(",", ".")) || 0);
  const reason = String(body.reason ?? "").trim();
  if (!studentId || year < 2000) return NextResponse.json({ error: "Zgjidhni vitin.", field: "year" }, { status: 400 });
  if (amount <= 0) return NextResponse.json({ error: "Shkruani shumën.", field: "amount" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Shkruani arsyen.", field: "reason" }, { status: 400 });

  const cat = await getCategory(a.orgId);
  if (!cat) return NextResponse.json({ error: "Kategoria e Eshkollorit s'ekziston." }, { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId: a.orgId }, select: { firstName: true, lastName: true } });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet." }, { status: 404 });

  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({ where: { studentId, categoryId: cat.id, description: OLD_DEBT, year, status: { notIn: OLD_DEBT_CLOSED } } });
    if (existing) {
      if (amount < existing.paidAmount) throw new Error(`Shuma s'mund të jetë më e vogël se sa është paguar (${existing.paidAmount.toFixed(2)} €).`);
      const updated = await tx.payment.update({
        where: { id: existing.id },
        data: { amount, finalAmount: amount, balance: round(amount - existing.paidAmount), status: amount - existing.paidAmount > 0.004 ? "OVERDUE" : "PAID" },
      });
      await logChange(tx, a, { studentId, categoryId: cat.id, year, action: "OLD_DEBT_EDIT", oldValue: existing.finalAmount, newValue: amount, reason, refId: existing.id });
      return updated;
    }
    const created = await tx.payment.create({
      data: {
        organizationId: a.orgId, studentId, categoryId: cat.id, amount, discount: 0, discountType: "fixed", scholarship: 0,
        finalAmount: amount, paidAmount: 0, balance: amount, status: "OVERDUE", description: OLD_DEBT,
        note: reason, dueDate: new Date(year, 8, 1), year, month: null,
      },
    });
    await logChange(tx, a, { studentId, categoryId: cat.id, year, action: "OLD_DEBT_ADD", newValue: amount, reason, refId: created.id });
    return created;
  }).catch((e: unknown) => (e instanceof Error ? e : new Error("Gabim")));
  if (row instanceof Error) return NextResponse.json({ error: row.message }, { status: 400 });

  await logAction(session, "UPDATE", "Payment", row.id, `Eshkollori: borxh i vjetër ${yearLabel(year)} për ${student.firstName} ${student.lastName} — ${amount.toFixed(2)} € (${reason})`);
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const a = requireEshkollori(session, true);
  if (a instanceof NextResponse) return a;
  const body = await req.json().catch(() => ({}));
  const studentId = parseInt(String(body.studentId)) || 0;
  const ids: number[] = Array.isArray(body.debtIds) ? body.debtIds.map((x: unknown) => parseInt(String(x))).filter(Boolean) : [];
  const action = ["EDIT", "FORGIVE", "VOID"].includes(body.action) ? body.action as "EDIT" | "FORGIVE" | "VOID" : null;
  const reason = String(body.reason ?? "").trim();
  if (!studentId || !ids.length || !action) return NextResponse.json({ error: "Zgjidhni çka dëshironi të bëni.", field: "action" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Shkruani arsyen.", field: "reason" }, { status: 400 });
  const amount = action === "EDIT" ? round(parseFloat(String(body.amount ?? "").replace(",", ".")) || 0) : 0;
  if (action === "EDIT" && (ids.length !== 1 || amount <= 0)) {
    return NextResponse.json({ error: ids.length !== 1 ? "Zgjidhni një vit për ta ndryshuar." : "Shkruani shumën e re.", field: ids.length !== 1 ? "year" : "amount" }, { status: 400 });
  }

  const cat = await getCategory(a.orgId);
  if (!cat) return NextResponse.json({ error: "Kategoria e Eshkollorit s'ekziston." }, { status: 404 });
  const rows = await prisma.payment.findMany({
    where: { id: { in: ids }, studentId, categoryId: cat.id, description: OLD_DEBT, status: { notIn: OLD_DEBT_CLOSED }, student: { organizationId: a.orgId } },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
  if (rows.length !== ids.length) return NextResponse.json({ error: "Borxhi i vjetër s'u gjet (mund të jetë ndryshuar ndërkohë)." }, { status: 404 });

  const total = round(rows.reduce((s, r) => s + r.balance, 0));
  const err = await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      if (action === "EDIT") {
        if (amount < r.paidAmount) return `Shuma s'mund të jetë më e vogël se sa është paguar (${r.paidAmount.toFixed(2)} €).`;
        await tx.payment.update({ where: { id: r.id }, data: { amount, finalAmount: amount, balance: round(amount - r.paidAmount), status: amount - r.paidAmount > 0.004 ? "OVERDUE" : paymentStatus(amount, r.paidAmount) } });
        await logChange(tx, a, { studentId, categoryId: cat.id, year: r.year, action: "OLD_DEBT_EDIT", oldValue: r.finalAmount, newValue: amount, reason, refId: r.id });
      } else {
        const tag = action === "FORGIVE" ? "I falur" : "I fshirë (gabim)";
        await tx.payment.update({
          where: { id: r.id },
          data: { status: action === "FORGIVE" ? "FORGIVEN" : "VOID", balance: 0, note: `${tag}: ${reason}${r.note ? ` · ${r.note}` : ""}` },
        });
        await logChange(tx, a, { studentId, categoryId: cat.id, year: r.year, action: action === "FORGIVE" ? "OLD_DEBT_FORGIVE" : "OLD_DEBT_VOID", oldValue: r.balance, newValue: 0, reason, refId: r.id });
      }
    }
    return null;
  });
  if (err) return NextResponse.json({ error: err, field: "amount" }, { status: 400 });

  const s = rows[0].student;
  const verb = action === "EDIT" ? `ndryshoi në ${amount.toFixed(2)} €` : action === "FORGIVE" ? `fali ${total.toFixed(2)} €` : `fshiu (gabim) ${total.toFixed(2)} €`;
  await logAction(session, action === "VOID" ? "DELETE" : "UPDATE", "Payment", rows[0].id,
    `Eshkollori: borxhi i vjetër i ${s.firstName} ${s.lastName} — ${verb} (${rows.map(r => (r.year ? yearLabel(r.year) : "?")).join(", ")}) — ${reason}`);
  return NextResponse.json({ ok: true, total });
}
