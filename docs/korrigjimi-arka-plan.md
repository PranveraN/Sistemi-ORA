# Arka fizike — plani i korrigjimit (dega `feature/arka-fizike`)

Statusi: logjika e re, testet dhe mjetet e provës janë **në degë**; asgjë s'është lidhur
ende me Dashboard-in dhe **asnjë rresht real s'është ndryshuar**. Provat janë bërë mbi
`prisma/test-copy.db` dhe mbi kopje të përkohshme të `prisma/prod-copy.db` (08.10.2026).

## 1. Problemi në kod (i konfirmuar)

| Skedari | Çka bën sot | Problemi |
|---|---|---|
| `src/lib/shkollimiOverview.ts` | "Në arkë" = pagesat cash **sipas muajit të detyrimit** + të hyrat sipas `muaj/vit` − shpenzimet sipas `data` − dorëzimet sipas `month/year` ose `date` − investimet sipas `data` | katër kritere datash; paraja që hyn për një vit dhe del te tjetri e shtrembëron arkën; s'ka gjendje fillestare |
| `src/lib/expensePeriod.ts` | dorëzimet: `month/year` nëse ka, përndryshe `date` | ka nxitur përdoruesit të ndryshojnë **datën reale** (01.09 në vend të 25.08) që shuma të bjerë te viti i duhur → dyfishime |
| `src/lib/cashFlow.ts` | `inCashBox` = mbetje; `balanced` krahason të njëjtat shifra | "Bilanci përputhet" **s'mund të dështojë kurrë** — s'vërteton asgjë |
| `Payment` | një `paidDate` për rresht | pagesat pjesore humbasin datat e mëparshme (ndikim i vogël tani) |
| — | s'ka depozitë/tërheqje bankare | arka↔banka s'mund të regjistrohet si transfer |

## 2. Zgjidhja: një logjikë e vetme e arkës fizike (`src/lib/cashLedger.ts`)

Çdo lëvizje parash ka **dy fusha të ndara**:
- `day` — data **reale** e lëvizjes → përcakton arkën fizike;
- `attributedAY` — viti shkollor të cilit i caktohet → vetëm për Pasqyrën e vitit.

