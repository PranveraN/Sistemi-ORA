import { describe, it, expect } from "vitest";
import { buildQuickPay, planKind, nextInstallmentDue, type QpInstallment } from "@/lib/quickPayPlan";

const inst = (o: Partial<QpInstallment>): QpInstallment => ({
  id: 1, amount: 1000, finalAmount: 1000, paidAmount: 0, discount: 0, discountType: "fixed", scholarship: 0,
  method: null, dueDate: "2026-09-15T00:00:00.000Z", paidDate: null, description: null, note: null, status: "PENDING", ...o,
});
const base = { studentId: 7, categoryId: 2, method: "CASH", date: "2026-10-20" };

describe("planKind", () => {
  it("njeh planet", () => {
    expect(planKind([])).toBe("NONE");
    expect(planKind([inst({})])).toBe("SINGLE");
    expect(planKind([inst({ description: "KESTI_1" }), inst({ id: 2, description: "KESTI_2" })])).toBe("TWO");
    expect(planKind([inst({ description: "MUAJI_1" })])).toBe("MONTHLY");
    expect(planKind([inst({ description: "TI_MUAJI_1" })])).toBe("TIMI");
    expect(planKind([inst({ description: "FLEX_HEADER" })])).toBe("FLEX");
  });
});

describe("buildQuickPay — dy këste", () => {
  const two = [
    inst({ id: 11, description: "KESTI_1", finalAmount: 1000, paidAmount: 0, dueDate: "2026-09-10T00:00:00.000Z" }),
    inst({ id: 12, description: "KESTI_2", finalAmount: 1000, paidAmount: 0, dueDate: "2026-11-30T00:00:00.000Z" }),
  ];
  it("mbush K1 pastaj K2", () => {
    const r = buildQuickPay({ ...base, installments: two, amount: 1500 });
    expect(r.error).toBeUndefined();
    expect(r.ops.map(o => [o.kind, "id" in o ? o.id : 0, o.add, o.payload.paidAmount])).toEqual([["PUT", 11, 1000, 1000], ["PUT", 12, 500, 500]]);
    expect([r.debtBefore, r.debtAfter]).toEqual([2000, 500]);
    expect(r.ops[0].payload).toMatchObject({ method: "CASH", paidDate: "2026-10-20", dueDate: "2026-09-10", description: "KESTI_1", amount: 1000 });
  });
  it("shuma > borxhi refuzohet; 0 refuzohet", () => {
    expect(buildQuickPay({ ...base, installments: two, amount: 2000.5 }).error).toMatch(/kalon borxhin/);
    expect(buildQuickPay({ ...base, installments: two, amount: 0 }).error).toBeTruthy();
    expect(buildQuickPay({ ...base, installments: two, amount: -5 }).error).toBeTruthy();
  });
  it("kësti i radhës", () => {
    expect(nextInstallmentDue([{ ...two[0], paidAmount: 1000 }, two[1]])).toBe(1000);
  });
  it("shënon ndryshimin e metodës te kësti i paguar pjesërisht", () => {
    const r = buildQuickPay({ ...base, method: "BANK", installments: [{ ...two[0], paidAmount: 300, method: "CASH" }, two[1]], amount: 100 });
    expect(r.methodChanges).toEqual(["K1"]);
    expect(r.ops[0].payload.paidAmount).toBe(400);
  });
});

describe("buildQuickPay — fleksibël, pa plan, TIMI", () => {
  it("fleksibël → FLEX_PAY_N i ri", () => {
    const flex = [inst({ id: 1, description: "FLEX_HEADER", finalAmount: 1800 }), inst({ id: 2, description: "FLEX_PAY_1", amount: 500, finalAmount: 500, paidAmount: 500 })];
    const r = buildQuickPay({ ...base, installments: flex, amount: 300 });
    expect(r.ops[0]).toMatchObject({ kind: "POST", payload: { description: "FLEX_PAY_2", amount: 300, paidAmount: 300, month: 10, year: 2026 } });
    expect([r.debtBefore, r.debtAfter]).toEqual([1300, 1000]);
  });
  it("pa plan → Pagesë e plotë me zbritjen e nxënësit", () => {
    const r = buildQuickPay({ ...base, installments: [], amount: 500, noPlan: { grossAmount: 2000, discountPct: 10, dueDate: "2026-09-15" } });
    expect(r.ops[0]).toMatchObject({ kind: "POST", payload: { amount: 2000, discount: 10, discountType: "percentage", paidAmount: 500, month: 9, year: 2026 } });
    expect(r.debtAfter).toBe(1300);
  });
  it("TIMI s'kalon nga ky panel", () => {
    expect(buildQuickPay({ ...base, installments: [inst({ description: "TI_MUAJI_1" })], amount: 10 }).error).toMatch(/TIMI/);
  });
});
