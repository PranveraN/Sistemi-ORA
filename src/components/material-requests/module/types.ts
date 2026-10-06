import type { MaterialRequestRow, PendingItem } from "../admin/types";

// Të dhënat e përbashkëta të modulit "Materialet" (ngarkohen një herë nga shell-i).

export interface OrderItemRow {
  id: number;
  materialId: number | null;
  material: { id: number; name: string } | null;
  customItemName: string | null;
  color: string | null;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  receivedQuantity: number;
  requestLinks: { requestItem: { id: number; color: string | null; request: { id: number; teacher: { name: string } } } }[];
}

export interface DispatchRow {
  id: number; channels: string; createdAt: string; sentByName: string | null;
  smsStatus: string | null; smsError: string | null; emailStatus: string | null; emailError: string | null;
}

export interface OrderRow {
  id: number;
  orderNumber: string;
  status: string;
  supplier: { id: number; emri: string } | null;
  orderDate: string;
  expectedDeliveryDate: string | null;
  receivedDate: string | null;
  notes: string | null;
  totalItems: number;
  totalQuantity: number;
  estimatedCost: number;
  actualCost: number;
  createdBy: { name: string };
  items: OrderItemRow[];
  dispatches?: DispatchRow[];
}

export interface ModuleData {
  requests: MaterialRequestRow[];
  orders: OrderRow[];
  ordersError: string;
  pending: PendingItem[];
  newItemsCount: number;
  leadDays: number;
  loading: boolean;
  reload: () => Promise<void>;
  /** Tab-i aktiv regjistron funksionin e "Eksporto Excel". */
  setExporter: (fn: (() => void) | null) => void;
  canAct: boolean;
}

export const orderItemName = (it: OrderItemRow) => `${it.material?.name || it.customItemName || "Artikull"}${it.color ? ` (${it.color})` : ""}`;

/** Furnitori i porosisë: nga katalogu (Sipartner), ose FurnitoriOra kur u dërgua me SMS/email. */
export const orderSupplier = (o: OrderRow) => o.supplier?.emri ?? (o.dispatches?.length ? "FurnitoriOra" : "Pa furnitor");
