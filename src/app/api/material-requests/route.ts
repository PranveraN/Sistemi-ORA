import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UNIT_VALUES } from "@/lib/materialConstants";
import { sendSubmissionConfirmationEmail } from "@/lib/materialRequestEmails";
import { resolveTextItems, type IncomingTextItem } from "@/lib/materialRequestText";
import { MATERIAL_SETTING_KEYS, parseAutoCreate } from "@/lib/materialConfig";
import { ACTIVE_ORDER_LINK } from "@/lib/materialRequestStatus";

const PRIORITY_VALUES = ["NORMAL", "IMPORTANT", "URGENT"];

const REQUEST_INCLUDE = {
  teacher: { select: { name: true, email: true } },
  reviewedBy: { select: { name: true } },
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  items: {
    include: {
      material: { select: { id: true, name: true, needsColor: true, reviewStatus: true } },
      customCategory: { select: { id: true, name: true } },
      orderLinks: {
        where: ACTIVE_ORDER_LINK,
        select: { quantityContributed: true, orderItem: { select: { order: { select: { id: true, orderNumber: true, status: true } } } } },
      },
    },
    orderBy: { id: "asc" as const },
  },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const isManagement = role === "ADMIN" || role === "SUPERADMIN" || role === "FINANCE";

  const teacherIdParam = req.nextUrl.searchParams.get("teacherId");
  const filterTeacherId = isManagement && teacherIdParam ? parseInt(teacherIdParam) : null;

  const requests = await prisma.materialRequest.findMany({
    where: {
      organizationId: orgId,
      ...(isManagement
        ? (filterTeacherId ? { teacherId: filterTeacherId } : {})
        : { teacherId: userId }),
    },
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

interface IncomingItem {
  materialId?: number | string;
  isCustom?: boolean;
  customItemName?: string;
  customDescription?: string;
  customCategoryId?: number | string;
  productLink?: string;
  attachmentPath?: string;
  quantity?: number | string;
  unit?: string;
  color?: string;
  itemReason?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "TEACHER") {
    return NextResponse.json({ error: "Vetëm mësimdhënësit mund të dërgojnë kërkesa" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  // Forma e re e mësuesit (tekst i lirë / zgjedhje nga katalogu) — rruga e vjetër më poshtë mbetet e paprekur
  if (body.mode === "TEXT" || body.mode === "CATALOG") return createFromNewForm(body, userId, orgId);
  const reason = String(body.reason ?? "").trim();
  const comment = body.comment ? String(body.comment).trim() : null;
  const priority = PRIORITY_VALUES.includes(String(body.priority)) ? String(body.priority) : "NORMAL";
  const dateNeeded = body.dateNeeded ? new Date(body.dateNeeded) : null;

  const rawItems: IncomingItem[] = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length || !reason) {
    return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });
  }

  // Validime paraprake (para se të krijojmë diçka në bazë) — kthejmë gabime
  // të qarta në vend që t'i lëmë t'i kapë Prisma si dështim gjenerik.
  let classId: number | null = null;
  if (body.classId) {
    const cls = await prisma.class.findFirst({ where: { id: parseInt(String(body.classId)), organizationId: orgId } });
    if (!cls) return NextResponse.json({ error: "Klasa e zgjedhur nuk ekziston" }, { status: 400 });
    classId = cls.id;
  }

  let subjectId: number | null = null;
  if (body.subjectId) {
    const subject = await prisma.subject.findFirst({ where: { id: parseInt(String(body.subjectId)), organizationId: orgId } });
    if (!subject) return NextResponse.json({ error: "Lënda e zgjedhur nuk ekziston" }, { status: 400 });
    subjectId = subject.id;
  }

  const itemsData: {
    materialId: number | null;
    isCustom: boolean;
    customItemName: string | null;
    customDescription: string | null;
    customCategoryId: number | null;
    productLink: string | null;
    attachmentPath: string | null;
    quantity: number;
    unit: string;
    color: string | null;
    itemReason: string | null;
  }[] = [];

  for (const raw of rawItems) {
    const quantity = Math.max(1, parseInt(String(raw.quantity)) || 1);
    const unit = UNIT_VALUES.includes(String(raw.unit)) ? String(raw.unit) : "copë";
    const color = raw.color ? String(raw.color).trim() || null : null;
    const itemReason = raw.itemReason ? String(raw.itemReason).trim() || null : null;

    if (raw.isCustom) {
      const customItemName = String(raw.customItemName ?? "").trim();
      if (!customItemName) continue;

      let customCategoryId: number | null = null;
      if (raw.customCategoryId) {
        const cat = await prisma.materialCategory.findFirst({ where: { id: parseInt(String(raw.customCategoryId)), organizationId: orgId } });
        if (!cat) return NextResponse.json({ error: "Kategoria e zgjedhur nuk ekziston" }, { status: 400 });
        customCategoryId = cat.id;
      }

      itemsData.push({
        materialId: null,
        isCustom: true,
        customItemName,
        customDescription: raw.customDescription ? String(raw.customDescription).trim() || null : null,
        customCategoryId,
        productLink: raw.productLink ? String(raw.productLink).trim() || null : null,
        attachmentPath: raw.attachmentPath ? String(raw.attachmentPath).trim() || null : null,
        quantity, unit, color, itemReason,
      });
    } else {
      const materialId = parseInt(String(raw.materialId ?? ""));
      if (!materialId) continue;
      const material = await prisma.material.findFirst({ where: { id: materialId, organizationId: orgId, active: true } });
      if (!material) return NextResponse.json({ error: "Një nga materialet e zgjedhura nuk ekziston më" }, { status: 400 });

      itemsData.push({
        materialId: material.id,
        isCustom: false,
        customItemName: null, customDescription: null, customCategoryId: null,
        productLink: null,
        attachmentPath: raw.attachmentPath ? String(raw.attachmentPath).trim() || null : null,
        quantity, unit, color, itemReason,
      });
    }
  }

  if (!itemsData.length) {
    return NextResponse.json({ error: "Shto të paktën një artikull të vlefshëm" }, { status: 400 });
  }

  const created = await prisma.materialRequest.create({
    data: {
      teacherId: userId,
      organizationId: orgId,
      reason,
      comment,
      priority,
      dateNeeded,
      classId,
      subjectId,
      status: "SUBMITTED",
      submittedAt: new Date(),
      items: { create: itemsData },
      statusHistory: {
        create: { fromStatus: null, toStatus: "SUBMITTED", changedById: userId },
      },
    },
    include: REQUEST_INCLUDE,
  });

  // Best-effort — një dështim i email-it (p.sh. RESEND_API_KEY mungon) s'duhet
  // ta bëjë dështim vetë krijimin e kërkesës, tashmë të ruajtur në bazë.
  sendSubmissionConfirmationEmail(created).catch(() => {});

  return NextResponse.json(created, { status: 201 });
}

/* ─── Forma e re e mësuesit ─────────────────────────────────────────────── */

interface NewFormBody {
  mode: "TEXT" | "CATALOG";
  originalText?: string;
  items?: IncomingTextItem[];
  classScope?: string;
  classId?: number | string;
  classIds?: (number | string)[];
  subjectId?: number | string;
  priority?: string;
  urgencyReason?: string;
  dateNeeded?: string;
  attachmentPath?: string;
  productLink?: string;
  comment?: string;
}

async function createFromNewForm(body: NewFormBody, userId: number, orgId: number) {
  const fail = (field: string, error: string) => NextResponse.json({ error, field }, { status: 400 });
  const mode = body.mode;
  const originalText = mode === "TEXT" ? String(body.originalText ?? "").trim().slice(0, 4000) : "";
  if (mode === "TEXT" && originalText.length < 3) return fail("text", "Shkruaj çka të nevojitet.");

  const priority = body.priority === "URGENT" ? "URGENT" : "NORMAL";
  const urgencyReason = String(body.urgencyReason ?? "").trim().slice(0, 500);
  if (priority === "URGENT" && urgencyReason.length < 3) return fail("urgencyReason", "Shkruaj shkurt arsyen e urgjencës.");

  // Për klasën: një klasë / disa klasa / për mua
  const classScope = ["CLASS", "MULTI", "SELF"].includes(String(body.classScope)) ? String(body.classScope) : "CLASS";
  let classId: number | null = null;
  let classIdsJson: string | null = null;
  if (classScope === "CLASS") {
    const c = await prisma.class.findFirst({ where: { id: parseInt(String(body.classId ?? "")) || 0, organizationId: orgId } });
    if (!c) return fail("class", "Zgjidh klasën.");
    classId = c.id;
  } else if (classScope === "MULTI") {
    const ids = (Array.isArray(body.classIds) ? body.classIds : []).map(x => parseInt(String(x))).filter(n => n > 0);
    const found = await prisma.class.findMany({ where: { id: { in: ids }, organizationId: orgId }, select: { id: true } });
    if (found.length < 2) return fail("class", "Zgjidh të paktën dy klasa.");
    classIdsJson = JSON.stringify(found.map(c => c.id));
  }

  let subjectId: number | null = null;
  if (body.subjectId) {
    const s = await prisma.subject.findFirst({ where: { id: parseInt(String(body.subjectId)) || 0, organizationId: orgId } });
    if (!s) return fail("subject", "Lënda e zgjedhur nuk ekziston.");
    subjectId = s.id;
  }
  const dateNeeded = body.dateNeeded ? new Date(body.dateNeeded) : null;
  if (dateNeeded && isNaN(dateNeeded.getTime())) return fail("dateNeeded", "Data nuk është e vlefshme.");

  const rawItems: IncomingTextItem[] = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
  if (mode === "CATALOG" && !rawItems.some(i => parseInt(String(i.materialId ?? "")) > 0)) return fail("items", "Zgjidh të paktën një artikull nga katalogu.");

  const autoCreate = parseAutoCreate((await prisma.setting.findUnique({ where: { key: MATERIAL_SETTING_KEYS.autoCreateItems } }))?.value);
  const comment = body.comment ? String(body.comment).trim().slice(0, 1000) || null : null;
  const productLink = body.productLink ? String(body.productLink).trim().slice(0, 500) || null : null;
  const attachmentPath = body.attachmentPath ? String(body.attachmentPath).trim().slice(0, 200) || null : null;

  let createdMaterials = 0;
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.materialRequest.create({
      data: {
        teacherId: userId, organizationId: orgId, status: "SUBMITTED", submittedAt: new Date(),
        reason: mode === "TEXT" ? originalText.slice(0, 500) : (comment ?? "Kërkesë nga katalogu"),
        comment, priority, dateNeeded, classId, subjectId, mode, classScope, classIdsJson,
        originalText: mode === "TEXT" ? originalText : null,
        urgencyReason: priority === "URGENT" ? urgencyReason : null,
        attachmentPath, productLink,
        statusHistory: { create: { fromStatus: null, toStatus: "SUBMITTED", changedById: userId } },
      },
    });
    const items = mode === "TEXT"
      ? rawItems
      : rawItems.map(i => ({ materialId: i.materialId, quantity: i.quantity, unit: i.unit, matchType: "catalog" }));
    const r = await resolveTextItems(tx, { orgId, userId, requestId: request.id, originalText, items, autoCreate });
    if (r.error) throw new Error(`VALIDIM:${r.error}`);
    if (!r.rows.length) throw new Error("VALIDIM:S'u gjet asnjë material në tekst — shkruaj p.sh. \"10 markera për tabelë\".");
    createdMaterials = r.createdMaterials;
    await tx.materialRequestItem.createMany({ data: r.rows.map(row => ({ ...row, requestId: request.id })) });
    return tx.materialRequest.findUnique({ where: { id: request.id }, include: REQUEST_INCLUDE });
  }).catch((e: unknown) => {
    const msg = e instanceof Error && e.message.startsWith("VALIDIM:") ? e.message.slice(8) : null;
    if (msg) return { validationError: msg } as const;
    throw e;
  });

  if (result && "validationError" in result) return fail(mode === "TEXT" ? "text" : "items", result.validationError);
  if (result) sendSubmissionConfirmationEmail(result).catch(() => {});
  return NextResponse.json({ ...result, createdMaterials, autoCreate }, { status: 201 });
}
