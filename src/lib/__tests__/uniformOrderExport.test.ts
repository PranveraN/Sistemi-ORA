import { describe, it, expect } from "vitest";
import { groupOrder, orderSheetRows } from "@/lib/uniformOrderExport";
import { buildStock, needsAttention } from "@/lib/uniStockCalc";

const lines = [
  { product: "Trenerka", size: "4", stock: 3, qty: 17 },
  { product: "Trenerka", size: "8", stock: 14, qty: 0 },
  { product: "Trenerka", size: "S", stock: 8, qty: 12 },
  { product: "Maicë", size: "M", stock: 0, qty: 20 },
];

describe("porosia e uniformave", () => {
  it("vetëm sasitë > 0, me nëntotale dhe total", () => {
    const g = groupOrder(lines);
    expect(g.groups.map(x => [x.product, x.total])).toEqual([["Trenerka", 29], ["Maicë", 20]]);
    expect([g.total, g.count]).toEqual([49, 3]);
    const rows = orderSheetRows(lines, { date: "2026-10-21", supplier: "Arnoldi", note: "" });
    expect(rows[0][0]).toBe("Akademia Ora – Porosi uniformash");
    expect(rows[1]).toEqual(["Data:", "21/10/2026"]);
    expect(rows[5]).toEqual(["Nr.", "Produkti", "Numri/Madhësia", "Stoku aktual", "Sasia", "Shënim"]);
    expect(rows.slice(6)).toEqual([
      [1, "Trenerka", "4", 3, 17, ""],
      [2, "Trenerka", "S", 8, 12, ""],
      ["", "Nëntotali — Trenerka", "", "", 29, ""],
      [3, "Maicë", "M", 0, 20, ""],
      ["", "Nëntotali — Maicë", "", "", 20, ""],
      ["", "TOTALI", "", "", 49, ""],
    ]);
  });

  it("'Sugjero kritikët': 20 − stoku te kritikët/të mbaruarit, jo te 'Pa hyrje' apo 'Në rregull'", () => {
    const [r] = buildStock({
      products: [{ id: 1, name: "Trenerka", buyPrice: 12 }],
      productSizes: ["4", "8", "10", "S"].map((size, i) => ({ productId: 1, size, sortOrder: i })),
      entries: [{ productId: 1, size: "4", quantity: 3 }, { productId: 1, size: "8", quantity: 14 }, { productId: 1, size: "S", quantity: 5 }],
      sold: [{ productId: 1, size: "S", quantity: 5 }],
      settings: [],
    });
    const suggested = Object.fromEntries(r.sizes.filter(s => needsAttention(s.status)).map(s => [s.size, Math.max(0, 20 - Math.max(0, s.stok))]));
    expect(suggested).toEqual({ "4": 17, S: 20 }); // 8 (14 copë) në rregull, 10 pa hyrje
  });
});
