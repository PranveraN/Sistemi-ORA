// Tabelat financiare që auditohen nga triggers (src/lib/audit/triggers.ts).
// Emri i tabelës në SQLite = emri i modelit Prisma (pa @@map në këtë projekt).
// `columns` kufizon gjurmën te kolonat financiare (p.sh. Student: zbritja,
// plani, statusi, datat e regjistrimit/largimit — jo telefonat apo adresa).

export interface AuditedTable {
  table: string;
  columns?: string[];
}

export const AUDITED_TABLES: AuditedTable[] = [
  { table: "Payment" },
  { table: "FamilyReceipt" },
  { table: "Invoice" },
  { table: "InvoiceItem" },
  { table: "Expense" },
  { table: "Shpenzim" },
  { table: "ShpenzimPagese" },
  { table: "Hyra" },
  { table: "Investim" },
  { table: "UniSale" },
  { table: "UniSaleItem" },
  { table: "UniPayment" },
  { table: "UniHandover" },
  { table: "BookSale" },
  { table: "BookSaleItem" },
  { table: "BookPayment" },
  { table: "BookHandover" },
  { table: "CashCount" },
  { table: "FeeExemption" },
  { table: "PaymentHandover" },
  { table: "TimiInvestInvoice" },
  { table: "PaymentCategory" },
  { table: "PaymentCategoryPrice" },
  { table: "Student", columns: ["classId", "discountPct", "paymentPlan", "status", "enrollDate", "inactiveDate", "leaveReason", "organizationId"] },
];

export const AUDITED_MODELS = new Set(AUDITED_TABLES.map(t => t.table));
