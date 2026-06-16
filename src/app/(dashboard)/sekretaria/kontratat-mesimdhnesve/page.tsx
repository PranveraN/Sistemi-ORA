"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { Search, X, Printer, ChevronLeft, ChevronRight, FilePen, Clock, FileText } from "lucide-react";

interface StaffMember {
  id: number;
  emri: string;
  telefoni: string | null;
  lenda: string | null;
  nrPersonal: string | null;
  nrLlogarise: string | null;
  banka: string | null;
  totalBruto: number | null;
  cmimOres: number | null;
  oreMuaj: number | null;
  kontrata: string | null;
  kodi: string | null;
  tipi: string | null;
  status: string;
}

interface ContractData {
  emri: string;
  nrPersonal: string;
  profesioni: string;
  adresa: string;
  dataFillimit: string;
  dataMbarimit: string;
  dataFillimitPune: string;
  pagaBruto: string;
  nrLlogarise: string;
  banka: string;
  dataKontrates: string;
}

const P: React.CSSProperties = { lineHeight: "1.7", textAlign: "justify", fontSize: "10.5pt", marginBottom: "6px" };
const ART: React.CSSProperties = { fontWeight: "bold", fontSize: "11pt", textAlign: "center", marginBottom: "10px", marginTop: "20px" };

function EF({ value, onChange, placeholder, width }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: "inherit", fontSize: "inherit",
        background: value ? "transparent" : "#fffbeb",
        border: "none", outline: "none", padding: "0 2px",
        borderBottom: "1px dashed #aaa",
        width: width || "auto", minWidth: "60px",
        display: "inline-block",
      }}
    />
  );
}

const NR2_ITEMS = [
  "Të jetë në objektin e punës (shkollës) së paku 20 min para se të fillojë procesi mësimor (8:10 për mësimdhënësit me orar të plotë).",
  "Në fillim të vitit shkollor të hartojë planin vjetor, ndërsa gjatë vitit shkollor të hartojë planin mujor/dymujor 3-5 ditë para fillimit të muajit vijues dhe të orës mësimore më së voni 1-2 ditë para fillimit të ditës që planifikohet. Të gjitha planet duhet të ngarkohen në formë elektronike në sistemin (eShkollori) që posedon shkolla.",
  "Organizon dhe realizon procesin mësimor-edukativ me të gjitha mjetet e konkretizimit që posedon institucioni, në bazë të plan-programit mësimor-zyrtar të organizuar nga MASHTI, DKA dhe Shkolla.",
  "Evidentimin (shkruarjen) e orës mësimore në ditarin fizik (sipas nevojës edhe elektronik).",
  "Evidentimin e mungesave të nxënësve në ditar.",
  "T'i përmbahet me korrektësi kontekstit moral dhe profesional, të ruajë autoritetin para nxënësve duke mos përdorur asnjëherë fjalor banal, në komunikim me nxënës dhe të tjera, ose përdorim të dhunës dhe të bisedave të panevojshme jashtë temave mësimore.",
  "Njofton me shkrim drejtorin e shkollës, së paku një ditë përpara për kohën që parashikon të mungojë nga puna, përveç rasteve të veçanta, që duhet prap të bëjë njoftim përmes formave elektronike.",
  "Të mos largojë nxënësit nga ora mësimore. Në rastet e veçanta mësimdhënësi degron nxënësin te menaxhmenti duke qenë edhe ai prezent.",
  "Respekton kohëzgjatjen e orës mësimore (nuk përfundon më herët ose nuk vonohet më shumë se sa është e planifikuar sipas orarit shkollor).",
  "Kompenzon orët e humbura pavarësisht nga arsyet e mungesës.",
  "Merr pjesë aktive në mbledhjet e organizuara nga menaxhmenti i shkollës.",
  "Plotëson me kohë dokumentacionin pedagogjik dhe administrativ në ditar, libër amë dhe dokumentet tjera të nevojshme si kujdestar i klasës apo mësimdhënës.",
  "Angazhohet gjithanshëm në zhvillimin e aktiviteteve jashtëmësimore të nxënësve.",
  "Përgatitë në mënyrën më të mirë njësitë mësimore, jep udhëzimet për burimet e informacoineve dhe bënë konsultimet tjera të nevojshme rreth projekteve, testeve ose për nxënësit e kl IX për testin e arritshmërisë.",
  "T'u ofrojë mësimdhënie cilësore nxënësve të bazuar në reforma dhe trajnime.",
  "Kërkon nga nxënësit ambient të pastër, rend, rregull dhe disiplinë gjatë orës mësimore.",
  "Në përfundim të orës së fundit, mësimdhënësi është i obliguar të përcjellë nxënësit deri në dalje nga objekti i shkollës, duke siguruar që nxënësit kanë rregulluar ambientin e klasës, dhe nuk kanë harruar diçka.",
  "Mësimdhënësi kujdestar i ditës duhet të jetë në objektin e shkollës 30 min para fillimit të procesit mësimor. Të kontrollojë klasët se a është çdo gjë në rregull para dhe pas përfundimit të procesit mësimor. Të plotësojë me rregull librin e kujdestarisë ditore. Të njoftojë me kohë në gurpet e komunikimit nëse për shkaqe të trafikut ose të tjera është duke u vonuar dhe se duhet t'a mbulojë dikush tjetër.",
  "Të mos pranojë nxënësit pa uniformë në orën mësimore.",
  "Të mos organizojë kurse me nxënësit e tij jashtë objektit shkollor.",
  "Përgatit raportin e suksesit për lëndën e vet në mënyrë ekzakte, sipas kohës dhe mënyrës së kërkuar.",
  "Është i obliguar që brenda një gjysmëvjetori/periudhe t'i vlerësojë nxënësit së paku me dy nota në ditar, krahas kësaj të mbajë evidenca gjatë gjithë kohës dhe vlerësimi duhet të jetë sistematik, objektiv dhe publik (transparent).",
  "Të evidentojë vlerësimin në mënyrë sistematike në sistemin (eShkollori) që posedon shkolla.",
  "Mban mësimin e rregullt sipas orarit mësimor dhe sipas nevojës mban edhe mësim plotësues dhe mësim praktik në shkollë.",
  "Mësimdhënësi duhet të plotësojë të dhënat e kërkuara nga menaxhmenti në sistemet e ndryshme elektronike që përdorë shkolla. Ai është përgjegjës për rolin e tij në këto sisteme.",
  "Kryen punë dhe detyra tjera të parapara me ligj dhe akte tjera normative të shkollës (kujdestaria e klasës, kujdestaria kryesore dhe ndihmëse e ditës, angazhime të tjera me kërkesë të drejtorisë së shkollës).",
];

