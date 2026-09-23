// Katalogu i ri i materialeve shkollore (~500 artikuj, 22 kategori) — zëvendëson
// katalogun e vjetër. Përdoret nga butoni "Rifresko Katalogun" te Cilësimet/
// Materiale: fshin-butë (active:false) gjithçka ekzistuese, pastaj krijon këto
// kategori+materiale nga e para. Njësia e parazgjedhur është "copë" për të
// gjitha — admini mund ta ndryshojë individualisht më vonë nëse duhet.

export const MATERIAL_CATALOG_SEED: { category: string; items: string[] }[] = [
  {
    category: "Fletore dhe blloqe",
    items: [
      "Fletore me vija A5", "Fletore me katrorë A5", "Fletore me katrorë A4", "Fletore me vija A4",
      "Fletore me pika", "Fletore pa vija", "Fletore muzikore", "Fletore vizatimi", "Fletore me spirale",
      "Fletore me kapak të fortë", "Fletore me kapak plastik", "Fletore 40 fletë", "Fletore 60 fletë",
      "Fletore 80 fletë", "Fletore 100 fletë", "Fletore 120 fletë", "Fletore 160 fletë",
      "Bllok shënimesh A5", "Bllok shënimesh A4", "Bllok vizatimi A3", "Bllok vizatimi A4",
      "Bllok me ngjitëse", "Bllok memo", "Bllok për detyra shtëpie", "Bllok për shënime mësuesi",
    ],
  },
  {
    category: "Lapsa dhe mjete shkrimi",
    items: [
      "Laps HB", "Laps 2B", "Laps B", "Laps mekanik", "Minë për laps mekanik", "Laps me gomë",
      "Laps trekëndësh ergonomik", "Laps me ngjyra", "Stilolaps blu", "Stilolaps i zi", "Stilolaps i kuq",
      "Stilolaps i gjelbër", "Stilolaps me shumë ngjyra", "Stilolaps xhel", "Stilolaps me majë të hollë",
      "Stilolaps permanent", "Stilolaps për tabela të bardha", "Marker permanent i zi",
      "Marker permanent blu", "Marker permanent i kuq", "Marker fluorescent i verdhë",
      "Marker fluorescent rozë", "Marker fluorescent jeshil", "Marker fluorescent portokalli",
      "Marker fluorescent blu", "Fineliner", "Penë teknike", "Shkumës i bardhë", "Shkumës me ngjyra",
      "Mbajtëse lapsash", "Mbajtëse stilolapsash",
    ],
  },
  {
    category: "Ngjyra dhe art",
    items: [
      "Lapsa me ngjyra 12 copë", "Lapsa me ngjyra 24 copë", "Lapsa me ngjyra 36 copë",
      "Lapsa me ngjyra 48 copë", "Markera me ngjyra", "Markera pastel", "Markera brush", "Ngjyra druri",
      "Ngjyra dylli", "Ngjyra vaji", "Ngjyra uji", "Gouache", "Tempera", "Bojë akrilike",
      "Bojë për gishta", "Paletë për ngjyra", "Furça të holla", "Furça të trasha", "Set furçash",
      "Gotë për ujë", "Paletë plastike", "Përparëse për pikturë", "Letër vizatimi", "Letër akuareli",
      "Kanavacë e vogël", "Plastelinë", "Argjilë për modelim", "Brumë modelimi", "Shkëlqyes/glitter",
      "Glitter në shishe", "Ngjitëse dekorative", "Letër origami", "Letër me ngjyra", "Letër krep",
      "Letër metalike", "Karton me ngjyra", "Karton i bardhë", "Karton i zi", "Karton me shkëlqim",
    ],
  },
  {
    category: "Gjeometri dhe matematikë",
    items: [
      "Vizore 15 cm", "Vizore 20 cm", "Vizore 30 cm", "Vizore 50 cm", "Vizore fleksibile",
      "Trekëndësh 45°", "Trekëndësh 60°", "Këndmatës", "Kompas", "Kompas profesional", "Set gjeometrik",
      "Shabllon gjeometrik", "Shabllon rrethor", "Shabllon shkronjash", "Llogaritëse bazike",
      "Llogaritëse shkencore", "Numëratore për fëmijë", "Kubat matematikorë", "Shkopinj matematikorë",
      "Forma gjeometrike", "Tangram", "Zare matematikore", "Abakus", "Orë mësimore prej plastike",
      "Set fraksionesh",
    ],
  },
  {
    category: "Prerje dhe ngjitje",
    items: [
      "Gërshërë për fëmijë", "Gërshërë standarde", "Gërshërë me majë të rrumbullakët",
      "Gërshërë profesionale", "Ngjitës stick", "Ngjitës i lëngshëm", "Ngjitës transparent",
      "Ngjitës për dru", "Shirit ngjitës transparent", "Shirit ngjitës i gjerë", "Shirit dyanshëm",
      "Shirit dekorativ", "Shirit maskues", "Shirit izolues", "Dispenser për shirit", "Ngjitës me pika",
      "Ngjitës për artizanat", "Velcro ngjitës", "Shirit korrigjues", "Korrektor i lëngshëm",
    ],
  },
  {
    category: "Organizim dhe dokumente",
    items: [
      "Dosje A4", "Dosje A5", "Dosje me kapëse", "Dosje me llastik", "Dosje me xhepa",
      "Dosje plastike transparente", "Dosje me ndarje", "Regjistrator A4", "Regjistrator A5",
      "Ndarëse për regjistrator", "Folie plastike A4", "Folie plastike A5", "Zarf plastik",
      "Zarf dokumentesh", "Zarf me buton", "Dosje arkivimi", "Kuti dokumentesh", "Etiketa për dosje",
      "Etiketa ngjitëse", "Etiketa për libra", "Post-it të vegjël", "Post-it të mëdhenj",
      "Shënues faqeje", "Kapëse letre", "Kapëse metalike", "Kapëse bulldog", "Heqës kapësesh",
      "Stapler", "Stapler mini", "Gjilpëra për stapler", "Perforator", "Prerëse letre",
    ],
  },
  {
    category: "Produkte për nxënës",
    items: [
      "Çantë shkolle", "Çantë shpine", "Çantë sportive", "Penal", "Penal me dy ndarje",
      "Penal me tre ndarje", "Çantë për lapsa", "Shishe uji", "Termos", "Kuti ushqimi",
      "Etiketa për çantë", "Mbështjellës për libra", "Mbështjellës për fletore", "Llastikë për libra",
      "Dosje portative", "Mbajtëse dokumentesh", "Tabelë plastike me kapëse", "Tabelë shkrimi",
      "Tabelë magnetike", "Mini whiteboard", "Shkumësa për mini whiteboard",
      "Fshirëse për mini whiteboard", "Kalkulator xhepi",
    ],
  },
  {
    category: "Libra dhe materiale mësimore",
    items: [
      "Abetare", "Libra leximi", "Libra ushtrimesh", "Fletore pune", "Libra matematikë",
      "Libra shkencë", "Libra biologjie", "Libra kimie", "Libra fizike", "Libra historie",
      "Libra gjeografie", "Libra gjuhe", "Fjalor shqip", "Fjalor anglisht", "Fjalor gjermanisht",
      "Fjalor frëngjisht", "Fjalor ilustrues", "Atlas gjeografik", "Atlas anatomik",
      "Enciklopedi për fëmijë", "Libra edukativë", "Libra për ngjyrosje", "Libra me aktivitete",
      "Libra me puzzle", "Libra me eksperimente",
    ],
  },
  {
    category: "Produkte për mësues",
    items: [
      "Agjendë mësuesi", "Planifikues javor", "Planifikues mujor", "Ditari i klasës",
      "Regjistër klase", "Regjistër notash", "Bllok shënimesh mësuesi", "Dosje mësuesi",
      "Dosje për teste", "Dosje për nxënës", "Mbajtëse dokumentesh", "Marker whiteboard",
      "Marker permanent", "Fshirëse whiteboard", "Tabelë magnetike", "Magnetë për tabelë",
      "Kartela didaktike", "Kartela me pyetje", "Kartela alfabeti", "Kartela numrash",
    ],
  },
  {
    category: "Produkte për klasë",
    items: [
      "Whiteboard", "Tabelë magnetike", "Tabelë korku", "Tabelë për njoftime", "Orë muri",
      "Kalendari i klasës", "Harta e Kosovës", "Harta e Evropës", "Harta e botës", "Poster alfabeti",
      "Poster numrash", "Poster shumëzimi", "Poster rregullash të klasës", "Poster motivues",
      "Poster edukativ", "Poster biologjie", "Poster anatomie", "Poster gjeografie", "Poster historie",
      "Glob", "Magnetë alfabeti", "Magnetë numrash", "Kartela ngjyrash", "Kartela emocionesh",
      "Materiale didaktike Montessori", "Puzzle edukativ", "Lojëra matematikore", "Lojëra edukative",
      "Domino edukativ", "Puzzle hartash",
    ],
  },
  {
    category: "Laborator dhe shkencë",
    items: [
      "Gotë laboratorike", "Provëza", "Mbajtëse provëzash", "Pipeta plastike", "Hinkë laboratorike",
      "Cilindër matës", "Termometër shkollor", "Lupë", "Mikroskop", "Xham mikroskopik",
      "Magnet shkollor", "Komplet elektriciteti", "Komplet magnetizmi", "Komplet optike",
      "Model sistemi diellor", "Model skeleti", "Model zemre", "Model trupi të njeriut",
      "Model ADN-je", "Set eksperimentesh shkencore",
    ],
  },
  {
    category: "Teknologji dhe elektronikë",
    items: [
      "USB flash", "Kartë memorie", "Tastierë", "Maus", "Maus wireless", "Mouse pad", "Kufje",
      "Kufje me mikrofon", "Webkamera", "Altoparlant", "Kabllo HDMI", "Kabllo USB", "Adapter USB",
      "Karikues universal", "Power bank", "Projektor", "Ekran projektori", "Prezantues wireless",
      "Tablet për mësim", "Laptop shkollor", "Printer", "Toner", "Bojë printeri", "Letër printeri",
      "Laminator", "Folie laminimi", "Makineri për lidhje dokumentesh",
    ],
  },
  {
    category: "Letër dhe printim",
    items: [
      "Letër A4 80g", "Letër A4 100g", "Letër A4 120g", "Letër A3", "Letër A5", "Letër fotografike",
      "Letër termike", "Letër me ngjyra", "Letër vetëngjitëse", "Letër transparente", "Letër kalk",
      "Letër kartoni", "Letër për vizatim teknik", "Letër origami", "Letër kraft",
    ],
  },
  {
    category: "Higjienë për shkollë",
    items: [
      "Sapun i lëngshëm", "Sapun i ngurtë", "Dezinfektues duarsh", "Peceta të lagura", "Peceta letre",
      "Letër tualeti", "Peshqir letre", "Mbajtëse sapuni", "Dispenser sapuni", "Dispenser pecetash",
      "Qese mbeturinash", "Shporta mbeturinash", "Qese riciklimi", "Pastrues sipërfaqesh",
      "Sprej dezinfektues", "Doreza njëpërdorimëshe", "Maskë mbrojtëse", "Fshesë", "Lopatë",
      "Kosh riciklimi",
    ],
  },
  {
    category: "Ndihma e parë dhe siguria",
    items: [
      "Kuti e ndihmës së parë", "Fasha", "Garza sterile", "Leukoplast", "Shirita ngjitës mjekësorë",
      "Doreza njëpërdorimëshe", "Termometër", "Gërshërë të ndihmës së parë", "Pako akulli instant",
      "Solucion për pastrim", "Maskë CPR", "Batanije emergjence", "Shenjë \"Ndihma e parë\"",
    ],
  },
  {
    category: "Artizanat dhe projekte",
    items: [
      "Shkopinj druri", "Shkopinj akulloreje", "Pom-pom", "Fije leshi", "Fije pambuku",
      "Fije dekorative", "Rruaza plastike", "Rruaza druri", "Perla dekorative", "Fjongo",
      "Shirit dekorativ", "Pupla dekorative", "Sy plastikë për punime", "Forma shkumë EVA",
      "Fletë EVA", "Foam board", "Karton me teksturë", "Letër mëndafshi", "Letër holografike",
      "Letër glitter", "Forma prej druri", "Ngjitës glitter", "Bojë tekstili", "Stampila",
      "Bojë për stampila",
    ],
  },
  {
    category: "Administratë dhe zyrë",
    items: [
      "Letër A4 për administratë", "Toner printeri", "Fisha për printer", "Stapler profesional",
      "Perforator profesional", "Llogaritëse zyre", "Dosje arkivi", "Regjistra administrativë",
      "Zarfe të bardha", "Zarfe të mëdha", "Etiketa adresash", "Shirit paketimi", "Dispenser shiritash",
      "Gërshërë zyre", "Prerëse letre", "Kuti arkivi", "Kuti dokumentesh", "Mbajtëse lapsash",
      "Organizues tavoline", "Kalendar tavoline",
    ],
  },
  {
    category: "Sport dhe edukatë fizike",
    items: [
      "Top futbolli", "Top basketbolli", "Top volejbolli", "Top hendbolli", "Top gome", "Top tenisi",
      "Rrjetë volejbolli", "Rrjetë futbolli", "Konuse trajnimi", "Litar kërcimi", "Dyshek gjimnastikor",
      "Rrathë hula-hoop", "Shkopinj sportivë", "Bilbila", "Kronometër", "Pompa për topa",
      "Gjilpëra për pompë", "Jelekë sportivë", "Shenja për ekipe", "Medalje sportive",
    ],
  },
  {
    category: "Muzikë",
    items: [
      "Flutë", "Melodika", "Tamburinë", "Maraka", "Kastanjeta", "Triangël", "Ksilofon", "Daulle",
      "Pianika", "Instrumente ritmike për fëmijë", "Nota muzikore", "Fletore muzike", "Metronom",
    ],
  },
  {
    category: "Lojëra edukative",
    items: [
      "Puzzle 20 pjesë", "Puzzle 50 pjesë", "Puzzle 100 pjesë", "Puzzle matematikor",
      "Puzzle alfabeti", "Puzzle gjeografik", "Memory cards", "Domino", "Lojëra me fjalë",
      "Lojëra me numra", "Lojëra logjike", "Tangram", "Rubik Cube", "Kulla matematikore",
      "Lego edukativ", "Kube ndërtimi", "Set robotike për fëmijë",
    ],
  },
  {
    category: "Pajisje dhe mobilim klase",
    items: [
      "Tavolina nxënësish", "Karrige nxënësish", "Tavolinë mësuesi", "Karrige mësuesi",
      "Dollap klase", "Raft librash", "Raft për materiale", "Komodinë", "Organizues plastik",
      "Kuti lodrash", "Kuti materialesh", "Kosh letre", "Gardërobë klase", "Varëse rrobash",
      "Tabelë e bardhë", "Tabelë e gjelbër", "Tabelë korku", "Projektor", "Ekran projektori",
      "Mbajtëse projektori",
    ],
  },
  {
    category: "Produkte të tjera praktike",
    items: [
      "Çelësa USB", "Kabllo zgjatuese", "Prizë shumëfishe", "Bateri AA", "Bateri AAA",
      "Llambë tavoline", "Llambë LED", "Zgjatues elektrik", "Orë muri", "Kalkulator", "Kronometër",
      "Etiketa emri", "Kartela identifikimi", "Litar për kartela", "Badge holder",
      "Mbajtëse çelësash", "Kuti plastike", "Kuti organizimi", "Shportë organizimi",
      "Çanta për materiale mësimore",
    ],
  },
];
