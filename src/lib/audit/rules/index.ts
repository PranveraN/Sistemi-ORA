import type { AuditRuleDef } from "./types";
import { r01 } from "./r01CashCountDifference";
import { r02 } from "./r02PaymentChanged";
import { r03 } from "./r03Backdated";
import { r04 } from "./r04Discounts";
import { r05 } from "./r05Duplicates";
import { r06 } from "./r06Numbering";
import { r07 } from "./r07PaymentInvoice";
import { r08 } from "./r08Reconciliation";
import { r09 } from "./r09Departed";
import { r10 } from "./r10NoObligation";
import { r11 } from "./r11UndeliveredCash";
import { r12 } from "./r12BadValues";

// Gjetjet që krijohen drejtpërdrejt nga shtresa qendrore (src/lib/audit/closedDay.ts),
// në çastin e ndryshimit — regjistrohen këtu që të kenë emër/përshkrim/aktivizim.
const arkaMbyllur: AuditRuleDef = {
  code: "ARKA_MBYLLUR",
  name: "Ndryshim pas numërimit të arkës",
  description: "Ndryshim që prek paratë e një arke në një ditë që ishte numëruar tashmë (s'bllokohet, vetëm shënohet).",
  module: "ARKA",
  severity: "E_LARTE",
  live: true,
  run: async () => [],
};

/** Të gjitha rregullat, sipas renditjes së ekzekutimit. */
export const AUDIT_RULES: AuditRuleDef[] = [r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r11, r12, arkaMbyllur];