function ContractOrarPlote({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const today = new Date();
  const todayFmt = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

  const [d, setD] = useState<ContractData>({
    emri: staff.emri || "",
    nrPersonal: staff.nrPersonal || "",
    profesioni: staff.lenda || "",
    adresa: "",
    dataFillimit: "",
    dataMbarimit: "",
    dataFillimitPune: "",
    pagaBruto: staff.totalBruto ? String(staff.totalBruto) : "",
    nrLlogarise: staff.nrLlogarise || "",
    banka: staff.banka || "",
    dataKontrates: todayFmt,
  });

  const set = (k: keyof ContractData) => (v: string) => setD(p => ({ ...p, [k]: v }));
  const backdropRef = useRef(false);

  const handlePrint = () => {
    const content = document.getElementById("staff-contract-content")?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=960,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Kontratë — ${staff.emri}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; background: #fff; }
  @page { size: A4; margin: 18mm 18mm 18mm 18mm; }
  input { border: none !important; background: transparent !important; font-family: inherit; font-size: inherit; padding: 0 2px; outline: none; display: inline; min-width: 0; }
</style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6"
      onMouseDown={e => { backdropRef.current = e.target === e.currentTarget; }}
      onClick={e => { if (backdropRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl mx-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl z-10">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <FilePen className="w-4 h-4 text-violet-500" />
            Kontratë me Orar të Plotë — {staff.emri}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Contract body */}
        <div className="p-8" id="staff-contract-content">
          <div style={{ fontFamily: "'Times New Roman', serif", color: "#000", maxWidth: "850px", margin: "0 auto" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <img src="/stema.svg" alt="" style={{ width: "70px", height: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              <div style={{ textAlign: "center", flex: 1, padding: "0 16px" }}>
                <div style={{ fontSize: "13pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Shkolla fillore dhe e mesme e ulët "Akademia Ora" në Prishtinë
                </div>
                <div style={{ fontSize: "13pt", fontWeight: "bold", marginTop: "6px", textTransform: "uppercase" }}>
                  Kontratë pune për kohë të caktuar
                </div>
              </div>
              <img src="/logo.png" alt="" style={{ width: "90px", height: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            </div>

            <p style={{ ...P, marginBottom: "14px" }}>
              Në bazë të Ligjit të Punës Nr.03/L-212, Ligjit për Arsim në Komunat e Republikës së Kosovës Nr.03/L-068 dhe Ligjit parauniversitar në Republikën e Kosovës Nr.04/32 si dhe në mbështetje të nenit 10 të Ligjit të punës, palët kontraktuese si subjekte të marrëdhënies juridike të punës lidhin këtë.
            </p>

            {/* Neni 1 */}
            <div style={ART}>1. Neni 1</div>
            <p style={P}>
              Me këtë kontratë: <strong>"Akademia ORA" Sh.p.k., Nr. Unik 810850091</strong> të cilin e përfaqëson <strong>Nexhmedin Kahrimani</strong> (me tekstin e mëtejshëm: Punëdhënësi) lidhë kontratë pune me{" "}
              <EF value={d.emri} onChange={set("emri")} placeholder="Emri Mbiemri" width="160px" />, nr. personal{" "}
              <EF value={d.nrPersonal} onChange={set("nrPersonal")} placeholder="Nr. Personal" width="130px" />,{" "}
              <EF value={d.profesioni} onChange={set("profesioni")} placeholder="Profesioni/Lënda" width="150px" /> me adresë banimi{" "}
              <EF value={d.adresa} onChange={set("adresa")} placeholder="Adresa" width="160px" /> (me tekstin e mëtejshëm: E/I punësuara/i).
            </p>

            {/* Neni 2 */}
            <div style={ART}>2. Neni 2</div>
            <p style={{ ...P, fontStyle: "italic", fontWeight: "bold" }}>E punësuara do të kryej këto detyra të punës:</p>
            {NR2_ITEMS.map((text, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "4px", fontSize: "10.5pt", lineHeight: "1.65", textAlign: "justify" }}>
                <span style={{ flexShrink: 0 }}>2.{i + 1}.</span>
                <span>{text}</span>
              </div>
            ))}

            {/* Neni 3 */}
            <div style={ART}>3. Neni 3</div>
            <p style={P}>3.1. E punësuara do të kryejë punët në: Objektin e shkollës "Akademia Ora" përveç rasteve specifike ku mësimi mund të realizohet në lokacione të ndryshme.</p>

            {/* Neni 4 */}
            <div style={ART}>4. Neni 4</div>
            <p style={P}>4.1. E punësuara themelon marrëdhënie pune, në:</p>
            <p style={P}>
              1) Kohë të caktuar, duke filluar nga:{" "}
              <EF value={d.dataFillimit} onChange={set("dataFillimit")} placeholder="DD.MM.YYYY" width="100px" />, deri më:{" "}
              <EF value={d.dataMbarimit} onChange={set("dataMbarimit")} placeholder="DD.MM.YYYY" width="100px" />.
            </p>

            {/* Neni 5 */}
            <div style={ART}>5. Neni 5</div>
            <p style={P}>
              E punësuara është e detyruar të fillojë punën, më:{" "}
              <EF value={d.dataFillimitPune} onChange={set("dataFillimitPune")} placeholder="DD.MM.YYYY" width="100px" />, përveç rasteve kur institucioni u jep leje për arsye të ndryshme (pushimet vjetore etj).
            </p>

            {/* Neni 6 */}
            <div style={ART}>6. Neni 6</div>
            <p style={P}>6.1. E punësuara e cila fillon punën për herë të parë në vendin e punës do t'i nënshtrohet një periudhe prove prej 3 muajve. Gjatë kësaj kohe do t'i kryejë detyrat e përcaktuara në objektin e kësaj kontrate. Pagesa gjatë periudhës së provës arrithet me marrëveshjen e palëve nuk është e njëjtë si me mësimdhënësit që punojnë më shumë se një vit shkollor.</p>
            <p style={P}>6.2. Gjatë periudhës së provës punëdhënësi ose i punësauri mund të bëjnë zgjidhjen e kontratës, duke njoftuar me shkrim njëri-tjetrin me njoftim paraprak prej shtatë (7) ditësh.</p>
            <p style={P}>6.3. Në këtë rast i punësuari do t'i ktheje punëdhënësit të gjithë materialin (dokumente, mjete pune etj) që ai ka marrë në dispozicion gjatë kësaj periudhe dhe vetëm pas kësaj punëdhënësi do t'i shlyejë atij detyrimet financiare që përcaktohen për ditët e punës së kryer.</p>

            {/* Neni 7 */}
            <div style={ART}>7. Neni 7</div>
            <p style={P}>7.1. E punësuara themelon marrëdhënie pune me orar <strong>të plotë</strong>. <strong>Orari i plotë</strong> është 5 ditë nga: 8 orë, ndërsa në javë: 40 orë.</p>

            {/* Neni 8 */}
            <div style={ART}>8. Neni 8</div>
            <p style={P}>
              8.1. Të punësuarës i caktohet paga bazë për punën të cilën e kryen për punëdhënësin, në lartësi prej:{" "}
              <EF value={d.pagaBruto} onChange={set("pagaBruto")} placeholder="___" width="70px" /> euro bruto e cila do të paguhet nga data 5 deri 10 të muajit në xhirollogari:{" "}
              <EF value={d.nrLlogarise} onChange={set("nrLlogarise")} placeholder="Nr. Llogarisë" width="190px" /> në{" "}
              <EF value={d.banka} onChange={set("banka")} placeholder="Banka" width="100px" />.
            </p>
            <p style={P}>8.2. Kur dita e pagesës bie ditë pushimi, pagesa do të behet ditën e parë të fillimit të punës pas pushimit.</p>
            <p style={P}>8.3. Nga paga bruto punonjësit i zbatohet:</p>
            <p style={P}>8.4. Tatimi mbi të ardhurat personale, në masën e përcaktuar nga ligji "Për tatimin mbi të ardhurat personale".</p>
            <p style={P}>8.5. Taksa apo detyrime të tjera ligjore që duhet të rëndojnë mbi të ardhurat personale.</p>

            {/* Neni 9 */}
            <div style={ART}>9. Neni 9</div>
            <p style={P}>E punësuara ka të drejtë në kompensim të pagës pa u angazhuar në punë, në rastet si në vijim:</p>
            {["gjatë ditëve të festave në të cilat nuk punohet;", "gjatë kohës së shfrytëzimit të pushimit vjetor;", "gjatë aftësimit dhe përsosjes profesionale për të cilën është dërguar nga institucioni dhe", "gjatë ushtrimit të funksioneve publike për të cilat nuk paguhet."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>{i + 1}) {t}</p>
            ))}

            {/* Neni 10 */}
            <div style={ART}>10. Neni 10</div>
            <p style={P}>10.1. E punësuara ka të drejtën e pushimit vjetor të paguar për katër javë kalendarike pune (15 korrik – 15 gusht). Vërtetimi për pushimin vjetor të paguar jepet për çdo vit kalendarik dhe vlenë vetëm për mësimdhënësit me orar të plotë të cilët paraqesën kërkesë.</p>
            <p style={P}>10.2. E punësuara me orar të plotë nuk ka të drejtë të ndaj ditët e pushimit vjetor në periudha tjera përveç në kohën e përcaktuar sipas nenit 10, paragrafit 10.1.</p>
            <p style={P}>10.3. Mësimdhënësit të cilët nuk janë me orar të plotë paguhen vetëm për orët mësimore dhe nuk mund të shfrytëzojnë pushimin vjetor të paguar, dhe çfarëdo pushimi tjetër sipas kalendarit shkollor.</p>
            <p style={P}>10.4. E punësuara ka të drejtë të marrë pesë (5) ditë pushimi të paguara për rastet kur ai/ajo martohet, në rast të vdekjes së anëtarit të ngushtë të familjes; tri (3) ditë në rast të lindjes së fëmijës.</p>

            {/* Neni 11 */}
            <div style={ART}>11. Neni 11</div>
            <p style={P}>11.1. E punësuara e cila për herë të parë themelon marrëdhënie pune ose e cila nuk ka ndërprerje më tepër se pesë (5) ditë pune, ka të drejtën e shfrytëzimit të pushimit vjetor pas gjashtë (6) muajve të punës së pandërprerë. Pushimi në sistemin arsimor realizohet me (15 korrik – 15 gusht) të atij viti.</p>

            {/* Neni 12 */}
            <div style={ART}>12. Neni 12</div>
            <p style={P}>12.1. E punësuara është përgjegjëse për kompensimin e dëmit për punën ose në lidhje me punën, nëse me qëllim ose nga pakujdesia i ka shkaktuar dëm punëdhënësit.</p>
            <p style={P}>12.2. E punësuara është përgjegjëse edhe për kompensimin e dëmit, nëse me fajin e saj i ka shkaktuar dëm palës së tretë, dëm për të cilin punëdhënësi e ka kompensuar.</p>

            {/* Neni 13 */}
            <div style={ART}>13. Neni 13</div>
            <p style={P}>Të punësuarës i ndërprehet marrëdhënia e punës nga punëdhënësi, nëse:</p>
            {["ndërprerja e tillë arsyetohet për arsye ekonomike, teknike ose organizative;", "e punësuara nuk është më e aftë të kryejë detyrat e punës;", "në rastet e rënda të sjelljes së keqe të të punësuarit;", "për shkak të mospërmbushjes së pakënaqshme të detyrave të punës, dhe", "për rastet e tjera të cilat janë përcaktuar me Ligjin e Punës."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>{i + 1}) {t}</p>
            ))}

            {/* Neni 14 */}
            <div style={ART}>14. Neni 14</div>
            <p style={P}>14.1. Punëdhënësi obligohet të sigurojë dhe të zbatojë mjetet dhe masat e mbrojtjes në punë, sipas legjislacionit në fuqi.</p>
            <p style={P}>14.2. E punësuara është e detyruar t'iu përmbahet masave të caktuara të mbrojtjes në punë.</p>

            {/* Neni 15 */}
            <div style={ART}>15. Neni 15</div>
            <p style={P}>Punëdhënësi obligohet t'i paguajë kontributet për skemat pensionale të obligueshme dhe skemat e tjera të përcaktuara me Ligj.</p>

            {/* Neni 16 */}
            <div style={ART}>16. Neni 16</div>
            <p style={P}>Për kontestet eventuale të moszbatimit të kësaj Kontrate, palët kontraktuese e pranojnë kompetencën e Gjykatës Komunale në Prishtinë.</p>

            {/* Neni 17 */}
            <div style={ART}>17. Neni 17</div>
            <p style={P}>Kjo kontrate mund të shkëputet menjëhërë:</p>
            <p style={P}>17.1. Kur e punësuara nuk i përmbahet kushteve të kontratës.</p>
            <p style={P}>17.2. Kur e punësuara vepron me faj të rëndë ose thyen në mënyrë të përsëritur rregullat e përcaktuara sipas kontratës.</p>
            <p style={P}>17.3. Kur mbyllet aktiviteti i kompanisë ose një pjesë e aktivitetit të saj e cila ka lidhje me vendin e punës së të punësuarit.</p>
            <p style={P}>17.4. Kjo kontratë mund të zgjidhet me kërkesën e njërës palë, me kusht që kërkesa t'i paraqitet me shkrim palës tjetër të paktën 1 muaj përpara zgjidhjes se kontratës. Nëse e punësuara, ka konfirmuar vazhimin e kontratës për një vit (ose më shume) shkollor ai nuk ka të drejtë të shkëpus kontratën deri në përfundim të atij (atyre) viti/eve.</p>
            <p style={P}>17.5. Në përputhje me kapitullin XIV të Kodit të Punës, përveç "arsyeve" të justifikuara, punëdhënësi ka të drejtë të përfundojë menjëherë kontratën edhe për arsyet e "pajustifikuara".</p>

            {/* Neni 18 */}
            <div style={ART}>18. Neni 18</div>
            <p style={P}>Sanksionet në rast të mospërmbushjes së detyrave dhe obligimeve nga i punësuari mund të aplikohen si më poshtë:</p>
            <p style={P}>18.1. Në rast të mospërmbushjes së detyrave, me dashje apo nga pakujdesia, punëdhënësi mund të marrë këto masa ndaj të punësuarit:</p>
            {["Vërejtje me gojë.", "Vërejtje me shkrim.", "Gjoba në përputhje me legjislacionin në fuqi.", "Pushim nga puna."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>{i + 1}. {t}</p>
            ))}

            {/* Neni 19 */}
            <div style={ART}>19. Neni 19</div>
            <p style={P}>E punësuara duhet t'i paraqesë elementet e mëposhtme të nevojshme për krijimin e dosjes së saj dhe në mënyrë të veçantë t'i paraqesë diplomat që ka deklaruar.</p>
            {["Diplomën universitare (të noterizuar tek noteri).", "Kartela e bankës.", "Curiculum vitae.", "Kopjen e mjetit të identifikimit ose kopjen e pasaportës.", "Vërtetim që nuk është nën hetime.", "Certifikatën shëndetësore jo më të vjetër se 6 muaj.", "Trajnime të përfunduara."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>● {t}</p>
            ))}

            {/* Neni 20 */}
            <div style={ART}>20. Neni 20</div>
            <p style={P}>
              Pas njoftimit me përmbajtjen e Kontratës, kjo Kontratë nga palët kontraktuese u nënshkrua më datën:{" "}
              <EF value={d.dataKontrates} onChange={set("dataKontrates")} placeholder="DD.MM.YYYY" width="100px" /> në Prishtinë, në dy kopje autentike, nga të cilat, secilës pale i mbetet nga një kopje.
            </p>

            {/* Nënshkrimet */}
            <div style={{ marginTop: "50px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "none", width: "46%", verticalAlign: "bottom" }}>
                      <div style={{ fontSize: "10.5pt", marginBottom: "40px" }}>
                        <strong>E punësuara:</strong><br />
                        Emri: {d.emri}
                      </div>
                      <div style={{ borderBottom: "1px solid #000", marginBottom: "4px" }}></div>
                      <div style={{ fontSize: "9.5pt" }}>Nënshkrimi</div>
                    </td>
                    <td style={{ border: "none", width: "8%" }}></td>
                    <td style={{ border: "none", width: "46%", verticalAlign: "bottom" }}>
                      <div style={{ fontSize: "10.5pt", marginBottom: "40px" }}>
                        <strong>Drejtori i shkollës "Akademia Ora":</strong><br />
                        <strong>Valon Hoxha</strong>
                      </div>
                      <div style={{ borderBottom: "1px solid #000", marginBottom: "4px" }}></div>
                      <div style={{ fontSize: "9.5pt" }}>Nënshkrimi</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

interface PartContractData {
  emri: string;
  nrPersonal: string;
  profesioni: string;
  adresa: string;
  diteJave: string;
  oreJave: string;
  dataFillimit: string;
  dataMbarimit: string;
  dataFillimitPune: string;
  cmimOres: string;
  nrLlogarise: string;
  banka: string;
  dataKontrates: string;
}

function ContractOrarPjesshme({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const today = new Date();
  const todayFmt = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

  const [d, setD] = useState<PartContractData>({
    emri: staff.emri || "",
    nrPersonal: staff.nrPersonal || "",
    profesioni: staff.lenda || "",
    adresa: "",
    diteJave: "",
    oreJave: "",
    dataFillimit: "",
    dataMbarimit: "",
    dataFillimitPune: "",
    cmimOres: staff.cmimOres ? String(staff.cmimOres) : "",
    nrLlogarise: staff.nrLlogarise || "",
    banka: staff.banka || "",
    dataKontrates: todayFmt,
  });

  const set = (k: keyof PartContractData) => (v: string) => setD(p => ({ ...p, [k]: v }));
  const backdropRef = useRef(false);

  const handlePrint = () => {
    const content = document.getElementById("staff-part-contract-content")?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=960,height=800");
    if (!w) return;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Kontratë Gjysmë Orari — ${staff.emri}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; background: #fff; }
  @page { size: A4; margin: 18mm 18mm 18mm 18mm; }
  input { border: none !important; background: transparent !important; font-family: inherit; font-size: inherit; padding: 0 2px; outline: none; display: inline; min-width: 0; }
</style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6"
      onMouseDown={e => { backdropRef.current = e.target === e.currentTarget; }}
      onClick={e => { if (backdropRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl mx-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl z-10">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-teal-500" />
            Kontratë me Orar të Pjesshëm — {staff.emri}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Contract body */}
        <div className="p-8" id="staff-part-contract-content">
          <div style={{ fontFamily: "'Times New Roman', serif", color: "#000", maxWidth: "850px", margin: "0 auto" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <img src="/stema.svg" alt="" style={{ width: "70px", height: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
              <div style={{ textAlign: "center", flex: 1, padding: "0 16px" }}>
                <div style={{ fontSize: "13pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Shkolla fillore dhe e mesme e ulët "Akademia Ora" në Prishtinë
                </div>
                <div style={{ fontSize: "13pt", fontWeight: "bold", marginTop: "6px", textTransform: "uppercase" }}>
                  Kontratë pune për kohë të caktuar
                </div>
              </div>
              <img src="/logo.png" alt="" style={{ width: "90px", height: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
            </div>

            <p style={{ ...P, marginBottom: "14px" }}>
              Në bazë të Ligjit të Punës Nr.03/L-212, Ligjit për Arsim në Komunat e Republikës së Kosovës Nr.03/L-068 dhe Ligjit parauniversitar në Republikën e Kosovës Nr.04/32 si dhe në mbështetje të nenit 10 të Ligjit të punës, palët kontraktuese si subjekte të marrëdhënies juridike të punës lidhin këtë.
            </p>

            {/* Neni 1 */}
            <div style={ART}>1. Neni 1</div>
            <p style={P}>
              Me këtë kontratë: <strong>"Akademia ORA" Sh.p.k., Nr. Unik 810850091</strong> të cilin e përfaqëson <strong>Nexhmedin Kahrimani</strong> (me tekstin e mëtejshëm: Punëdhënësi) lidhë kontratë pune me{" "}
              <EF value={d.emri} onChange={set("emri")} placeholder="Emri Mbiemri" width="160px" />, nr. personal{" "}
              <EF value={d.nrPersonal} onChange={set("nrPersonal")} placeholder="Nr. Personal" width="130px" />,{" "}
              <EF value={d.profesioni} onChange={set("profesioni")} placeholder="Profesioni/Lënda" width="150px" />, me adresë banimi ne{" "}
              <EF value={d.adresa} onChange={set("adresa")} placeholder="Adresa" width="160px" />, (me tekstin e mëtejshëm: e punësuara).
            </p>

            {/* Neni 2 */}
            <div style={ART}>2. Neni 2</div>
            <p style={{ ...P, fontStyle: "italic", fontWeight: "bold" }}>E punësuara do të kryej këto detyra të punës:</p>
            {NR2_ITEMS.map((text, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "4px", fontSize: "10.5pt", lineHeight: "1.65", textAlign: "justify" }}>
                <span style={{ flexShrink: 0 }}>2.{i + 1}.</span>
                <span>{text}</span>
              </div>
            ))}

            {/* Neni 3 */}
            <div style={ART}>3. Neni 3</div>
            <p style={P}>3.1. I punësuari do të kryejë punët në: Objektin e shkollës "Akademia Ora" përveç rasteve specifike ku mësimi mund të realizohet në lokacione të ndryshme.</p>

            {/* Neni 4 */}
            <div style={ART}>4. Neni 4</div>
            <p style={P}>4.1. I punësuari themelon marrëdhënie pune, në:</p>
            <p style={P}>
              1) Kohë të caktuar, duke filluar nga: prej:{" "}
              <EF value={d.dataFillimit} onChange={set("dataFillimit")} placeholder="DD.MM.YYYY" width="100px" /> dhe mbaron{" "}
              <EF value={d.dataMbarimit} onChange={set("dataMbarimit")} placeholder="DD.MM.YYYY" width="100px" />.
            </p>

            {/* Neni 5 */}
            <div style={ART}>5. Neni 5</div>
            <p style={P}>
              I punësuari është i detyruar të fillojë punën, më:{" "}
              <EF value={d.dataFillimitPune} onChange={set("dataFillimitPune")} placeholder="DD.MM.YYYY" width="100px" />, përveç rasteve kur institucioni u jep leje për arsye të ndryshme (pushimet vjetore etj).
            </p>

            {/* Neni 6 */}
            <div style={ART}>6. Neni 6</div>
            <p style={P}>6.1. I punësuari i cili fillon punën për herë të parë në vendin e punës do t'i nënshtrohet një periudhe prove prej 3 muajve. Gjatë kësaj kohe do t'i kryejë detyrat e përcaktuara në objektin e kësaj kontrate. Pagesa gjatë periudhës së provës arrithet me marrëveshjen e palëve nuk është e njëjtë si me mësimdhënësit që punojnë më shumë se një vit shkollor.</p>
            <p style={P}>6.2. Gjatë periudhës së provës punëdhënësi ose i punësauri mund të bëjnë zgjidhjen e kontratës, duke njoftuar me shkrim njëri-tjetrin me njoftim paraprak prej shtatë (7) ditësh.</p>
            <p style={P}>6.3. Në këtë rast I punësuari do t'i ktheje punëdhënësit të gjithë materialin (dokumente, mjete pune etj) që ai ka marrë në dispozicion gjatë kësaj periudhe dhe vetëm pas kësaj punëdhënësi do t'i shlyejë atij detyrimet financiare që përcaktohen për ditët e punës së kryer.</p>

            {/* Neni 7 — specifik për gjysmë orari */}
            <div style={ART}>7. Neni 7</div>
            <p style={P}>
              7.1. I punësuari <strong><EF value={d.emri} onChange={set("emri")} placeholder="Emri Mbiemri" width="160px" /></strong> punon{" "}
              <EF value={d.diteJave} onChange={set("diteJave")} placeholder="2" width="40px" /> ditë, ose{" "}
              <EF value={d.oreJave} onChange={set("oreJave")} placeholder="8" width="40px" /> orë në javë.
            </p>
            <p style={P}>
              7.2. Të punësuarit i caktohet paga bazë për punën të cilën e kryen për punëdhënësin, në lartësi prej:{" "}
              <EF value={d.cmimOres} onChange={set("cmimOres")} placeholder="___" width="60px" /> euro/ora, e cila do të paguhet nga data 5 deri 10 të muajit në xhirollogari:{" "}
              <EF value={d.nrLlogarise} onChange={set("nrLlogarise")} placeholder="Nr. Llogarisë" width="190px" /> në{" "}
              <EF value={d.banka} onChange={set("banka")} placeholder="Banka" width="100px" />.
            </p>
            <p style={P}>7.3. Kur dita e pagesës bie ditë pushimi, pagesa do të behet ditën e parë të fillimit të punës pas pushimit.</p>
            <p style={P}>7.4. Nga paga bruto punonjësit i zbatohet:</p>
            <p style={P}>7.5. Tatimi mbi të ardhurat personale, në masën e përcaktuar nga ligji "Për tatimin mbi të ardhurat personale".</p>
            <p style={P}>7.6. Taksa apo detyrime të tjera ligjore që duhet të rëndojnë mbi të ardhurat personale.</p>

            {/* Neni 9 (kapitulli 8) */}
            <div style={ART}>8. Neni 9</div>
            <p style={P}>I punësuari ka të drejtë në kompensim të pagës pa u angazhuar në punë, në rastet si në vijim:</p>
            {["gjatë ditëve të festave në të cilat nuk punohet;", "gjatë kohës së shfrytëzimit të pushimit vjetor;", "gjatë aftësimit dhe përsosjes profesionale për të cilën është dërguar nga institucioni dhe", "gjatë ushtrimit të funksioneve publike për të cilat nuk paguhet."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>{i + 1}) {t}</p>
            ))}

            {/* Neni 10 (kapitulli 9) */}
            <div style={ART}>9. Neni 10</div>
            <p style={P}>9.1. I punësuari ka të drejtën e pushimit vjetor të paguar për katër javë kalendarike pune (15 korrik – 15 gusht). Vërtetimi për pushimin vjetor të paguar jepet për çdo vit kalendarik dhe vlenë vetëm për mësimdhënësit me orar të plotë të cilët paraqesën kërkesë.</p>
            <p style={P}>9.2. I punësuari me orar të plotë nuk ka të drejtë të ndaj ditët e pushimit vjetor në periudha tjera përveç në kohën e përcaktuar sipas nenit 10, paragrafit 10.1.</p>
            <p style={P}>9.3. Mësimdhënësit të cilët nuk janë me orar të plotë paguhen vetëm për orët mësimore dhe nuk mund të shfrytëzojnë pushimin vjetor të paguar, dhe çfarëdo pushimi tjetër sipas kalendarit shkollor.</p>
            <p style={P}>9.4. I punësuari ka të drejtë të marrë pesë (5) ditë pushimi të paguara për rastet kur ai/ajo martohet, në rast të vdekjes së anëtarit të ngushtë të familjes; tri (3) ditë në rast të lindjes së fëmijës.</p>

            {/* Neni 11 (kapitulli 10) */}
            <div style={ART}>10. Neni 11</div>
            <p style={P}>10.1. I punësuari e cila për herë të parë themelon marrëdhënie pune ose e cila nuk ka ndërprerje më tepër se pesë (5) ditë pune, ka të drejtën e shfrytëzimit të pushimit vjetor pas gjashtë (6) muajve të punës së pandërprerë. Pushimi në sistemin arsimor realizohet me (15 korrik – 15 gusht) të atij viti.</p>

            {/* Neni 12 (kapitulli 11) */}
            <div style={ART}>11. Neni 12</div>
            <p style={P}>11.1. I punësuari është përgjegjëse për kompensimin e dëmit për punën ose në lidhje me punën, nëse me qëllim ose nga pakujdesia i ka shkaktuar dëm punëdhënësit.</p>
            <p style={P}>11.2. I punësuari është përgjegjëse edhe për kompensimin e dëmit, nëse me fajin e saj i ka shkaktuar dëm palës së tretë, dëm për të cilin punëdhënësi e ka kompensuar.</p>

            {/* Neni 13 (kapitulli 12) */}
            <div style={ART}>12. Neni 13</div>
            <p style={P}>Të punësuarit i ndërprehet marrëdhënia e punës nga punëdhënësi, nëse:</p>
            {["ndërprerja e tillë arsyetohet për arsye ekonomike, teknike ose organizative;", "I punësuari nuk është më e aftë të kryejë detyrat e punës;", "në rastet e rënda të sjelljes së keqe të të punësuarit;", "për shkak të mospërmbushjes së pakënaqshme të detyrave të punës, dhe", "për rastet e tjera të cilat janë përcaktuar me Ligjin e Punës."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>{i + 1}) {t}</p>
            ))}

            {/* Neni 14 (kapitulli 13) */}
            <div style={ART}>13. Neni 14</div>
            <p style={P}>13.1. Punëdhënësi obligohet të sigurojë dhe të zbatojë mjetet dhe masat e mbrojtjes në punë, sipas legjislacionit në fuqi.</p>
            <p style={P}>13.2. I punësuari është e detyruar t'iu përmbahet masave të caktuara të mbrojtjes në punë.</p>

            {/* Neni 15 (kapitulli 14) */}
            <div style={ART}>14. Neni 15</div>
            <p style={P}>Punëdhënësi obligohet t'i paguajë kontributet për skemat pensionale të obligueshme dhe skemat e tjera të përcaktuara me Ligj.</p>

            {/* Neni 16 (kapitulli 15) */}
            <div style={ART}>15. Neni 16</div>
            <p style={P}>Për kontestet eventuale të moszbatimit të kësaj Kontrate, palët kontraktuese e pranojnë kompetencën e Gjykatës Komunale në Prishtinë.</p>

            {/* Neni 17 (kapitulli 16) */}
            <div style={ART}>16. Neni 17</div>
            <p style={P}>Kjo kontrate mund të shkëputet menjëhërë:</p>
            <p style={P}>16.1. Kur I punësuari nuk i përmbahet kushteve të kontratës.</p>
            <p style={P}>16.2. Kur I punësuari vepron me faj të rëndë ose thyen në mënyrë të përsëritur rregullat e përcaktuara sipas kontratës.</p>
            <p style={P}>16.3. Kur mbyllet aktiviteti i kompanisë ose një pjesë e aktivitetit të saj e cila ka lidhje me vendin e punës së të punësuarit.</p>
            <p style={P}>16.4. Kjo kontratë mund të zgjidhet me kërkesën e njërës palë, me kusht që kërkesa t'i paraqitet me shkrim palës tjetër të paktën 1 muaj përpara zgjidhjes se kontratës. Nëse e punësuara, ka konfirmuar vazhimin e kontratës për një vit (ose më shume) shkollor ai nuk ka të drejtë të shkëpus kontratën deri në përfundim të atij (atyre) viti/eve.</p>
            <p style={P}>16.5. Në përputhje me kapitullin XIV të Kodit të Punës, përveç "arsyeve" të justifikuara, punëdhënësi ka të drejtë të përfundojë menjëherë kontratën edhe për arsyet e "pajustifikuara".</p>

            {/* Neni 18 (kapitulli 17) */}
            <div style={ART}>17. Neni 18</div>
            <p style={P}>Sanksionet në rast të mospërmbushjes së detyrave dhe obligimeve nga I punësuari mund të aplikohen si më poshtë:</p>
            <p style={P}>17.1. Në rast të mospërmbushjes së detyrave, me dashje apo nga pakujdesia, punëdhënësi mund të marrë këto masa ndaj të punësuarit:</p>
            {["Vërejtje me gojë.", "Vërejtje me shkrim.", "Gjoba në përputhje me legjislacionin në fuqi.", "Pushim nga puna."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>{i + 1}. {t}</p>
            ))}

            {/* Neni 19 (kapitulli 18) */}
            <div style={ART}>18. Neni 19</div>
            <p style={P}>I punësuari duhet t'i paraqesë elementet e mëposhtme të nevojshme për krijimin e dosjes së saj dhe në mënyrë të veçantë t'i paraqesë diplomat që ka deklaruar.</p>
            {["Diplomën universitare (të noterizuar tek noteri).", "Kartela e bankës.", "Curiculum vitae.", "Kopjen e mjetit të identifikimit ose kopjen e pasaportës.", "Vërtetim që nuk është nën hetime.", "Certifikatën shëndetësore jo më të vjetër se 6 muaj.", "Trajnime të përfunduara."].map((t, i) => (
              <p key={i} style={{ ...P, paddingLeft: "20px" }}>● {t}</p>
            ))}

            {/* Neni 20 (kapitulli 19) */}
            <div style={ART}>19. Neni 20</div>
            <p style={P}>
              Pas njoftimit me përmbajtjen e Kontratës, kjo Kontratë nga palët kontraktuese u nënshkrua më datën:{" "}
              <EF value={d.dataKontrates} onChange={set("dataKontrates")} placeholder="DD.MM.YYYY" width="100px" /> në Prishtinë, në dy kopje autentike, nga të cilat, secilës pale i mbetet nga një kopje.
            </p>

            {/* Nënshkrimet */}
            <div style={{ marginTop: "50px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "none", width: "46%", verticalAlign: "bottom" }}>
                      <div style={{ fontSize: "10.5pt", marginBottom: "40px" }}>
                        <strong>E punësuara:</strong><br />
                        Emri dhe mbiemri: {d.emri}
                      </div>
                      <div style={{ borderBottom: "1px solid #000", marginBottom: "4px" }}></div>
                      <div style={{ fontSize: "9.5pt" }}>Nënshkrimi</div>
                    </td>
                    <td style={{ border: "none", width: "8%" }}></td>
                    <td style={{ border: "none", width: "46%", verticalAlign: "bottom" }}>
                      <div style={{ fontSize: "10.5pt", marginBottom: "40px" }}>
                        <strong>Drejtori i shkollës "Akademia Ora":</strong><br />
                        <strong>Valon Hoxha</strong>
                      </div>
                      <div style={{ borderBottom: "1px solid #000", marginBottom: "4px" }}></div>
                      <div style={{ fontSize: "9.5pt" }}>Nënshkrimi</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function KontratetMesimdhnesve() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [activeCard, setActiveCard] = useState<"plote" | "pjesshme" | null>(null);
  const limit = 20;

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, status: "ACTIVE" });
      const res = await fetch(`/api/staff?${params}`);
      const data: StaffMember[] = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch {
      setStaff([]);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    if (activeCard) {
      const t = setTimeout(fetchStaff, 300);
      return () => clearTimeout(t);
    }
  }, [fetchStaff, activeCard]);

  const filtered = staff.filter(s =>
    s.emri.toLowerCase().includes(search.toLowerCase()) ||
    (s.lenda || "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  if (!activeCard) {
    return (
      <>
        <Header title="Kontratat e Mësimdhënësve" backHref="/sekretaria" />
        <div className="p-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <button
              onClick={() => setActiveCard("plote")}
              className="card p-5 flex items-start gap-4 hover:ring-2 hover:ring-violet-300 dark:hover:ring-violet-700 transition-all group text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                <FilePen className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 dark:text-white text-sm">Kontratë me Orar të Plotë</p>
                <p className="text-xs text-slate-400 mt-0.5">Kontratë pune për kohë të caktuar — 40 orë/javë</p>
              </div>
            </button>

            <button
              onClick={() => setActiveCard("pjesshme")}
              className="card p-5 flex items-start gap-4 hover:ring-2 hover:ring-teal-300 dark:hover:ring-teal-700 transition-all group text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 dark:text-white text-sm">Kontratë me Orar të Pjesshëm</p>
                <p className="text-xs text-slate-400 mt-0.5">Pagesë me orë — ditë/orë të caktuara në javë</p>
              </div>
            </button>

            <div className="card p-5 flex items-start gap-4 opacity-40 cursor-not-allowed">
              <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm">Kontratë Provuese</p>
                <p className="text-xs text-slate-400 mt-0.5">Në zhvillim e sipër...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={activeCard === "pjesshme" ? "Kontratë me Orar të Pjesshëm" : "Kontratë me Orar të Plotë"}
        backHref="/sekretaria/kontratat-mesimdhnesve"
      />
      <div className="p-6 animate-fade-in">
        <div className="card p-4 mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Kërko staf..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9 w-full"
            />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Emri</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Lënda / Roli</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Tipi</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Bruto (€)</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Duke ngarkuar...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Nuk u gjet staf.</td></tr>
                ) : paginated.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{(page - 1) * limit + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{s.emri}</td>
                    <td className="px-4 py-3 text-slate-500">{s.lenda || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.tipi === "Menaxhment" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" :
                        s.tipi === "Primar" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                        s.tipi === "Sekundar" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" :
                        "bg-slate-100 text-slate-500"
                      }`}>{s.tipi || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.totalBruto ? `${s.totalBruto} €` : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-600 dark:text-violet-400 rounded-lg transition-colors"
                      >
                        <FilePen className="w-3.5 h-3.5" /> Kontrata
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">{filtered.length} anëtarë stafi</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500 px-2">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && activeCard === "plote" && (
        <ContractOrarPlote staff={selected} onClose={() => setSelected(null)} />
      )}
      {selected && activeCard === "pjesshme" && (
        <ContractOrarPjesshme staff={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
