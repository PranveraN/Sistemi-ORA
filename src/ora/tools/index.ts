import type { OraTool } from "../types";
import { countStudents, listStudents, studentPayments } from "./students";
import { familySummary, debtors, paymentsSummary, classOverview, staffIncompleteData, requestsSummary, registrationsSummary } from "./more";

// Regjistri i veglave të Orës (faza 1). Çdo vegël deklaron modulin që kërkon;
// ekzekutohet vetëm nëse përdoruesi e ka atë modul (si faqja përkatëse).
export const ORA_TOOLS: OraTool[] = [
  countStudents, listStudents, studentPayments,
  familySummary, debtors, paymentsSummary, classOverview, staffIncompleteData, requestsSummary, registrationsSummary,
];

export const toolByName = (name: string) => ORA_TOOLS.find(t => t.name === name);
