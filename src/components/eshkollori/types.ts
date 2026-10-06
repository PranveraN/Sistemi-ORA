import type { FeeStatus, LedgerSummary } from "@/lib/feeLedger";

// Të dhënat që kthen GET /api/eshkollori (shih loadLedger te src/lib/eshkollori.ts)
export interface EsStudent {
  id: number;
  name: string;
  parent: string | null;
  className: string | null;
  base: number;
  expected: number;
  paid: number;
  debt: number;
  exempted: number;
  status: FeeStatus;
  amountChanged: boolean;
  rowId: number | null;
  exemption: { id: number; type: string; percent: number | null; reason: string; reasonText: string | null; untilYear: number | null; createdByName: string | null; createdAt: string } | null;
  oldDebts: { id: number; year: number | null; amount: number; total: number; paid: number; note: string | null }[];
  oldDebt: number;
}

export interface EsLedger {
  category: { id: number; name: string };
  year: number;
  label: string;
  defaultAmount: number;
  students: EsStudent[];
  summary: LedgerSummary;
}
