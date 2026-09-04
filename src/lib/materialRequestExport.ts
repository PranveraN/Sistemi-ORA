import { formatDate } from "@/lib/utils";
import { REQUEST_STATUS_MAP, ITEM_STATUS_MAP } from "@/lib/materialConstants";

export interface ExportableRequestItem {
  isCustom: boolean;
  customItemName: string | null;
  material: { name: string } | null;
  quantity: number;
  approvedQuantity: number | null;
  unit: string;
  color: string | null;
  status: string;
}

export interface ExportableRequest {
  reason: string;
  comment: string | null;
  status: string;
  createdAt: string;
  teacher: { name: string };
  reviewedBy: { name: string } | null;
  reviewNote: string | null;
  sentAt: string | null;
  sentToEmail: string | null;
  subject: { id: number; name: string } | null;
  class: { id: number; name: string } | null;
  items: ExportableRequestItem[];
}

// Një rresht Excel për artikull (jo për kërkesë) — një kërkesë me shumë
// artikuj del në disa rreshta me kolonat e përbashkëta të përsëritura.
export async function exportMaterialRequestsExcel(rows: ExportableRequest[], fileName: string, includeTeacherColumn = true) {
  const XLSX = await import("xlsx");

  const headers = [
    ...(includeTeacherColumn ? ["Mësimdhënësja"] : []),
    "Artikulli", "Sasia e Kërkuar", "Sasia e Aprovuar", "Njësia", "Ngjyra", "Statusi i Artikullit",
    "Lënda/Klasa", "Arsyeja", "Statusi i Kërkesës",
    "Shqyrtuar nga", "Shënim", "Dërguar te", "Data e Kërkesës",
  ];

  const data = rows.flatMap(r => {
    const subjectOrClass = r.subject?.name || r.class?.name || "";
    const rowItems = r.items.length
      ? r.items
      : [{ isCustom: true, customItemName: "—", material: null, quantity: 0, approvedQuantity: null, unit: "", color: null, status: "" }];
    return rowItems.map(it => [
      ...(includeTeacherColumn ? [r.teacher.name] : []),
      it.isCustom ? it.customItemName : it.material?.name,
      it.quantity,
      it.approvedQuantity ?? "",
      it.unit,
      it.color || "",
      ITEM_STATUS_MAP[it.status]?.label || it.status,
      subjectOrClass,
      r.reason,
      REQUEST_STATUS_MAP[r.status]?.label || r.status,
      r.reviewedBy?.name || "",
      r.reviewNote || "",
      r.sentToEmail || "",
      formatDate(r.createdAt),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kërkesat");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
