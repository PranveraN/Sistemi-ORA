import { describe, it, expect } from "vitest";
import { kesteMujore, afatiAktual, kaVonese, kesteTeMbuluara, planForPeriod, setPlanFrom, parsePlanState, periudhaEParePaFilluar, parseShujtaState, shujtaForPeriod, setShujtaFrom, shujtaSuffix } from "../ushqimiPlan";

describe("shujtat sipas periudhës", () => {
  it("parazgjedhje Mëngjes + Drekë; 'vetëm drekë' vlen nga periudha e zgjedhur e tutje", () => {
    let s = parseShujtaState(null);
    expect(shujtaForPeriod(s, 3)).toBe("TE_DYJA");
    s = setShujtaFrom(s, 1, "DREKE");
    expect([0, 1, 4].map(i => shujtaForPeriod(s, i))).toEqual(["TE_DYJA", "DREKE", "DREKE"]);
    s = setShujtaFrom(s, 3, "MENGJES");
    expect([0, 1, 2, 3, 4].map(i => shujtaForPeriod(s, i))).toEqual(["TE_DYJA", "DREKE", "DREKE", "MENGJES", "MENGJES"]);
    expect(parseShujtaState(JSON.stringify(s))).toEqual(s);
    expect(setShujtaFrom(s, 1, "TE_DYJA")).toEqual({ nga: {} });
  });
  it("prapashtesa e përshkrimit", () => {
    expect(shujtaSuffix("TE_DYJA")).toBe("");
    expect(shujtaSuffix("DREKE")).toBe(" · vetëm drekë");
  });
});

// Shtator/Tetor 2026, Klasa 1: 17 + 20 = 37 ditë × 4 € = 148 €
const baza = { months: [9, 10] as [number, number], calYear: 2026, split: [17, 20] as [number, number], days: 37, finalAmount: 148 };

describe("kesteMujore", () => {
  it("paguan 68 € në shtator → Shtatori Paguar, Tetori Pa paguar (jo me vonesë para 31.10)", () => {
    const k = kesteMujore({ ...baza, paidAmount: 68, today: new Date(2026, 9, 15) });
    expect(k.map(x => [x.shuma, x.paguar, x.statusi])).toEqual([[68, 68, "PAGUAR"], [80, 0, "PA_PAGUAR"]]);
    expect(kaVonese(k)).toBe(false);
    expect(afatiAktual(k).getMonth()).toBe(9); // afati i Tetorit
  });

  it("Tetori del me vonesë vetëm pas 31.10", () => {
    expect(kaVonese(kesteMujore({ ...baza, paidAmount: 68, today: new Date(2026, 9, 31, 12) }))).toBe(false);
    expect(kaVonese(kesteMujore({ ...baza, paidAmount: 68, today: new Date(2026, 10, 1, 8) }))).toBe(true);
  });

  it("pagesë 100 € → 68 mbyllin Shtatorin, 32 kalojnë te Tetori (Pjesërisht)", () => {
    const k = kesteMujore({ ...baza, paidAmount: 100, today: new Date(2026, 9, 10) });
    expect(k.map(x => [x.paguar, x.statusi])).toEqual([[68, "PAGUAR"], [32, "PJESERISHT"]]);
  });

  it("totali i kësteve = detyrimi i periudhës (s'ndryshon)", () => {
    for (const fa of [148, 189, 166.5, 94.5]) {
      const k = kesteMujore({ ...baza, finalAmount: fa, days: Math.round(fa / 4), paidAmount: 0 });
      expect(Math.round((k[0].shuma + k[1].shuma) * 100) / 100).toBe(fa);
    }
  });

  it("ndërprerje në mes të tetorit (37 → 27 ditë) → ndryshon vetëm kësti i dytë", () => {
    const k = kesteMujore({ ...baza, days: 27, finalAmount: 108, paidAmount: 68, today: new Date(2026, 9, 20) });
    expect(k.map(x => [x.dite, x.shuma, x.statusi])).toEqual([[17, 68, "PAGUAR"], [10, 40, "PA_PAGUAR"]]);
  });

  it("pa pagesë pas 30.09 → Shtatori me vonesë", () => {
    const k = kesteMujore({ ...baza, paidAmount: 0, today: new Date(2026, 9, 2) });
    expect(k[0].statusi).toBe("ME_VONESE");
    expect(afatiAktual(k).getMonth()).toBe(8);
  });

  it("e paguar plotësisht (si 'Paguaj disa periudha') → të dy këstet Paguar", () => {
    const k = kesteMujore({ ...baza, paidAmount: 148, today: new Date(2026, 11, 1) });
    expect(k.every(x => x.statusi === "PAGUAR")).toBe(true);
  });

  it("pa kalendar → ndarje përgjysmë", () => {
    const k = kesteMujore({ ...baza, split: null, days: 42, finalAmount: 189, paidAmount: 0 });
    expect(k.map(x => x.dite)).toEqual([21, 21]);
  });
});

describe("kesteTeMbuluara (kuponi)", () => {
  const k = kesteMujore({ ...baza, paidAmount: 148 });
  it("80 € pas 68 → mbulon Tetorin", () => {
    expect(kesteTeMbuluara(k, 68, 148)).toEqual([{ muaji: 10, vit: 2026, shuma: 80, plotesisht: true }]);
  });
  it("100 € nga zero → Shtator 68 + Tetor 32 (pjesërisht)", () => {
    expect(kesteTeMbuluara(k, 0, 100)).toEqual([
      { muaji: 9, vit: 2026, shuma: 68, plotesisht: true },
      { muaji: 10, vit: 2026, shuma: 32, plotesisht: false },
    ]);
  });
});

describe("plani sipas periudhës", () => {
  it("parazgjedhje Dymujor; ndryshimi vlen nga periudha e zgjedhur e tutje", () => {
    let s = parsePlanState(null);
    expect(planForPeriod(s, 0)).toBe("DYMUJOR");
    s = setPlanFrom(s, 1, "MUJOR");
    expect([0, 1, 2, 4].map(i => planForPeriod(s, i))).toEqual(["DYMUJOR", "MUJOR", "MUJOR", "MUJOR"]);
    s = setPlanFrom(s, 3, "DYMUJOR");
    expect([0, 1, 2, 3, 4].map(i => planForPeriod(s, i))).toEqual(["DYMUJOR", "MUJOR", "MUJOR", "DYMUJOR", "DYMUJOR"]);
    expect(parsePlanState(JSON.stringify(s))).toEqual(s);
  });
  it("periudha e parë pa filluar", () => {
    const B = [[9, 10], [11, 12], [1, 2], [3, 4], [5, 6]];
    expect(periudhaEParePaFilluar(B, 2026, new Date(2026, 10, 4))).toBe(2); // 4 nëntor → Janar/Shkurt
    expect(periudhaEParePaFilluar(B, 2026, new Date(2026, 7, 20))).toBe(0);
  });
});
