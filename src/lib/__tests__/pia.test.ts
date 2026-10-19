import { describe, it, expect } from "vitest";
import { normalizePia, normalizeReview, parseJson, REZ_COUNT, FUSHA_COUNT } from "@/lib/pia";
import { buildPiaPrintHtml } from "@/lib/piaPrint";

describe("normalizePia", () => {
  it("bosh → 3 fusha dhe 4 rezultate bosh", () => {
    const p = normalizePia({});
    expect(p.fushat).toHaveLength(FUSHA_COUNT);
    expect(p.rezultatet).toHaveLength(REZ_COUNT);
    expect(p.asistentja).toBe("");
  });
  it("hedh vlerat e panjohura dhe tepricat", () => {
    const p = normalizePia({
      asistentja: "Ndoshta", organizimi: "Individual",
      dokumentet: ["Raport mjekësor", "x", "Raport mjekësor"],
      rezultatet: [{ rezultati: "Lexon 10 fjalë", pavaresia: "MP", mbeshtetja: ["Vizuale", "Tjetër"] }, {}, {}, {}, { rezultati: "i pestë" }],
    });
    expect(p.asistentja).toBe("");
    expect(p.organizimi).toBe("Individual");
    expect(p.dokumentet).toEqual(["Raport mjekësor"]);
    expect(p.rezultatet).toHaveLength(4);
    expect(p.rezultatet[0]).toEqual({ rezultati: "Lexon 10 fjalë", pavaresia: "MP", mbeshtetja: ["Vizuale"] });
  });
  it("JSON i prishur s'rrëzon", () => {
    expect(parseJson("{bad", normalizePia).fushat).toHaveLength(3);
  });
});

describe("normalizeReview", () => {
  it("niveli dhe vendimi vetëm nga lista", () => {
    const r = normalizeReview({ rezultatet: [{ niveli: "PR", pavaresia: "P" }, { niveli: "ZZ" }], vendimi: ["PIA rishikohet", "x"], periudha: "Tremujori I" });
    expect(r.rezultatet[0].niveli).toBe("PR");
    expect(r.rezultatet[1].niveli).toBe("");
    expect(r.vendimi).toEqual(["PIA rishikohet"]);
    expect(r.periudha).toBe("Tremujori I");
  });
});

describe("buildPiaPrintHtml", () => {
  it("3 faqe, vlerat e shënuara, HTML i shpëtuar", () => {
    const st = { id: 1, firstName: "Ana", lastName: "<b>X</b>", birthDate: "2015-03-02", className: "3A", parentName: "Prindi", parentPhone: null, fatherName: null, fatherPhone: null, motherName: null, motherPhone: null, assistantName: null };
    const p = normalizePia({ rezultatet: [{ rezultati: "R-1", pavaresia: "MA" }] });
    const html = buildPiaPrintHtml(st, 2026, p, { date: "2026-11-10", data: normalizeReview({ rezultatet: [{ niveli: "NP" }] }) });
    expect(html.match(/class="page"/g)).toHaveLength(3);
    expect(html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("☒ MA");
    expect(html).toContain("☒ NP");
    expect(html).toContain("10.11.2026");
  });
});
