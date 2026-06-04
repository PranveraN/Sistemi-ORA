"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { Search, FileSignature, X, Printer, ChevronLeft, ChevronRight, Plus, FileDown, FileText } from "lucide-react";
import React from "react";

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  parentName: string;
  parentPhone: string;
  personalNumber: string;
  birthDate: string;
  address: string | null;
  class: { name: string; level: string } | null;
  motherName: string | null;
  motherBirth: string | null;
  motherProf: string | null;
  motherPhone: string | null;
  motherEmail: string | null;
  fatherName: string | null;
  fatherBirth: string | null;
  fatherProf: string | null;
  fatherPhone: string | null;
  fatherEmail: string | null;
}

interface ContractData {
  student: Student;
  personalNumber: string;
  price: string;
  sib2Name: string; sib2Personal: string; sib2Birth: string; sib2Class: string; sib2Price: string;
  sib3Name: string; sib3Personal: string; sib3Birth: string; sib3Class: string; sib3Price: string;
  motherName: string; motherAddress: string; motherBirth: string; motherProf: string; motherPhone: string; motherEmail: string;
  fatherName: string; fatherAddress: string; fatherBirth: string; fatherProf: string; fatherPhone: string; fatherEmail: string;
  respName: string; respAddress: string; respBirth: string; respProf: string; respPhone: string; respEmail: string;
  paymentMethod: "1" | "2";
  schoolYear: string;
  city: string;
  contractDate: string;
}

interface Article {
  id: number;
  nr: string;
  title: string;
  body: string;
  special?: "payment";
  pageBreak?: boolean;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  } catch { return ""; }
}

function EF({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: "inherit", fontSize: "inherit", width: "100%",
        background: value ? "transparent" : "#fffbeb",
        border: "none", outline: "none", padding: "1px 2px",
        borderBottom: "1px dashed #bbb",
      }}
    />
  );
}

const CS: React.CSSProperties = { border: "1px solid #000", padding: "5px 8px", verticalAlign: "top", fontSize: "10.5pt" };
const HS: React.CSSProperties = { border: "1px solid #000", padding: "6px 8px", background: "#6e6e6e", color: "#fff", fontWeight: "bold", textAlign: "center", fontSize: "11pt" };
const LB: React.CSSProperties = { fontWeight: "bold", display: "block", marginBottom: "3px", fontSize: "10pt" };
const P: React.CSSProperties = { lineHeight: "1.65", textAlign: "justify", fontSize: "10.5pt", marginBottom: "5px" };

// Renders article body text for print: lines starting with "X.Y." are list items, others are paragraphs
function ArtBodyPrint({ body }: { body: string }) {
  const lines = body.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        const m = t.match(/^(\d+\.\d+\.)\s+(.+)$/);
        if (m) {
          return (
            <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "3px", fontSize: "10.5pt", lineHeight: "1.65", textAlign: "justify" }}>
              <span style={{ flexShrink: 0 }}>{m[1]}</span>
              <span>{m[2]}</span>
            </div>
          );
        }
        return <p key={i} style={P}>{t}</p>;
      })}
    </>
  );
}

