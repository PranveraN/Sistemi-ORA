import { describe, it, expect } from "vitest";
import { buildStock, lowStockList, sizeStatus, needsAttention, DEFAULT_SIZES } from "@/lib/uniStockCalc";

describe("sizeStatus (Kritik = 1–9, ose nën pragun kur është vendosur)", () => {
  it("numër pa asnjë lëvizje s'ngre alarm, edhe me prag", () => {
    expect(sizeStatus(0, 0, 0)).toBe("PA_HYRJE");
    expect(sizeStatus(0, 0, 5)).toBe("PA_HYRJE");
    expect(needsAttention("PA_HYRJE")).toBe(false);
  });
  it("pa prag: 1–9 kritik, 10+ në rregull", () => {
    for (const n of [1, 5, 9]) expect(sizeStatus(n, 0, 0)).toBe("NEN_PRAG");
    expect(sizeStatus(10, 0, 0)).toBe("OK");
    expect(sizeStatus(40, 0, 0)).toBe("OK");
  });
  it("0 pas hyrjeve → Mbaruar; shitje pa hyrje → Mbaruar", () => {
    expect(sizeStatus(28, 28, 0)).toBe("MBARUAR");
    expect(sizeStatus(0, 2, 0)).toBe("MBARUAR");
  });
  it("me prag të vendosur: nën prag kritik", () => {
    expect(sizeStatus(45, 43, 5)).toBe("NEN_PRAG");
    expect(sizeStatus(10, 5, 5)).toBe("OK");
    expect(sizeStatus(30, 0, 25)).toBe("OK");
    expect(sizeStatus(20, 0, 25)).toBe("NEN_PRAG");
  });
});

describe("buildStock", () => {
  const products = [{ id: 1, name: "Trenerka", buyPrice: 12, sellPrice: 15, photo: null }];
  it("stok = hyrje − shitur për çdo numër, total për produktin", () => {
    const [r] = buildStock({
      products,
      productSizes: [{ productId: 1, size: "8", sortOrder: 0 }, { productId: 1, size: "10", sortOrder: 1 }],
      entries: [{ productId: 1, size: "8", quantity: 10 }, { productId: 1, size: "8", quantity: 5 }, { productId: 1, size: "10", quantity: 4 }],
      sold: [{ productId: 1, size: "8", quantity: 3 }, { productId: 1, size: "10", quantity: 4 }],
      settings: [{ productId: 1, size: "8", minThreshold: 12 }],
    });
    expect(r.sizes.map(s => [s.size, s.stok, s.status])).toEqual([["8", 12, "OK"], ["10", 0, "MBARUAR"]]);
    expect([r.hyre, r.shitur, r.stok, r.lowCount, r.sellPrice]).toEqual([19, 7, 12, 1, 15]);
  });
  it("pa listë numrash → lista e parazgjedhur; numrat jashtë listës me lëvizje shfaqen", () => {
    const [r] = buildStock({ products, productSizes: [], entries: [{ productId: 1, size: "3XL", quantity: 2 }], sold: [], settings: [] });
    expect(r.sizes.map(s => s.size)).toEqual([...DEFAULT_SIZES, "3XL"]);
    expect(r.stok).toBe(2);
    expect(r.lowCount).toBe(1); // 3XL me 2 copë = kritik; numrat pa hyrje s'llogariten
  });
  it("hyrje 5 + numërim në 0 → Mbaruar (jo 'Pa hyrje')", () => {
    const [r] = buildStock({ products, productSizes: [{ productId: 1, size: "10", sortOrder: 0 }],
      entries: [{ productId: 1, size: "10", quantity: 5 }, { productId: 1, size: "10", quantity: -5 }], sold: [], settings: [] });
    expect(r.sizes[0]).toMatchObject({ stok: 0, status: "MBARUAR" });
  });
  it("lista e njoftimeve", () => {
    const rows = buildStock({ products, productSizes: [{ productId: 1, size: "12", sortOrder: 0 }], entries: [{ productId: 1, size: "12", quantity: 2 }], sold: [], settings: [{ productId: 1, size: "12", minThreshold: 5 }] });
    expect(lowStockList(rows)).toEqual([{ productId: 1, size: "12", stock: 2, status: "NEN_PRAG", name: "Trenerka nr. 12" }]);
  });
});