| Lëvizja | Arka | Banka | Data |
|---|---|---|---|
| Pagesë cash | + | | `paidDate` |
| Pagesë bankë/kartelë/online | | + | `paidDate` |
| Të hyra tjera cash / bankë | + | + | data e regjistrimit (s'ka ditë) |
| Dorëzim te një person | − | | `date` (reale) |
| **Depozitë arkë → bankë** (`CashTransfer`, i ri) | − | + | `date` |
| **Tërheqje bankë → arkë** (`CashTransfer`, i ri) | + | − | `date` |
| Shpenzim / pagesë fature cash | − | | `data` |
| Shpenzim / pagesë fature me bankë | | − | `data` |
| Investim cash / bankë | − | − | `data` |

- **Gjendja fillestare** = një numërim i arkës (data, shuma, koha e regjistrimit) — p.sh.
  numërimi i parë te "Numërimi i Arkave".
- **Regjistrimet retroaktive** (datë para numërimit, regjistruar pas tij) s'e ndryshojnë
  historinë në heshtje: dalin veç si "regjistrime të vonuara" te numërimi i radhës.
- **Rakordimi** `reconcileYearView()` e shpjegon çdo diferencë mes Pasqyrës së vitit dhe arkës
  fizike, me identitetin: `arka fizike e vitit = Pasqyra − (i caktohen vitit, lëvizën jashtë tij) + (lëvizën brenda, për vit tjetër)`.

Vërtetuar mbi kopjen e 08.10: Pasqyra 9.195,52 € − 5.250 € (verë) + 10.600 € (vite të tjera)
= **14.545,52 €** arka fizike nga 1 shtatori — e njëjta me llogaritjen e pavarur ditë pas dite.

## 3. Skedarët

**Të bëra në degë:**
- `prisma/schema.prisma` — `CashTransfer` (vetëm shtim, cent).
- `src/lib/cashLedger.ts` — rregullat, `physicalBalance`, `reconcileYearView`, `loadShkollimiMovements`.
- `src/lib/__tests__/cashLedger.test.ts` — 15 teste (shih §5).
- `scripts/arka-rakordim.ts` — rakordimi për çdo databazë (vetëm lexim).
- `scripts/korrigjimi-arka-prove.ts` — skenarët e korrigjimit mbi kopje të përkohshme.

**Të propozuara (pas miratimit):**
| Skedari | Ndryshimi |
|---|---|
| `src/lib/shkollimiOverview.ts` | shton `physicalCash` (cashLedger nga numërimi i fundit i arkës së Shkollimit) + listën e rakordimit; formula e vitit mbetet e njëjtë |
| `src/lib/cashFlow.ts` | `balanced` (tautologji) zëvendësohet me statusin e rakordimit; `inCashBox` riemërtohet "mbetja e vitit" |
| `src/components/dashboard/ShkollimiCashFlow.tsx` | dy shifra të ndara: **"Arka fizike (sipas datës)"** dhe **"Mbetja e vitit (Pasqyra)"**, + "pse ndryshojnë" (lista nga rakordimi) |
| `src/app/api/dashboard/cash-count/route.ts` | "Numëro arkën" krahason me arkën fizike dhe krijon numërim te "Numërimi i Arkave" (një sistem i vetëm) |
| `src/lib/audit/cashEffect.ts`, `cashClosing.ts` | marrin `CashTransfer`; përdorin të njëjtat rregulla si `cashLedger` |
| `src/app/api/arka/transfers/route.ts` + `src/app/(dashboard)/arka/page.tsx` | regjistrimi i depozitave/tërheqjeve |
| `src/components/finance/ExpensesSection.tsx` | te dorëzimi: **"Data reale"** dhe **"Për vitin shkollor"** veç e veç (që askush të mos e ndryshojë datën për të "rënë" te viti) |
| `src/lib/audit/rules/r13…`, `r14…` | R13: cash i marrë këtë vit për vit tjetër; R14: Pasqyra ≠ arka fizike, me shpjegimin |

## 4. Korrigjimi i të dhënave — VETËM pas verifikimit të dokumenteve

Rregulla: backup para çdo hapi; ndryshimet bëhen **nga aplikacioni**, me arsye (regjistrohen
te gjurma e auditimit), **asnjëherë me SQL**; mirëfilli pas deploy-it të auditimit.

| # | Rreshti | Dëshmia | Çka verifikohet | Ndryshimi i propozuar | Efekti (kopja 08.10) |
|---|---|---|---|---|---|
| A | #386 Anis Musa 2.000 € "9/2025", DEP-2026-0010, 01.09 | nxënës i ri (krijuar 25.08.2026, s'ka histori 2025–26); plani FULL 2.000 € | kopja e DEP-2026-0010 | viti → **9/2026** | +2.000 € te Pasqyra 2026–27 |
| B | #1624 Anis Musa 2.000 € 9/2026, DEP-2026-0359, regjistruar 23.09 | pas A ka 4.000 € të paguara për 2.000 € detyrim | kopjet DEP-0010 dhe DEP-0359; a ka paguar prindi dy herë? | nëse **një** pagesë: hiqet #1624 (me arsye "dyfishim i DEP-0010"); nëse **dy**: mbetet, dhe 2.000 € shënohet si kredi/parapagim | −2.000 € (arka fizike e pritur zbret) |
| C | #370 Kanita Bashota 1.000 € "9/2025", DEP-2026-0005 | nxënëse e re (02.06.2026); 50% zbritje, plani TIMI Invest | kopja e DEP-0005 | viti → **9/2026** | +1.000 € te Pasqyra |
| D | #1628 Kanita Bashota 1.000 € 9/2026, DEP-2026-0366 | pas C: 2.000 € të paguara për 1.000 € detyrim | DEP-0005 dhe DEP-0366; a është njëra pagesë e TIMI Invest? | si te B | −1.000 € |
| E | #1456/#1457 Muhamed Kajtazi "9/2025, 11/2025" (këste) | nxënës i ri (02.06.2026); s'ka asnjë rresht 2026–27 | DEP-2026-0244 | viti → **9/2026, 11/2026** | +1.000 € te Pasqyra |
| F | Dorëzimet #229/#230/#231 (01.09) dhe #184/#185 (25.08) | fletorja: 25.08 2.800 (Nexhi), 25.08 800 (Arsimi), 31.08 1.210 (Ardita) — **një herë** secili | fletorja e nënshkruar | #229/#230 → data **25.08**, #231 → **31.08**, të gjitha "për vitin" **9/2026**; hiqen #184 dhe #185 (dyfishime) | Pasqyra 2025–26 +3.600 €; 2026–27 pa ndryshim; arka fizike me datat reale |
| G | Dorëzimi #270 Koprani 6.600 € (29.09) | pagesat #1675–#1678 janë për 2027–28 | — | "për vitin" → **9/2027** | Pasqyra 2026–27 +6.600 €, 2027–28 −6.600 € → të dyja të sakta |
| H | Hyra #64 Davud Sekiraqa 950 € | fletorja: "Shkollim (viti kaluar)"; borxhi i vjetër #523 i papaguar | — | paguhet #523 (950 €, cash, 28.09) dhe hiqet #64 | arka neto 0; borxhi i tij mbyllet |

Rezultati i provës (kopje të përkohshme, `scripts/korrigjimi-arka-prove.ts`):

| Skenari | Pasqyra 2026–27 | Arka fizike 01.09–08.10 |
|---|---|---|
| 0. Sot | 9.195,52 € | 14.545,52 € |
| A+C+E (viti i saktë) | 13.195,52 € | 14.545,52 € |
| + F (dorëzimet e gushtit) | 13.195,52 € | 19.355,52 € |
| + G (Koprani) | **19.795,52 €** | 19.355,52 € (diferenca 440 € = mbetja e verës) |
| + B (Anis dyfishim) | 17.795,52 € | 17.355,52 € |
| + D (Kanita dyfishim) | 16.795,52 € | 16.355,52 € |

Pas korrigjimeve, **Pasqyra dhe arka fizike përputhen** (përveç gjendjes së 31 gushtit). Krahasuar
me numërimin, mungesa e pashpjeguar mbetet **rreth 15.500–18.500 €** (sipas B/D), minus paratë te
furnitori, 300 € e Përparim Blakajt (nëse s'janë regjistruar) dhe çdo pagesë "cash" që doli bankë.

**Shënim anësor:** Pasqyra 2025–26 del −394.707 € — të hyrat cash të atij viti s'janë në sistem si
pagesa (vetëm si të hyra bankare/importe). Kjo trajtohet veçmas.

## 5. Testet (`npm test`)

`src/lib/__tests__/cashLedger.test.ts` — 15 teste, krahas 66 ekzistuesve (gjithsej 81, të gjitha kalojnë):
- pagesë cash +arkë; pagesë me bankë +bankë (jo arkë);
- dorëzim −arkë (bankë pa ndryshim); depozitë −arkë +bankë;
- shpenzim cash −arkë; shpenzim me bankë −bankë;
- lëvizjet para numërimit = pjesë e gjendjes fillestare; ato me datë në të ardhmen s'llogariten;
- gjendja ditore kumulative;
- **retroaktive**: pagesë me datë para numërimit, regjistruar pas tij → "e vonuar", një herë;
  dorëzim retroaktiv (si Koprani: 29.09, regjistruar 06.10);
- **rakordimi**: pagesë për vitin e ardhshëm (Koprani), pagesat e verës, pagesë e pakonfirmuar/e
  larguar, skenari i plotë i hetimit (9.195,52 → 14.545,52), transferi në bankë;
- leximi nga databaza: çdo lloj rreshti → lëvizja dhe viti i saktë.

## 6. Rendi i implementimit
1. Miratimi i këtij plani.
2. Deploy i auditimit (fazat 1–4) → gjurma regjistron korrigjimet.
3. Verifikimi i dokumenteve (A–H) dhe korrigjimet nga aplikacioni, me arsye.
4. Lidhja e `cashLedger` me Dashboard-in dhe "Numërimi i Arkave" (§3 të propozuara), transferet, R13/R14.
5. Numërimi fillestar i arkës → nga ai moment arka fizike llogaritet saktë çdo ditë.
