import { describe, it, expect } from "vitest";
import { alignPeriodToDue } from "@/lib/academicYear";

describe("alignPeriodToDue", () => {
  it("çmimi i 2026–27 i regjistruar në qershor merr muajin e afatit", () => {
    expect(alignPeriodToDue(6, 2026, new Date("2026-09-15T00:00:00Z"))).toEqual({ month: 9, year: 2026 });
  });
  it("brenda të njëjtit vit shkollor s'ndryshon asgjë", () => {
    expect(alignPeriodToDue(11, 2026, new Date("2027-01-05T00:00:00Z"))).toEqual({ month: 11, year: 2026 });
    expect(alignPeriodToDue(9, 2026, new Date("2026-09-05T00:00:00Z"))).toEqual({ month: 9, year: 2026 });
  });
  it("afat më i hershëm (borxh i vonuar) s'e kthen mbrapa", () => {
    expect(alignPeriodToDue(9, 2026, new Date("2026-06-30T00:00:00Z"))).toEqual({ month: 9, year: 2026 });
  });
  it("pa muaj → siç është", () => {
    expect(alignPeriodToDue(null, 2026, new Date("2026-09-15T00:00:00Z"))).toEqual({ month: null, year: 2026 });
  });
});
