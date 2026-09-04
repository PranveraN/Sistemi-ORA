// Mbjell katalogun e plotë të materialeve (22 kategoritë, dhëna nga admini).
// 10 kategoritë mapohen te 11 kategoritë ekzistuese (nga Faza 1) për të
// shmangur dublikatë konceptualë; 12 janë vërtet të reja.
// I sigurt të ekzekutohet disa herë: artikujt me emër ekzistues (org-wide,
// njësoj si kontrolli i POST /api/materials) kalohen pa u krijuar përsëri.
//
// Përdorim:
//   npx tsx scripts/seed-material-catalog-full.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DATA: { category: string; items: string[] }[] = [
  {
    category: "Materiale për klasë", // ekzistuese
    items: [
      "Fletore me vija", "Fletore katrore", "Fletore me katrorë të mëdhenj", "Fletore pa vija",
      "Fletore për detyra shtëpie", "Fletore pune", "Fletore vizatimi", "Fletore muzikore",
      "Bllok shënimesh", "Bllok vizatimi A4", "Bllok vizatimi A3", "Letër A4", "Letër A3",
      "Letër me ngjyra", "Karton i bardhë", "Karton me ngjyra", "Karton i trashë",
      "Letër ngjitëse", "Letër transparente", "Letër origami", "Letër kalk", "Post-it",
      "Etiketa ngjitëse", "Dosje plastike", "Dosje me kapak", "Dosje me llastik", "Klasor",
      "Ndarëse për dokumente", "Mbështjellëse për libra", "Mbështjellëse për fletore",
    ],
  },
  {
    category: "Materiale shkrimi", // ekzistuese
    items: [
      "Laps HB", "Laps 2B", "Laps 4B", "Laps me ngjyra", "Stilolaps blu", "Stilolaps i zi",
      "Stilolaps i kuq", "Stilolaps jeshil", "Marker permanent", "Marker për tabelë të bardhë",
      "Marker me ngjyra", "Highlighter", "Shkumës i bardhë", "Shkumës me ngjyra", "Gomë",
      "Mprehëse", "Vizore", "Trekëndësh", "Raportor", "Kompas", "Set gjeometrik",
      "Ngjitës në shkop", "Ngjitës i lëngshëm", "Shirit ngjitës", "Shirit dyanshëm", "Gërshërë",
      "Prerëse letre", "Kapëse letrash", "Kapëse metalike", "Mbajtëse për dokumente",
    ],
  },
  {
    category: "Letër dhe printim", // ekzistuese (përfshin "Printim dhe fotokopjim")
    items: [
      "Toner për printer", "Bojë për printer", "Letër fotokopjeje A4", "Letër fotokopjeje A3",
      "Letër me ngjyra për printim", "Letër fotografike", "Etiketa për printer",
      "Folie për laminim A4", "Folie për laminim A3", "Spiralë për lidhje dokumentesh",
      "Kopertina transparente", "Kopertina kartoni", "Stapler", "Kapëse për stapler", "Perforator",
    ],
  },
  {
    category: "Matematikë", // ekzistuese
    items: [
      "Numëratore", "Abak", "Kubëza matematikore", "Shkopinj numërimi", "Forma gjeometrike",
      "Trupa gjeometrikë", "Set matësish", "Orë mësimore demonstrative", "Para lodër për ushtrime",
      "Zar matematikor", "Domino matematikore", "Puzzle matematikore", "Kartela me numra",
      "Kartela me veprime", "Tabelë shumëzimi", "Materiale për thyesa", "Materiale për matje",
      "Peshore edukative", "Metër demonstrues",
    ],
  },
  {
    category: "Gjuhë dhe letërsi", // e re
    items: [
      "Kartela me shkronja", "Alfabet magnetik", "Alfabet plastik", "Kartela me fjalë",
      "Kartela me figura", "Kartela për fjali", "Kartela për gramatikë", "Libra leximi",
      "Libra me tregime", "Libra ilustrues", "Fjalor", "Fjalor ilustrues", "Postera alfabeti",
      "Postera gramatikorë", "Materiale për drejtshkrim", "Materiale për lexim",
      "Materiale për shkrim", "Puzzle me fjalë", "Lojëra me fjalë", "Scrabble edukativ",
      "Tabela magnetike për shkronja",
    ],
  },
  {
    category: "Shkencë", // ekzistuese
    items: [
      "Mikroskop", "Lupa", "Tuba provë", "Mbajtëse për tuba provë", "Gotë laboratorike",
      "Enë matëse", "Pipeta", "Termometër", "Magnetë", "Peshore", "Set për elektricitet",
      "Set për eksperimente", "Model i sistemit diellor", "Glob", "Modele të organeve",
      "Skelet anatomik", "Model i trupit të njeriut", "Koleksion mineralesh",
      "Materiale për eksperimente", "Syze mbrojtëse", "Doreza laboratorike", "Kartela shkencore",
      "Postera shkencorë",
    ],
  },
  {
    category: "Art dhe kreativitet", // ekzistuese
    items: [
      "Bojëra uji", "Tempera", "Gouache", "Akrilik", "Furça", "Paletë", "Lapsa ngjyrues",
      "Markera me ngjyra", "Shkumësa dylli", "Shkumësa pastel", "Plastelinë", "Argjilë",
      "EVA foam", "Glitter", "Ngjitëse dekorative", "Pom-pom", "Shkopinj druri", "Fije leshi",
      "Fije dekorative", "Rruaza", "Materiale për kolazh", "Materiale ricikluese",
      "Gërshërë kreative", "Stampa", "Forma dekorative", "Shirita dekorativë",
    ],
  },
  {
    category: "Materiale didaktike", // ekzistuese
    items: [
      "Puzzle edukative", "Lojëra edukative", "Domino edukative", "Bingo edukative",
      "Memory cards", "Kube edukative", "Lojëra logjike", "Lojëra matematikore",
      "Lojëra gjuhësore", "Materiale Montessori", "Materiale për zhvillim motorik",
      "Materiale për zhvillim të të menduarit", "Materiale për punë në grup",
      "Materiale për ushtrime individuale", "Materiale për vlerësim",
    ],
  },
  {
    category: "Materiale për aktivitete", // ekzistuese
    items: [
      "Balona", "Flamuj dekorativë", "Letra dekorative", "Kartolina", "Materiale për punime dore",
      "Materiale për projekte", "Materiale për ekspozita", "Materiale për panaire",
      "Materiale për gara", "Materiale për kuize", "Materiale për lojëra",
      "Materiale për role-play", "Kostume", "Aksesorë për shfaqje", "Maskota",
      "Dekorime për klasë", "Dekorime sezonale", "Materiale për festa shkollore",
      "Materiale për ditë ndërkombëtare",
    ],
  },
  {
    category: "Edukatë fizike", // ekzistuese (përfshin "dhe sport")
    items: [
      "Top futbolli", "Top basketbolli", "Top volejbolli", "Top gome", "Topa të vegjël",
      "Litarë kërcimi", "Konuse", "Rrathë", "Dyshekë sportivë", "Shkopinj sportivë",
      "Pengesa të vogla", "Shenja sportive", "Bilbila", "Kronometër", "Rrjetë volejbolli",
      "Pompa për topa", "Jelekë sportivë", "Medalje sportive", "Materiale për gara sportive",
    ],
  },
  {
    category: "Teknologji", // ekzistuese
    items: [
      "Laptop", "Tablet", "Tastierë", "Maus", "Maus pad", "USB flash", "Hard disk i jashtëm",
      "Kabllo HDMI", "Kabllo USB", "Adapter HDMI", "Adapter USB", "Projektor", "Ekran projektori",
      "Altoparlant", "Kufje", "Mikrofon", "Kamerë web", "Karikues", "Zgjatues elektrik",
      "Prizë multiple", "Bateri", "Telekomandë prezantimi", "Laser pointer",
    ],
  },
  {
    category: "Materiale për mësuesin", // e re
    items: [
      "Planifikim vjetor", "Planifikim mujor", "Planifikim javor", "Plan mësimor",
      "Fletë për përgatitje mësimore", "Fletë pune", "Teste", "Kuize", "Fletë vlerësimi",
      "Rubrika vlerësimi", "Lista kontrolli", "Fletë prezence", "Fletë monitorimi",
      "Fletë për detyra", "Fletë për projekte", "Fletë për portofol", "Kartela për nxënës",
      "Etiketa për nxënës", "Certifikata", "Diploma", "Mirënjohje", "Stickers shpërblyese",
      "Yje shpërblyese", "Vula", "Tabelë motivuese", "Tabelë përgjegjësish", "Tabelë orari",
      "Tabelë kalendari",
    ],
  },
  {
    category: "Materiale administrative", // e re
    items: [
      "Formularë", "Kërkesa", "Raporte", "Procesverbale", "Lista", "Evidenca",
      "Dosje administrative", "Zarfe", "Letër zyrtare", "Letër me logo", "Kartela identifikimi",
      "Regjistra", "Fletore procesverbalesh", "Dosje arkivimi", "Kuti arkivimi",
    ],
  },
  {
    category: "Materiale për mirëmbajtjen e klasës", // e re
    items: [
      "Peceta", "Letra kuzhine", "Letër higjienike", "Sapun", "Dezinfektues duarsh",
      "Dezinfektues sipërfaqesh", "Qese mbeturinash", "Qese për riciklim", "Doreza", "Sfunger",
      "Peceta mikrofibre", "Shporta mbeturinash", "Produkte pastrimi", "Aromatizues",
      "Kuti për materiale",
    ],
  },
  {
    category: "Pajisje për klasë", // e re
    items: [
      "Tavolinë nxënësi", "Karrige nxënësi", "Tavolinë mësuesi", "Karrige mësuesi", "Dollap",
      "Raft", "Bibliotekë klase", "Tabelë e bardhë", "Tabelë magnetike", "Tabelë korku",
      "Tabelë njoftimesh", "Organizues tavoline", "Organizues për lapsa", "Kuti magazinimi",
      "Orë muri", "Kalendari", "Varëse", "Perde", "Tapet për klasë",
    ],
  },
  {
    category: "Gjeografi dhe histori", // e re
    items: [
      "Harta e Kosovës", "Harta e Evropës", "Harta e botës", "Harta fizike", "Harta politike",
      "Atlas", "Hartë magnetike", "Modele gjeografike", "Kartela historike", "Postera historikë",
      "Linjë kohore", "Materiale për periudha historike", "Figura të personaliteteve historike",
    ],
  },
  {
    category: "Muzikë", // e re
    items: [
      "Instrumente ritmike", "Tamburinë", "Marakasa", "Triangël", "Ksilofon", "Flaut",
      "Nota muzikore", "Kartela muzikore", "Postera muzikorë", "Materiale për ritëm",
    ],
  },
  {
    category: "Mirëqenie dhe zhvillim social-emocional", // e re
    items: [
      "Kartela emocionesh", "Poster emocionesh", "Tabelë emocionesh", "Kartela situatash",
      "Lojëra sociale", "Materiale për komunikim", "Materiale për vetëvlerësim",
      "Materiale për empati", "Materiale për zgjidhjen e konflikteve", "Ditari i emocioneve",
      "Poster motivues", "Kartela motivuese",
    ],
  },
  {
    category: "Materiale për nxënës me nevoja të veçanta", // e re
    items: [
      "Materiale vizuale", "Kartela komunikimi", "Puzzle të thjeshta", "Materiale sensoriale",
      "Topa sensorë", "Materiale për motorikë fine", "Materiale për koordinim",
      "Lojëra edukative të përshtatura", "Tabela vizuale", "Orar vizual",
      "Kufje reduktuese të zhurmës", "Materiale për përqendrim",
    ],
  },
  {
    category: "Shpërblime dhe motivim", // e re
    items: [
      "Trofe", "Stickers", "Yje", "Vula motivuese", "Distinktivë", "Byzylykë motivues",
      "Çmime simbolike", "Dhurata edukative", "Libër si shpërblim", "Lodra edukative",
    ],
  },
  {
    category: "Festa dhe evente shkollore", // e re
    items: [
      "Dekorime", "Shirita", "Flamuj", "Posterë", "Materiale për skenë", "Materiale për dekorim",
      "Aksesorë", "Ftesa", "Materiale për fotografi",
    ],
  },
  {
    category: "Magazinim dhe organizim", // e re
    items: [
      "Kuti plastike", "Kuti kartoni", "Kuti me kapak", "Organizues", "Shporta",
      "Mbajtëse dokumentesh", "Mbajtëse librash", "Mbajtëse lapsash", "Organizues muri",
    ],
  },
];

