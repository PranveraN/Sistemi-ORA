import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    INACTIVE: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    PAID: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    PARTIAL: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: "Aktiv",
    INACTIVE: "Joaktiv",
    PAID: "Paguar",
    PENDING: "Në pritje",
    PARTIAL: "Pjesërisht",
    OVERDUE: "Vonuar",
    DRAFT: "Draft",
    SENT: "Dërguar",
    CANCELLED: "Anuluar",
    INVOICE: "Faturë",
    PROFORMA: "Profaturë",
    OFFER: "Ofertë",
    CASH: "Cash",
    BANK: "Bankë",
    CARD: "Kartelë",
    ONLINE: "Online",
    ADMIN: "Admin",
    FINANCE: "Financë",
    SECRETARY: "Sekretari",
  };
  return labels[status] || status;
}

export const MONTHS = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"
];

// Ushqimi (food) payments are tracked per bi-monthly period, stored under the
// period's first calendar month (9, 11, 1, 3, 5) — used to show the full period
// name ("Shtator/Tetor") instead of just the canonical month ("Shtator").
export const USHQIMI_PERIOD_LABELS: Record<number, string> = {
  9:  "Shtator/Tetor",
  11: "Nëntor/Dhjetor",
  1:  "Janar/Shkurt",
  3:  "Mars/Prill",
  5:  "Maj/Qershor",
};

export function generateInvoiceNumber(type: string, id: number): string {
  const prefix = type === "INVOICE" ? "FAT" : type === "PROFORMA" ? "PRO" : "OFR";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(4, "0")}`;
}
