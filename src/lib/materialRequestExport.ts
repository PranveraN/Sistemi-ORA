import { formatDate } from "@/lib/utils";

export interface ExportableRequest {
  item: string;
  quantity: number;
  subjectOrClass: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  teacher: { name: string };
  reviewedBy: { name: string } | null;
  reviewNote: string | null;
  sentAt: string | null;
  sentToEmail: string | null;
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Në pritje",
  APPROVED: "Aprovuar",
  REJECTED: "Refuzuar",
};

export async function exportMaterialRequestsExcel(rows: ExportableRequest[], fileName: string, includeTeacherColumn = true) {
  const XLSX = await import("xlsx");

  const headers = [
    ...(includeTeacherColumn ? ["Mësimdhënësja"] : []),
    "Artikulli", "Sasia", "Lënda/Klasa", "Arsyeja", "Statusi",
    "Shqyrtuar nga", "Shënim", "Dërguar te", "Data e Kërkesës",
  ];

  const data = rows.map(r => [
    ...(includeTeacherColumn ? [r.teacher.name] : []),
    r.item,
    r.quantity,
    r.subjectOrClass || "",
    r.reason,
    STATUS_TEXT[r.status] || r.status,
    r.reviewedBy?.name || "",
    r.reviewNote || "",
    r.sentToEmail || "",
    formatDate(r.createdAt),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kërkesat");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
