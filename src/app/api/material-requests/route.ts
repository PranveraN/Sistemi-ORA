import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UNIT_VALUES } from "@/lib/materialConstants";

const PRIORITY_VALUES = ["NORMAL", "IMPORTANT", "URGENT"];

const REQUEST_INCLUDE = {
  teacher: { select: { name: true, email: true } },
  reviewedBy: { select: { name: true } },
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  items: {
    include: {
      material: { select: { id: true, name: true, needsColor: true } },
      customCategory: { select: { id: true, name: true } },
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

  const isManagement = role === "ADMIN" || role === "FINANCE";

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

  return NextResponse.json(created, { status: 201 });
}
