// Ndërton tekstin e SMS-së së kujtesës së borxhit për një shitje librash —
// përdoret nga rruga e vetme (send-sms) dhe ajo me shumicë (bulk-send-sms),
// që mesazhi të mbetet identik në të dy rastet.
export function buildBookDebtMessage(
  studentName: string,
  balance: number,
  items: Record<string, unknown>[]
): string {
  const itemLine = items.length
    ? items.map(it => `${it.productName} x${Number(it.quantity)}`).join(", ")
    : "libra";
  return `Kujtesë Akademia Ora: ${studentName} ka borxh ${balance.toFixed(2)}€ për ${itemLine}. Ju lutem rregulloni pagesën. Faleminderit.`;
}
