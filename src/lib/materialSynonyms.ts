// Sinonime shqip të parazgjedhura për artikujt e katalogut që kanë emër në
// anglisht ose që mësuesit i shkruajnë ndryshe. Shtohen te përputhja (nuk
// shkruhen në databazë) — redaktoje lirisht këtë listë. Sinonimet e tjera
// i mëson sistemi vetë kur administrata lidh një tekst me një artikull
// (tabela MaterialAlias). Çelësi = emri i saktë i artikullit në katalog.

export const DEFAULT_SYNONYMS: Record<string, string[]> = {
  "Marker whiteboard": ["marker për tabelë", "marker tabele", "marker për tabelë të bardhë", "marker për tabelën e bardhë", "marker i tabelës"],
  "Whiteboard": ["tabelë e bardhë", "tabela e bardhë"],
  "Mini whiteboard": ["tabelë e vogël", "tabela të vogla", "tabelë e vogël e bardhë"],
  "Fshirëse whiteboard": ["fshirëse tabele", "fshirëse për tabelë", "sfungjer tabele"],
  "Fshirëse për mini whiteboard": ["fshirëse për tabela të vogla"],
  "Shkumësa për mini whiteboard": ["shkumësa për tabela të vogla"],
  "Ngjitës stick": ["ngjitës shkop", "ngjitës letre", "ngjites stik"],
  "Post-it të vegjël": ["letra ngjitëse të vogla", "post it të vegjël", "postit të vegjël"],
  "Post-it të mëdhenj": ["letra ngjitëse të mëdha", "post it të mëdhenj", "postit të mëdhenj"],
  "Foam board": ["karton shkume", "pllakë shkume"],
  "Shkëlqyes/glitter": ["shkëlqyes", "brokat", "glitter"],
  "Markera brush": ["markera me furçë", "markera me maje furçe"],
  "Fletë EVA": ["fletë shkume", "gomë eva"],
  "Marker fluorescent i verdhë": ["marker fluoreshent i verdhë", "theksues i verdhë"],
  "Marker fluorescent rozë": ["marker fluoreshent rozë", "theksues rozë"],
  "Marker fluorescent jeshil": ["marker fluoreshent jeshil", "theksues jeshil"],
  "Marker fluorescent portokalli": ["marker fluoreshent portokalli", "theksues portokalli"],
  "Marker fluorescent blu": ["marker fluoreshent blu", "theksues blu"],
};
