import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Porosia te FurnitoriOra (paneli "Për t'u porositur"): rolet, të dhënat e
// furnitorit nga Cilësimet dhe numri i porosisë. Vetëm për administratën.

/** Rolet e administratës që shohin furnitorin dhe porositë (ADMIN = vetëm lexim, middleware bllokon shkrimet). */
export const ORDER_ADMIN_ROLES = new Set(["SUPERADMIN", "ADMIN", "FINANCE"]);
export const SUPPLIER_NAME = "FurnitoriOra";

export interface SupplierInfo {
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  schoolPhone: string;
}

/** Lexon email-in/telefonin e FurnitoriOra dhe të dhënat e shkollës nga Cilësimet (tabela Setting). */
export async function loadSupplierInfo(): Promise<SupplierInfo> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["furnitoriOraEmail", "furnitoriOraPhone", "schoolName", "schoolPhone"] } },
  });
  const v = (k: string) => rows.find(r => r.key === k)?.value?.trim() ?? "";
  return {
    name: SUPPLIER_NAME,
    email: v("furnitoriOraEmail"),
    phone: v("furnitoriOraPhone"),
    schoolName: v("schoolName") || "Akademia Ora",
    schoolPhone: v("schoolPhone"),
  };
}

/** "MAT-{vit}-{sekuencë}" — i njëjti format si te POST /api/material-orders. */
export async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.materialOrder.findFirst({
    where: { orderNumber: { startsWith: `MAT-${year}-` } },
    orderBy: { orderNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.orderNumber.split("-").pop() || "0") : 0;
  return `MAT-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}