const DEFAULT_ARTICLES: Article[] = [
  {
    id: 1, nr: "1", title: "Shkolla",
    body: `Vizioni: Shkolla do të jetë qendër edukative-arsimore, gjithëpërfshirëse, e sigurtë, që promovon vlera, nxitë bashkëpunimin përgjegjësinë dhe përgatitë nxënësit për tregun global.

Misioni: Përmes mësimdhënies bashkëkohore, gjithëpërfshirjes, bashkëpunimit, llogaridhënies ndërmjet akterëve të shkollës, do të zhvillohen kompetencat dhe do të promovohen vlerat e një shkolle cilësore me standarde bashkëkohore.

SHFMU "Akademia Ora" është shkollë fillore dhe e mesme e ulët me lokacion në Prishtinë, Rr. Lekë Matrënga, Përroi i njelmët, nr. 23. Është vazhdimësi e sistemit arsimor parashkollor dhe vazhdon më tej. Punën e saj e ka filluar në vitin 2017 me të gjitha klasat 1-9.

Shkolla "Akademia Ora" suksesin e saj e bazon në sistemin ku promovohet bilanci në mes të vlerave materiale dhe atyre shpirtërore, ku arrihet zhvillimi i individit, në dobi të shoqërisë dhe ambientit duke mos u larguar nga natyrshmëria e saj. Ajo synon që tek secili nxënës të kultivohen dhe zhvillohen dhuntitë dhe talenti i tij, vlerësimi dhe respektimi i individëve tjerë, ku secili me veçantitë e tij bëhet pjesë shumë e vlefshme e një mozaiku të shëndoshë në shoqëri.

Mësimi i lëndëve mësimore është i organizuar në bazë të Kurrikulës së Kosovës, për nga përmbajtja dhe për nga numri i orëve. Organizimi i mësimit është tërë ditor. Mësimi fillon në orën 8:30 dhe përfundon në orën 15:00. Ditën e premte mësimi përfundon më herët në orën 14:10. Ky orar është konstant në kënë kohë, përveç rasteve specifike i cili mund të ndryshohet nga menaxhmenti.

Shkolla ofron laramani të aktiviteteve brenda këtij orari mësimor, ku fëmijët kanë mundësi të gjejnë veten e tyre në ato fusha ku ata kanë ose i zbulojnë talentet e tyre. Shkolla ka për obligim të ofroj të gjitha kushtet e favorshme për mësim për nxënësit të cilët ndjekin mësimin në këtë shkollë.`,
  },
  {
    id: 2, nr: "2", title: "Nxënësi, të drejtat dhe detyrat",
    body: `2.1. Prindërit/personat përgjegjës dhe nxënësi/ja pranojnë qëllimet e arsimimit dhe edukimit nga institucioni dhe japin kontributin për realizimin e tyre drejt fëmijës së tij/tyre.
2.2. Nxënësi ka të drejtë të edukohet dhe të mësojë në shkollë në kushte normale, të sigurta dhe të përshtatshme shëndetësore, të cilat përcaktojnë kohën për pushim, për veprimtari të lira në përputhje me psikologjinë, aftësinë, interesat dhe moshën e tij, si dhe të ndjekë rrugët që zbulojnë dhe zhvillojnë prirjet e tij në fushën e shkencës, artit dhe sportit etj.
2.3. Nxënësit duhet të respektojë mësimdhënësit.
2.4. Nxënësi duhet të mbajë qëndrim të drejtë dhe të kulturuar në shkollë.
2.5. Nxënësi duhet të veshë uniformën e shkollës.
2.6. Nxënësi duhet të dijë përgjegjësitë dhe të respektojë detyrimet e përcaktuara në programi mësimor dhe rregullorja e shkollës.
2.7. Të zbatojë me përpikmëri orarin e mësimeve, të përgatitet sistematikisht në çdo lëndë, të respektojë rregulloren e shkollës si dhe të mbajë qëndrim korrekt ndaj mësuesve.
2.8. Nxënësit nuk i lejohet të ushtrojë asnjë dhunë psikike apo fizike. Nuk i lejohet të përdorë duhan, pije alkoolike, substanca narkotike etj.`,
  },
  {
    id: 3, nr: "3", title: "Të drejtat dhe detyrimet e prindërve",
    body: `3.1. Prindi/personi përgjegjës, ka të drejtë t'u kërkojë organeve arsimore dhe autoriteteve sigurimin e kushteve normale për edukim.
3.2. Të kontribojë në realizimin e të drejtave të shkollës, në integrimin optimal të fëmijëve në jetë dhe shoqëri, të zgjidhet në bordin e shkollës, të ankohet dhe të propozojë me shkrim pranë drejtorisë së shkollës.
3.3. Prindi/personi përgjegjës, ka detyrë të sigurojë frekuentimin në shkollë të fëmijëve sipas orarit që ka caktuar shkolla.
3.4. Të vendosë kontakte të rregullta me mësuesit.
3.5. Prindi/personi përgjegjës, ka për detyrë të shlyejë detyrimet ndaj shkollës brenda afateve të përcaktuara në kontratë dhe rregulloren e shkollës.
3.6. Prindi/personi përgjegjës është i obliguar të marrë pjesë në mbedhjet me prindër të organizuara nga shkolla/kujdestari i klasës.
3.7. Prindi është i obliguar të jetë prezent në shkollë së paku dy herë brenda vitit. Nëse prindi nuk interesohet dhe nuk merr pjesë ansnjëherë në takimet me shkollën atëherë nuk mund të kërkoi përgjegjësi nga shkolla.
3.8. Prindi duhet të kërkoj leje me shkrim nga shkolla për mungesën e fëmijës. Mungesa e fëmijës në shkollë nuk duhet të jetë më e gjatë se 2 javë përveç rasteve të jashtëzakonshme (si sëmundja, thyerja e ndonjë gjymtyre, operimi etj).
3.9. Me nënshkrimin e kontratës, prindi jep pëlqimin që nxënësi të monitorohet me kamera sigurie gjatë qëndrimit në ambientet e shkollës për qëllime sigurie. Shkolla garanton mbrojtjen e privatësisë dhe përpunimin e të dhënave në përputhje me ligjin në fuqi.
3.10. Prindi/kujdestari ligjor jep pëlqimin që fëmija të fotografohet dhe/ose incizohet gjatë aktiviteteve mësimore dhe aktiviteteve të organizuara nga shkolla, dhe që këto materiale të përdoren për qëllime informuese, promovuese dhe dokumentuese (përfshirë publikime në faqen zyrtare dhe rrjetet sociale të shkollës), duke respektuar dinjitetin dhe mirëqenien e fëmijës.
3.11. Të premteve, procesi i rregullt mësimor përfundon në orën 12:00; pas kësaj organizohen aktivitete në formë klubesh, të cilat nuk janë të detyrueshme. Nxënësit që nuk marrin pjesë në këto aktivitete duhet të merren nga prindërit/kujdestarët ligjorë menjëherë pas përfundimit të mësimit.
3.12. Në rast se nxënësi, gjatë vitit shkollor, për shkak të sjelljes së papërshtatshme, arrin nivelin disiplinor që sipas rregullores së brendshme rezulton me pezullim nga mësimi për tre (3) ditë, shkolla rezervon të drejtën të mos vazhdojë kontratën për vitin pasues. Në këtë rast, kontrata përfundon në fund të vitit aktual shkollor, pa obligim për rinovim, ndërsa pagesat e kryera për periudha të parapaguara nuk janë të kthyeshme.`,
  },
  {
    id: 4, nr: "4", title: "Tarifat dhe pagesat",
    body: `4.1. Për financimin e shkollimit, dhe shërbimeve të tjera brenda shkollës, shkolla vendos një tarifë të caktuar për vitin shkollor e cila mund të ndryshoj sipas rrethanave që gjendet institucioni.
4.2. Tarifa bazë e shërbimit të shkollimit për këtë vit është 2000 Euro për klasat I - IX. Kjo vlerë mund të ndryshojë nëse fëmija përfiton bursë ose i përket ndonjë kategorie të veçantë sipas nenit 7 të kësaj kontrate.
4.3. Rastet kur fëmijët përfitojnë zbritje nga çmimet promovuese, viti pasues kthehet çdo herë në çmimin bazë.
4.4. Të gjitha pagesat duhet të shoqërohen me faturë pagese.
4.5. Viti shkollor përfshin 10 (dhjetë) muaj.
4.6. Nëse prindi nuk bënë ansnjë pagesë të shkollimit ose pagesat tjera që lidhen me shkollën deri në dhjetor të atij viti shkollor fëmija nuk mund të vazhdoj shkollimin në periudhën e dytë.
4.7. Prindi duhet të respektojë afatet e pagesave të caktuara nga shkolla dhe nuk mund të vendosë vet se kur dëshiron të përmbushë pagesat.
4.8. Nëse nxënësi regjistrohet në gjysmëvjetorin e dytë (periudhën e dytë) çmimi i shkollimit ndryshon.`,
  },
  {
    id: 5, nr: "5", title: "Tërheqja dhe anulimi i kontratës",
    body: `Palët kontraktuese mund ta zgjidhin kontratën në:
5.1. Në përfundim të periudhës (gjysmëvjetorit të parë) me kushtin që është paguar gjysma e çmimit të shkollimit) dhe
5.2. Në fund të viti shkollor – njoftohet shkolla më së voni një muaj para përfundimit të vitit shkollor.
Kjo bëhet duke paraqitur me shkrim kërkesën për tërheqje ose duke telefonuar në sekretari për të paraqitur kërkesën.
Marrëdhëniet kontraktuale mund të anulohen nga palët edhe gjatë vitit shkollor, nëse bashkëpunimi rezulton i pamundur pasi:
5.3. Nxënësi/ja apo prindërit/personat përgjegjës shkelin vazhdimisht apo kanë shkelur rëndë rregulloren e shkollës;
5.4. Nxënësi/ja apo prindërit/personat përgjegjës shpërfillin qëllimet e shkollës,
5.5. Prindërit/personat përgjegjës kanë vonuar pagesën e kësteve të tarifës së shkollës për së paku 2 muaj;
5.6. Nxënësi/ja apo prindërit/personat përgjegjës kërkojnë të transferojnë fëmijën në ndonjë shkollë tjetër, për arsye të ndryshme.
Prindi nuk mund të tërhjek dokumentacionin e fëmijës, nëse nuk ka përmbushur pagesat në lidhje me shkollën.`,
  },
  {
    id: 6, nr: "6", title: "Mënyrat e pagesës",
    body: "", special: "payment",
  },
  {
    id: 7, nr: "7", title: "Pagesa e shkollimit mund të ndryshojë nëse:",
    body: `7.1. Nxënësi ka përfituar bursë (prej 10% -50%);
7.2. Prej një familje ka më shumë se një fëmijë, atëherë fëmija i dytë përfiton 10% zbritje, fëmija i tretë 15%, fëmija i katër 20% dhe çdo fëmijë tjetër 20%;
7.3. Nëse nxënësi është me kushte të vështira ekonomike dhe shkollimin e tij e mbulon ndonjë donator (prind, biznes).
7.4. Regjistrimet e hershme dhe ofertat promovuese të publikuara në web faqe dhe në rrjetet sociale të shkollës, për nxënësit e rinj.
7.5. Prindi është pjesë e stafit të shkollës (mësimdhënës, menaxhment, staf administrativ)
7.6. Prindi ka të drejtën e shfrytëzimit të njërës nga ofertat, shembull ofertën e hershme të regjsitrimit ose bursën. Nëse prindi nuk e bënë zgjedhjen atëherë, shkolla përzgjedhë njërën ofertë që ka zbritjen më të lartë.
7.7. Shkolla i jep zbritje për ndonjë arsye apo rrethanë tjetër të pa specifikuar në këtë kontratë me që rast duhet të ruhet konfidencialiteti.
7.8. Nëse nxënësi nuk e vijon mësimin gjatë tërë vitit shkollor (regjistrohet gjatë vitit shkollor).`,
    pageBreak: true,
  },
  {
    id: 8, nr: "8", title: "",
    body: "Pas leximit dhe njoftimit me përmbajtjen e kontratës, kjo kontratë u nënshkrua nga palët me datën e poshtë shënuar. Kontrata është shtypur, në dy kopje autentike, nga të cilat, secilës palë i mbetet nga një kopje.",
  },
];

function ContractModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [d, setD] = useState<ContractData>({
    student,
    personalNumber: student.personalNumber || "",
    price: "",
    sib2Name: "", sib2Personal: "", sib2Birth: "", sib2Class: "", sib2Price: "",
    sib3Name: "", sib3Personal: "", sib3Birth: "", sib3Class: "", sib3Price: "",
    motherName: student.motherName || "",
    motherAddress: student.address || "",
    motherBirth: student.motherBirth ? fmtDate(student.motherBirth) : "",
    motherProf: student.motherProf || "",
    motherPhone: student.motherPhone || "",
    motherEmail: student.motherEmail || "",
    fatherName: student.fatherName || student.parentName || "",
    fatherAddress: student.address || "",
    fatherBirth: student.fatherBirth ? fmtDate(student.fatherBirth) : "",
    fatherProf: student.fatherProf || "",
    fatherPhone: student.fatherPhone || student.parentPhone || "",
    fatherEmail: student.fatherEmail || "",
    respName: "", respAddress: "", respBirth: "", respProf: "", respPhone: "", respEmail: "",
    paymentMethod: "1",
    schoolYear: "2026-2027",
    city: "Prishtinë",
    contractDate: todayStr,
  });

  const [articles, setArticles] = useState<Article[]>(DEFAULT_ARTICLES);
  const [siblings, setSiblings] = useState<Student[]>([]);
  const [siblingsAdded, setSiblingsAdded] = useState(false);

  useEffect(() => {
    const phone = student.parentPhone || student.fatherPhone || student.motherPhone;
    if (!phone) return;
    fetch(`/api/students?siblingPhone=${encodeURIComponent(phone)}&excludeId=${student.id}&status=ACTIVE&limit=5`)
      .then(r => r.json())
      .then(data => { if (data.students?.length > 0) setSiblings(data.students); })
      .catch(() => {});
  }, [student]);

  const addSiblings = () => {
    const [s2, s3] = siblings;
    setD(prev => ({
      ...prev,
      ...(s2 ? {
        sib2Name: `${s2.firstName} ${s2.lastName}`,
        sib2Personal: s2.personalNumber || "",
        sib2Birth: s2.birthDate ? fmtDate(s2.birthDate) : "",
        sib2Class: s2.class ? `${s2.class.level} — ${s2.class.name}` : "",
      } : {}),
      ...(s3 ? {
        sib3Name: `${s3.firstName} ${s3.lastName}`,
        sib3Personal: s3.personalNumber || "",
        sib3Birth: s3.birthDate ? fmtDate(s3.birthDate) : "",
        sib3Class: s3.class ? `${s3.class.level} — ${s3.class.name}` : "",
      } : {}),
    }));
    setSiblingsAdded(true);
    setSiblings([]);
  };

  const updateArticle = (id: number, updates: Partial<Article>) =>
    setArticles(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));

  const deleteArticle = (id: number) =>
    setArticles(prev => prev.filter(a => a.id !== id));

  const addArticle = () =>
    setArticles(prev => [...prev, { id: Date.now(), nr: String(prev.length + 1), title: "", body: "" }]);

  const set = (k: keyof ContractData) => (v: string) => setD((prev) => ({ ...prev, [k]: v }));
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then((cats: { name: string; defaultAmount: number }[]) => {
        const shkollimi = cats.find(c => c.name === "Shkollimi");
        if (shkollimi?.defaultAmount) {
          setD(prev => ({ ...prev, price: String(shkollimi.defaultAmount) }));
        }
      })
      .catch(() => {});
  }, []);

  const handleExportPDF = async () => {
    const element = document.getElementById("contract-content");
    if (!element) return;
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#fff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pageW - margin * 2;
    const ratio = usableW / canvas.width;
    const totalH = canvas.height * ratio;
    let yOffset = 0;
    let first = true;
    while (yOffset < totalH) {
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(imgData, "PNG", margin, margin - (yOffset), usableW, totalH);
      yOffset += pageH - margin * 2;
    }
    pdf.save(`Kontrata-${student.firstName}-${student.lastName}.pdf`);
  };

  const handleExportWord = () => {
    const content = document.getElementById("contract-content")?.innerHTML;
    if (!content) return;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;font-size:10.5pt;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #000;padding:5px 8px;font-size:10.5pt;}input{border:none;border-bottom:1px solid #000;background:transparent;font-family:inherit;font-size:inherit;}.no-print{display:none!important;}</style></head><body>${content}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kontrata-${student.firstName}-${student.lastName}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const content = document.getElementById("contract-content")?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=960,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Kontratë — ${student.firstName} ${student.lastName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; background: #fff; }
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  td, th { border: 1px solid #000; padding: 5px 8px; font-size: 10.5pt; vertical-align: top; }
  input { border: none !important; border-bottom: none !important; background: transparent !important; font-family: inherit; font-size: inherit; width: 100%; padding: 1px 2px; outline: none; }
  textarea { display: none !important; }
  select { display: none; }
  .no-print { display: none !important; }
  .art-print { display: block !important; }
  .art-nr-print { display: block !important; }
  .page-break { page-break-before: always; padding-top: 16px; }
</style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const sb = fmtDate(student.birthDate);
  const cdf = fmtDate(d.contractDate);

  const artTitleStyle: React.CSSProperties = {
    fontWeight: "bold", fontSize: "10.5pt", border: "none",
    borderBottom: "1px dashed #bbb", background: "transparent",
    outline: "none", fontFamily: "inherit",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6"
      onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl mx-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl z-10">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <FileSignature className="w-4 h-4 text-blue-500" />
            Kontratë — {student.firstName} {student.lastName}
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 flex items-center gap-1">
              Viti:
              <input type="text" value={d.schoolYear} onChange={(e) => setD(p => ({ ...p, schoolYear: e.target.value }))}
                className="border border-slate-200 rounded px-1 py-0.5 text-xs w-20" placeholder="2026-2027" />
            </label>
            <label className="text-xs text-slate-500 flex items-center gap-1">
              Datë:
              <input type="date" value={d.contractDate} onChange={(e) => setD(p => ({ ...p, contractDate: e.target.value }))}
                className="border border-slate-200 rounded px-1 py-0.5 text-xs" />
            </label>
            <button onClick={handleExportWord}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg">
              <FileText className="w-3.5 h-3.5" /> Word
            </button>
            <button onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg">
              <FileDown className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Sibling suggestion banner */}
        {siblings.length > 0 && (
          <div className="mx-6 mt-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl flex items-center justify-between gap-4">
            <div className="text-sm">
              <span className="font-semibold text-blue-700 dark:text-blue-300">U gjetën vëllezër/motra: </span>
              <span className="text-blue-600 dark:text-blue-400">
                {siblings.map(s => `${s.firstName} ${s.lastName}${s.class ? ` (${s.class.name})` : ""}`).join(", ")}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={addSiblings}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
                Shto në kontratë
              </button>
              <button onClick={() => setSiblings([])}
                className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-blue-200 dark:border-slate-600 text-blue-600 dark:text-slate-300 rounded-lg text-xs hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors">
                Injoró
              </button>
            </div>
          </div>
        )}
        {siblingsAdded && (
          <div className="mx-6 mt-4 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl text-sm text-green-700 dark:text-green-400">
            ✓ Vëllezërit/motrat u shtuan automatikisht në kontratë
          </div>
        )}

        {/* Contract body */}
        <div className="p-8" id="contract-content">
          <div style={{ fontFamily: "'Times New Roman', serif", color: "#000", maxWidth: "850px", margin: "0 auto" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <img src="/stema.svg" alt="Stema e Kosovës" style={{ width: "70px", height: "auto", flexShrink: 0 }}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <div style={{ textAlign: "center", flex: 1, padding: "0 12px" }}>
                <div style={{ fontSize: "14pt", fontWeight: "bold" }}>Kontratë njëvjeçare</div>
                <div style={{ fontSize: "13pt", fontWeight: "bold" }}>Shkollë - Prind</div>
                <div style={{ fontSize: "13pt", fontWeight: "bold" }}>Viti shkollor {d.schoolYear}</div>
              </div>
              <img src="/logo.png" alt="SHFMU Akademia Ora" style={{ width: "100px", height: "auto", flexShrink: 0 }}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>

            {/* Student table */}
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "8px" }}>
              <thead>
                <tr><th colSpan={3} style={HS}>Të dhënat e nxënësit/ve</th></tr>
              </thead>
              <tbody>
                <tr>
                  {[
                    <><span style={LB}>Emri dhe mbiemri i nxënësit:</span>{student.firstName} {student.lastName}</>,
                    <><span style={LB}>Emri dhe mbiemri i nxënësit:</span><EF value={d.sib2Name} onChange={set("sib2Name")} /></>,
                    <><span style={LB}>Emri dhe mbiemri i nxënësit:</span><EF value={d.sib3Name} onChange={set("sib3Name")} /></>,
                  ].map((cell, i) => <td key={i} style={{ ...CS, width: "33.33%" }}>{cell}</td>)}
                </tr>
                <tr>
                  {[
                    <><span style={LB}>Nr. personal:</span><EF value={d.personalNumber} onChange={set("personalNumber")} /></>,
                    <><span style={LB}>Nr. personal:</span><EF value={d.sib2Personal} onChange={set("sib2Personal")} /></>,
                    <><span style={LB}>Nr. personal:</span><EF value={d.sib3Personal} onChange={set("sib3Personal")} /></>,
                  ].map((cell, i) => <td key={i} style={CS}>{cell}</td>)}
                </tr>
                <tr>
                  {[
                    <><span style={LB}>Data e lindjes:</span>{sb}</>,
                    <><span style={LB}>Data e lindjes:</span><EF value={d.sib2Birth} onChange={set("sib2Birth")} placeholder="DD.MM.YYYY" /></>,
                    <><span style={LB}>Data e lindjes:</span><EF value={d.sib3Birth} onChange={set("sib3Birth")} placeholder="DD.MM.YYYY" /></>,
                  ].map((cell, i) => <td key={i} style={CS}>{cell}</td>)}
                </tr>
                <tr>
                  {[
                    <><span style={LB}>Klasa:</span>{student.class ? `${student.class.level} — ${student.class.name}` : ""}</>,
                    <><span style={LB}>Klasa:</span><EF value={d.sib2Class} onChange={set("sib2Class")} /></>,
                    <><span style={LB}>Klasa:</span><EF value={d.sib3Class} onChange={set("sib3Class")} /></>,
                  ].map((cell, i) => <td key={i} style={CS}>{cell}</td>)}
                </tr>
                <tr>
                  {[
                    <><span style={{ ...LB, fontWeight: "bold" }}>Çmimi:</span><EF value={d.price} onChange={set("price")} placeholder="€" /></>,
                    <><span style={{ ...LB, fontWeight: "bold" }}>Çmimi:</span><EF value={d.sib2Price} onChange={set("sib2Price")} placeholder="€" /></>,
                    <><span style={{ ...LB, fontWeight: "bold" }}>Çmimi:</span><EF value={d.sib3Price} onChange={set("sib3Price")} placeholder="€" /></>,
                  ].map((cell, i) => <td key={i} style={CS}>{cell}</td>)}
                </tr>
              </tbody>
            </table>

            {/* Parents table */}
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "8px" }}>
              <thead>
                <tr><th colSpan={2} style={HS}>Të dhënat e prindërve</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...CS, width: "50%" }}><span style={LB}>Emri dhe mbiemri i nënës:</span><EF value={d.motherName} onChange={set("motherName")} /></td>
                  <td style={{ ...CS, width: "50%" }}><span style={LB}>Adresa:</span><EF value={d.motherAddress} onChange={set("motherAddress")} /></td>
                </tr>
                <tr>
                  <td style={CS}><span style={LB}>Data e lindjes:</span><EF value={d.motherBirth} onChange={set("motherBirth")} placeholder="DD.MM.YYYY" /></td>
                  <td style={CS}><span style={LB}>Profesioni:</span><EF value={d.motherProf} onChange={set("motherProf")} /></td>
                </tr>
                <tr>
                  <td style={CS}><span style={LB}>Telefoni:</span><EF value={d.motherPhone} onChange={set("motherPhone")} /></td>
                  <td style={CS}><span style={LB}>e-mail:</span><EF value={d.motherEmail} onChange={set("motherEmail")} /></td>
                </tr>
                <tr><td colSpan={2} style={{ ...CS, background: "#b0b0b0", height: "12px", padding: "2px 8px" }}>&nbsp;</td></tr>
                <tr>
                  <td style={CS}><span style={LB}>Emri dhe mbiemri i babës:</span><EF value={d.fatherName} onChange={set("fatherName")} /></td>
                  <td style={CS}><span style={LB}>Adresa:</span><EF value={d.fatherAddress} onChange={set("fatherAddress")} /></td>
                </tr>
                <tr>
                  <td style={CS}><span style={LB}>Data e lindjes:</span><EF value={d.fatherBirth} onChange={set("fatherBirth")} placeholder="DD.MM.YYYY" /></td>
                  <td style={CS}><span style={LB}>Profesioni:</span><EF value={d.fatherProf} onChange={set("fatherProf")} /></td>
                </tr>
                <tr>
                  <td style={CS}><span style={LB}>Telefoni:</span><EF value={d.fatherPhone} onChange={set("fatherPhone")} /></td>
                  <td style={CS}><span style={LB}>e-mail:</span><EF value={d.fatherEmail} onChange={set("fatherEmail")} /></td>
                </tr>
              </tbody>
            </table>

            {/* Responsible person table */}
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "8px" }}>
              <thead>
                <tr><th colSpan={2} style={HS}>Të dhënat e personit tjetër përgjegjës</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...CS, width: "50%" }}><span style={LB}>Personi përgjegjës:</span><EF value={d.respName} onChange={set("respName")} /></td>
                  <td style={{ ...CS, width: "50%" }}><span style={LB}>Adresa:</span><EF value={d.respAddress} onChange={set("respAddress")} /></td>
                </tr>
                <tr>
                  <td style={CS}><span style={LB}>Data e lindjes:</span><EF value={d.respBirth} onChange={set("respBirth")} placeholder="DD.MM.YYYY" /></td>
                  <td style={CS}><span style={LB}>Profesioni:</span><EF value={d.respProf} onChange={set("respProf")} /></td>
                </tr>
                <tr>
                  <td style={CS}><span style={LB}>Telefoni:</span><EF value={d.respPhone} onChange={set("respPhone")} /></td>
                  <td style={CS}><span style={LB}>e-mail:</span><EF value={d.respEmail} onChange={set("respEmail")} /></td>
                </tr>
              </tbody>
            </table>

            {/* ─── Articles ─── */}
            <div className="page-break" style={{ marginTop: "20px", paddingTop: "10px" }}>

              {articles.map((art) => (
                <div
                  key={art.id}
                  className={art.pageBreak ? "page-break" : ""}
                  style={{ marginBottom: "13px", position: "relative" }}
                >
                  {/* Delete button — screen only */}
                  <button
                    className="no-print"
                    onClick={() => deleteArticle(art.id)}
                    title="Fshi nenin"
                    style={{
                      position: "absolute", top: 0, right: 0,
                      background: "none", border: "none", cursor: "pointer",
                      color: "#ef4444", fontSize: "11px", padding: "2px 6px",
                      borderRadius: "4px", lineHeight: 1,
                    }}
                  >
                    ✕ fshi
                  </button>

                  {/* Title — editable (screen) */}
                  <div className="no-print" style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "3px", paddingRight: "50px" }}>
                    <span style={{ fontWeight: "bold", fontSize: "10.5pt", whiteSpace: "nowrap" }}>Neni</span>
                    <input
                      value={art.nr}
                      onChange={e => updateArticle(art.id, { nr: e.target.value })}
                      style={{ ...artTitleStyle, width: "34px", textAlign: "center" }}
                    />
                    <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>—</span>
                    <input
                      value={art.title}
                      onChange={e => updateArticle(art.id, { title: e.target.value })}
                      placeholder="Titulli..."
                      style={{ ...artTitleStyle, flex: 1, background: art.title ? "transparent" : "#fffbeb" }}
                    />
                  </div>

                  {/* Title — print only */}
                  <div className="art-nr-print" style={{ display: "none", fontWeight: "bold", marginBottom: "3px", fontSize: "10.5pt" }}>
                    Neni {art.nr}{art.title ? ` — ${art.title}` : ""}
                  </div>

                  {/* Body */}
                  {art.special === "payment" ? (
                    /* Neni 6 — payment method checkboxes */
                    <>
                      <p style={P}>Mundësitë e pagesës së shkollimit (përcaktohuni në njërën nga opsionet në katrorin në fillim)</p>
                      <div style={{ marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                          <span onClick={() => setD(p => ({ ...p, paymentMethod: "1" }))}
                            style={{ border: "1px solid #000", minWidth: "14px", height: "14px", display: "inline-block", textAlign: "center", lineHeight: "13px", marginTop: "2px", cursor: "pointer", flexShrink: 0 }}>
                            {d.paymentMethod === "1" ? "✓" : ""}
                          </span>
                          <div>
                            <p style={{ ...P, marginBottom: "2px" }}><strong>6.1. Mundësia e parë:</strong></p>
                            <p style={P}>Shuma e përgjithshme e pagesës së shkollimit paguhet komplet, ose ndahet në dy pjesë: Nëse paguhet në dy pjesë, atëherë gjysma paguhet në fillim të vitit shkollor (shtator) më së largu deri me datën 30 shtator, dhe gjysma tjetër më së largu deri me 15 dhjetor të atij viti shkollor. Pagesa bëhet në xhirollogarinë <strong>1971897927031291 BKT</strong>.</p>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <span onClick={() => setD(p => ({ ...p, paymentMethod: "2" }))}
                            style={{ border: "1px solid #000", minWidth: "14px", height: "14px", display: "inline-block", textAlign: "center", lineHeight: "13px", marginTop: "2px", cursor: "pointer", flexShrink: 0 }}>
                            {d.paymentMethod === "2" ? "✓" : ""}
                          </span>
                          <div>
                            <p style={{ ...P, marginBottom: "2px" }}><strong>6.2. Mundësia e dytë:</strong></p>
                            <p style={P}>Pagesa mund të bëhet përmes "Timi Invest" i cili e krediton prindin me mundësi pagese nga 3-12 këste mujore në vlerën e përgjithshme të shkollimit pa shpenzime administrative dhe pa kosto shtesë.</p>
                          </div>
                        </div>
                      </div>
                      <div className="no-print" style={{ fontSize: "9pt", color: "#888", marginTop: "4px" }}>
                        (kliko kutinë për të zgjedhur mundësinë)
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Textarea — screen only */}
                      <textarea
                        className="no-print"
                        value={art.body}
                        onChange={e => updateArticle(art.id, { body: e.target.value })}
                        placeholder="Shto tekstin e nenit këtu..."
                        style={{
                          width: "100%", fontSize: "10.5pt", lineHeight: "1.65",
                          border: "1px dashed #cbd5e1", borderRadius: "4px",
                          padding: "6px 8px",
                          background: art.body ? "#fafafa" : "#fffbeb",
                          outline: "none", resize: "vertical", minHeight: "52px",
                          fontFamily: "'Times New Roman', serif", color: "#000",
                        }}
                      />
                      {/* Formatted body — print only */}
                      <div className="art-print" style={{ display: "none" }}>
                        <ArtBodyPrint body={art.body} />
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add article button — screen only */}
              <div className="no-print" style={{ marginBottom: "16px" }}>
                <button
                  onClick={addArticle}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "5px 12px", border: "1px dashed #94a3b8",
                    borderRadius: "6px", background: "none", cursor: "pointer",
                    fontSize: "10.5pt", color: "#64748b", fontFamily: "inherit",
                  }}
                >
                  <Plus size={13} /> Shto nen të ri
                </button>
              </div>

              {/* Signatures */}
              <div style={{ marginTop: "40px" }}>
                <p style={{ ...P, marginBottom: "24px" }}>
                  Prishtinë më: <strong>{cdf}</strong>
                </p>
                <table style={{ borderCollapse: "collapse", width: "100%", border: "none" }}>
                  <tbody>
                    <tr>
                      <td style={{ border: "none", width: "48%", verticalAlign: "bottom", paddingRight: "10px" }}>
                        <div style={{ fontSize: "10.5pt", marginBottom: "40px" }}>Prindi/personi përgjegjës:</div>
                        <div style={{ borderBottom: "1px solid #000", marginBottom: "4px" }}></div>
                      </td>
                      <td style={{ border: "none", width: "4%", textAlign: "center", verticalAlign: "bottom", paddingBottom: "4px", fontSize: "10pt" }}>v.v</td>
                      <td style={{ border: "none", width: "48%", verticalAlign: "bottom", paddingLeft: "10px" }}>
                        <div style={{ fontSize: "10.5pt", marginBottom: "40px" }}>Drejtori i shkollës:</div>
                        <div style={{ borderBottom: "1px solid #000", marginBottom: "4px" }}></div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Student list page ───

export default function KontratetNxenesve() {
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get("studentId");

  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Student | null>(null);
  const limit = 20;

  useEffect(() => {
    if (!studentIdParam) return;
    fetch(`/api/students/${studentIdParam}`)
      .then(r => r.json())
      .then((s: Student) => { if (s?.id) setSelected(s); })
      .catch(() => {});
  }, [studentIdParam]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, page: String(page), limit: String(limit), status: "ACTIVE" });
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    const sorted = (data.students || []).sort((a: Student, b: Student) =>
      a.firstName.localeCompare(b.firstName, "sq", { sensitivity: "base" }) ||
      a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" })
    );
    setStudents(sorted);
    setTotal(data.total || 0);
    setLoading(false);
  }, [search, page]);

  const _firstRender = useRef(true);
  useEffect(() => {
    const delay = _firstRender.current ? 0 : 300;
    _firstRender.current = false;
    const t = setTimeout(fetchStudents, delay);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <Header title="Kontratat e Nxënësve" backHref="/sekretaria" />
      <div className="p-6 animate-fade-in">
        <div className="card p-4 mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Kërko nxënës..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9 w-full" />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Nxënësi/ja</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Klasa</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Prindi</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Telefoni</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Duke ngarkuar...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Nuk u gjetën nxënës.</td></tr>
                ) : students.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{(page - 1) * limit + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                      {s.firstName} {s.lastName}
                      <div className="text-xs text-slate-400">{s.personalNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {s.class ? `${s.class.level} — ${s.class.name}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.parentName || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.parentPhone || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors">
                        <FileSignature className="w-3.5 h-3.5" /> Kontrata
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">{total} nxënës gjithsej</span>
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

      {selected && <ContractModal student={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