async function main() {
  const orgId = 1;
  const seenNames = new Set<string>();
  let categoriesCreated = 0, categoriesReused = 0, materialsCreated = 0, materialsSkipped = 0;

  for (const group of DATA) {
    let category = await prisma.materialCategory.findFirst({ where: { organizationId: orgId, name: group.category } });
    if (!category) {
      category = await prisma.materialCategory.create({ data: { name: group.category, organizationId: orgId } });
      categoriesCreated++;
    } else {
      categoriesReused++;
    }

    for (const rawName of group.items) {
      const name = rawName.trim();
      if (seenNames.has(name)) { materialsSkipped++; continue; }
      seenNames.add(name);

      const existing = await prisma.material.findFirst({ where: { organizationId: orgId, name: { equals: name } } });
      if (existing) { materialsSkipped++; continue; }

      await prisma.material.create({
        data: { name, categoryId: category.id, organizationId: orgId, defaultUnit: "copë" },
      });
      materialsCreated++;
    }
  }

  console.log(`✅ Kategori: ${categoriesCreated} të reja, ${categoriesReused} ekzistuese (të ripërdorura).`);
  console.log(`✅ Materiale: ${materialsCreated} të krijuara, ${materialsSkipped} kaluar (ekzistonin/dublikatë).`);
}

main().finally(() => prisma.$disconnect());
