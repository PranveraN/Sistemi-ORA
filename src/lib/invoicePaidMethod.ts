// "Shëno si Paguar" te faturat: si u pagua? Më parë krijohej gjithmonë një pagesë CASH
// te kategoria "Faturat" — edhe kur pagesa ishte regjistruar tashmë te Shkollimi
// (Sadik Karaqa, FAT-2026-0001) ose ishte bërë me bankë — dhe fryhej arka.
// Kthen "CASH" | "BANK" | "NONE" (mos krijo pagesë) ose null nëse u anulua.
export function askInvoicePaidMethod(number: string): "CASH" | "BANK" | "NONE" | null {
  const a = window.prompt(
    `Si u pagua fatura ${number}?\n\n` +
    `1 = Cash (paratë hynë në arkë)\n` +
    `2 = Bankë\n` +
    `3 = Pagesa është regjistruar tashmë te Shkollimi (mos krijo pagesë të re)\n\n` +
    `Shkruaj 1, 2 ose 3:`,
    "3",
  );
  if (a == null) return null;
  return a.trim() === "1" ? "CASH" : a.trim() === "2" ? "BANK" : a.trim() === "3" ? "NONE" : null;
}
