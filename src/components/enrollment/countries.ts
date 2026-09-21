// Listë statike vendesh për fushën "Vendi i Origjinës" kur zgjidhet "Diasporë"
// — grupuar për <optgroup>, emra shqip, stil si lib/studentRatings.ts.
export const DIASPORA_COUNTRIES: { group: string; countries: string[] }[] = [
  {
    group: "Evropë",
    countries: [
      "Gjermani", "Zvicër", "Austri", "Itali", "Francë", "Belgjikë", "Holandë",
      "Suedi", "Norvegji", "Danimarkë", "Finlandë", "Britani e Madhe", "Irlandë",
      "Spanjë", "Portugali", "Greqi", "Turqi", "Shqipëri", "Maqedoni e Veriut",
      "Mali i Zi", "Serbi", "Bosnjë dhe Hercegovinë", "Kroaci", "Slloveni",
      "Poloni", "Çeki", "Sllovaki", "Hungari", "Rumani", "Bullgari",
    ],
  },
  {
    group: "Amerikë",
    countries: ["SHBA", "Kanada", "Brazil", "Argjentinë"],
  },
  {
    group: "Tjetër",
    countries: ["Australi", "Zelandë e Re"],
  },
];
