import { describe, it, expect } from "vitest";
import { buildStock, lowStockList, sizeStatus, DEFAULT_SIZES } from "@/lib/uniStockCalc";

describe("sizeStatus", () => {
  it("numër pa asnjë lëvizje s'ngre alarm", () => {
    expect(sizeStatus(0, 0, 0)).toBe("PA_HYRJE");
  });
  it("mbaruar, nën prag, në prag, në rregull", () => {
    expect(sizeStatus(28, 28, 3)).toBe("MBARUAR");
    expect(sizeStatus(45, 43, 5)).toBe("NEN_PRAG");
    expect(sizeStatus(40, 39, 1)).toBe("NE_PRAG");
    expect(sizeStatus(50, 40, 5)).toBe("OK");
  });
  it("shitje pa hyrje → mbaruar (stok negativ)", () => {
    expect(sizeStatus(0, 2, 0)).toBe("MBARUAR");
  });
  it("pa prag: alarm vetëm kur mbaron", () => {
    expect(sizeStatus(10, 9, 0)).toBe("OK");
    expect(sizeStatus(10, 10, 0)).toBe("MBARUAR");
  });
});

describe("buildStock", () => {
  const products = [{ id: 1, name: "Trenerka", buyPrice: 12 }];
  it("stok = hyrje − shitur për çdo numër, total për produktin", () => {
    const [r] = buildStock({
      products,
      productSizes: [{ productId: 1, size: "8", sortOrder: 0 }, { productId: 1, size: "10", sortOrder: 1 }],
      entries: [{ productId: 1, size: "8", quantity: 10 }, { productId: 1, size: "8", quantity: 5 }, { productId: 1, size: "10", quantity: 4 }],
      sold: [{ productId: 1, size: "8", quantity: 3 }, { productId: 1, size: "10", quantity: 4 }],
      settings: [{ productId: 1, size: "8", minThreshold: 12 }],
    });
    expect(r.sizes.map(s => [s.size, s.stok, s.status])).toEqual([["8", 12, "NE_PRAG"], ["10", 0, "MBARUAR"]]);
    expect([r.hyre, r.shitur, r.stok, r.lowCount]).toEqual([19, 7, 12, 2]);
  });
  it("pa listë numrash → lista e parazgjedhur; numrat jashtë listës me lëvizje shfaqen", () => {
    const [r] = buildStock({ products, productSizes: [], entries: [{ productId: 1, size: "3XL", quantity: 2 }], sold: [], settings: [] });
    expect(r.sizes.map(s => s.size)).toEqual([...DEFAULT_SIZES, "3XL"]);
    expect(r.stok).toBe(2);
  });
  it("lista e njoftimeve", () => {
    const rows = buildStock({ products, productSizes: [{ productId: 1, size: "12", sortOrder: 0 }], entries: [{ productId: 1, size: "12", quantity: 2 }], sold: [], settings: [{ productId: 1, size: "12", minThreshold: 5 }] });
    expect(lowStockList(rows)).toEqual([{ productId: 1, size: "12", stock: 2, status: "NEN_PRAG", name: "Trenerka nr. 12" }]);
  });
});
