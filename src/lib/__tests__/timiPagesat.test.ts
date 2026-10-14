import { describe, it, expect } from "vitest";
import { brutoNgaShuma, ndajProporcionalisht, mbushKestet, vitiNgaData } from "@/lib/timiPagesatCalc";

describe("brutoNgaShuma (TIMI paguan çmimin − 4,66%)", () => {
  it("rastet nga banka japin çmimin e plotë", () => {
    expect(brutoNgaShuma(171612)).toBe(180000); // Darja Hajra
    expect(brutoNgaShuma(190680)).toBe(200000); // Kanita Bashota
    expect(brutoNgaShuma(305088)).toBe(320000); // Amir + Ari Kahrimani
    expect(brutoNgaShuma(152544)).toBe(160000); // Akil Dema
  });
  it("komision tjetër", () => {
    expect(brutoNgaShuma(10000, 0)).toBe(10000);
    expect(brutoNgaShuma(9000, 10)).toBe(10000);
  });
});

describe("ndajProporcionalisht", () => {
  it("shuma ruhet saktë", () => {
    const p = ndajProporcionalisht(320000, [160000, 160000]);
    expect(p).toEqual([160000, 160000]);
    const q = ndajProporcionalisht(12893, [160000, 160000]);
    expect(q.reduce((a, b) => a + b, 0)).toBe(12893);
    expect(Math.abs(q[0] - q[1])).toBeLessThanOrEqual(1);
  });
  it("pa pesha → njësoj", () => {
    expect(ndajProporcionalisht(100, [0, 0, 0])).toEqual([34, 33, 33]);
  });
  it("12 këste", () => {
    const k = ndajProporcionalisht(160000, Array(12).fill(1));
    expect(k.reduce((a, b) => a + b, 0)).toBe(160000);
    expect(new Set(k).size).toBeLessThanOrEqual(2);
  });
});

describe("mbushKestet", () => {
  const rows = (paid: number[] = [], method: (string | null)[] = []) =>
    Array.from({ length: 12 }, (_, i) => ({ id: i + 1, finalCents: 13333, paidCents: paid[i] ?? 0, method: method[i] ?? null }));
  it("pagesë e plotë mbush krejt", () => {
    const r = mbushKestet(rows(), 159996);
    expect(r.mbetja).toBe(0);
    expect(r.ndarja).toHaveLength(12);
  });
  it("pagesa mujore mbush me radhë, edhe pjesërisht", () => {
    const r = mbushKestet(rows(), 11202);
    expect(r.ndarja).toEqual([{ id: 1, cents: 11202 }]);
    const r2 = mbushKestet(rows([11202]), 11202);
    expect(r2.ndarja).toEqual([{ id: 1, cents: 2131 }, { id: 2, cents: 9071 }]);
  });
  it("s'përzihet me këstin e paguar cash", () => {
    const r = mbushKestet(rows([5000], ["CASH"]), 10000);
    expect(r.ndarja[0].id).toBe(2);
  });
  it("kthen mbetjen kur paguhet më shumë", () => {
    expect(mbushKestet(rows(), 170000).mbetja).toBe(170000 - 159996);
  });
});

describe("vitiNgaData", () => {
  it("shtator–dhjetor → ai vit; janar–gusht → viti para", () => {
    expect(vitiNgaData("2026-09-30")).toBe(2026);
    expect(vitiNgaData("2027-03-15")).toBe(2026);
    expect(vitiNgaData("2026-05-25")).toBe(2025);
  });
});
