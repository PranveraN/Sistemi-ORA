"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import {
  ArrowLeft, GraduationCap, Users, User,
  Printer, RotateCcw, X, ChevronRight,
} from "lucide-react";

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string;
  parentName: string;
  class: { name: string; level: string } | null;
}

interface StaffMember {
  id: number;
  emri: string;
  lenda: string | null;
  tipi: string | null;
}

type Person = Student | StaffMember;
type CertTypeId = "nxenes" | "mesimdhenes" | "asistente";

interface CertType {
  id: CertTypeId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  ring: string;
  personSource: "student" | "staff";
  staffFilter?: (s: StaffMember) => boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function isStaff(p: Person): p is StaffMember { return "emri" in p; }

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [8, "VIII"], [7, "VII"],
    [6, "VI"], [5, "V"], [4, "IV"], [3, "III"], [2, "II"], [1, "I"],
  ];
  let r = "";
  for (const [v, s] of map) { while (n >= v) { r += s; n -= v; } }
  return r;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function todayFmt(): string { return fmtDate(new Date().toISOString()); }

function personLabel(p: Person): string {
  if (isStaff(p)) return `${p.emri}${p.lenda ? ` – ${p.lenda}` : ""}`;
  const s = p as Student;
  return `${s.firstName} ${s.lastName}${s.class ? ` (${s.class.level})` : ""}`;
}

function makeTemplate(typeId: CertTypeId, p: Person): string {
  if (typeId === "nxenes") {
    const s = p as Student;
    const name = `${s.firstName} ${s.lastName}`;
    const birth = s.birthDate ? fmtDate(s.birthDate) : "___";
    const parent = s.parentName || "___";
    const lvlNum = parseInt((s.class?.level || "").replace("Klasa ", "")) || 0;
    const cls = lvlNum ? toRoman(lvlNum) : (s.class?.name || "___");
    return (
      `Me anë të këtij dokumenti vërtetohet se nxënësi/ja ${name}, i/e lindur më ${birth}` +
      ` (I/e biri/bija i/e ${parent}), është nxënës/e i/e rregullt në shkollën` +
      ` "Akademia Ora", në klasën e ${cls} të vitit shkollor 2025/2026.\n\n` +
      `Ky vërtetim lëshohet me kërkesë të prindit/kujdestarit për t'u përdorur si dëshmi` +
      ` për nevoja administrative dhe rregullimin e dokumenteve pranë Institucioneve` +
      ` përkatëse për shtesat e fëmijëve dhe nuk mund të përdoret për qëllime tjera jashtë atyre të deklaruara.`
    );
  }
  if (typeId === "mesimdhenes") {
    const s = p as StaffMember;
    const sub = s.lenda ? `, në lëndën ${s.lenda},` : "";
    return (
      `Me anë të këtij dokumenti vërtetohet se ${s.emri}, punësohet si mësimdhënës/e` +
      ` në shkollën "Akademia Ora"${sub} duke ushtruar detyrën gjatë vitit shkollor 2025/2026.\n\n` +
      `Ky vërtetim lëshohet me kërkesë të personit të interesuar për t'u përdorur si dëshmi` +
      ` për nevoja administrative dhe nuk mund të përdoret për qëllime tjera jashtë atyre të deklaruara.`
    );
  }
  // asistente
  const s = p as StaffMember;
  return (
    `Me anë të këtij dokumenti vërtetohet se ${s.emri}, punësohet si asistente` +
    ` në shkollën "Akademia Ora", duke ushtruar detyrën gjatë vitit shkollor 2025/2026.\n\n` +
    `Ky vërtetim lëshohet me kërkesë të personit të interesuar për t'u përdorur si dëshmi` +
    ` për nevoja administrative dhe nuk mund të përdoret për qëllime tjera jashtë atyre të deklaruara.`
  );
}

// ── certificate types ────────────────────────────────────────────────────────

const CERT_TYPES: CertType[] = [
  {
    id: "nxenes",
    label: "Vërtetim Nxënësi",
    desc: "Vërteton statusin e nxënësit të rregullt në shkollë",
    icon: GraduationCap,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    ring: "hover:ring-blue-300 dark:hover:ring-blue-700",
    personSource: "student",
  },
  {
    id: "mesimdhenes",
    label: "Vërtetim Mësimdhënësi",
    desc: "Vërteton punësimin e mësimdhënësit",
    icon: Users,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30",
    ring: "hover:ring-violet-300 dark:hover:ring-violet-700",
    personSource: "staff",
    staffFilter: (s) =>
      s.tipi !== "Menaxhment" &&
      !["Asistente", "Mirembajtëse", "Kuzhinjiere", "Sekretare"].includes(s.lenda ?? ""),
  },
  {
    id: "asistente",
    label: "Vërtetim Asistenteje",
    desc: "Vërteton punësimin e asistentes",
    icon: User,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/30",
    ring: "hover:ring-teal-300 dark:hover:ring-teal-700",
    personSource: "staff",
    staffFilter: (s) => s.lenda === "Asistente",
  },
];

// ── print ────────────────────────────────────────────────────────────────────

function buildPrintHtml(nr: string, certDate: string, body: string): string {
  const origin = window.location.origin;
  const paras = body.split("\n\n").filter(Boolean);
  return `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<title>Vërtetim</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;background:white;}
  .page{width:21cm;min-height:29.7cm;margin:0 auto;padding:1.8cm 2.2cm;display:flex;flex-direction:column;}
  .hdr{display:flex;align-items:center;gap:14px;margin-bottom:6px;}
  .hdr-mid{flex:1;text-align:center;font-size:11pt;line-height:1.7;}
  .hdr img{height:64px;object-fit:contain;}
  hr{border:none;border-top:1.5px solid #000;margin:6px 0 22px;}
  .meta{font-size:11pt;line-height:2;margin-bottom:14px;}
  .ttl{text-align:center;font-weight:bold;font-size:15pt;text-decoration:underline;margin:28px 0 32px;}
  .body{flex:1;}
  .body p{font-size:11.5pt;line-height:1.85;text-align:justify;margin-bottom:16px;}
  .sig{margin-top:52px;}
  .sig p{font-size:11pt;margin-bottom:8px;}
  .sig-line{width:190px;border-bottom:1px solid #000;}
  .ftr{margin-top:52px;padding-top:10px;border-top:0.5px solid #bbb;font-size:9pt;color:#555;line-height:1.7;}
  @media print{@page{margin:0;size:A4;}.page{padding:1.8cm 2.2cm;}}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <img src="${origin}/logo.png" alt="Logo"/>
    <div class="hdr-mid">
      <u>Republika e Kosovës</u><br>
      <u>Komuna e Prishtinës</u><br>
      <u><strong>SHFMU "AKADEMIA ORA"</strong></u>
    </div>
    <img src="${origin}/stema.svg" alt="Stema"/>
  </div>
  <hr/>
  <div class="meta">
    <div>Nr i protokollit: ${nr || "___"}</div>
    <div>Data: ${certDate}</div>
  </div>
  <div class="ttl">Vërtetim</div>
  <div class="body">
    ${paras.map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n")}
  </div>
  <div class="sig">
    <p>Shkolla "Akademia Ora"</p>
    <div class="sig-line"></div>
  </div>
  <div class="ftr">
    Për informata shtesë, mund të na kontaktoni në:<br>
    &nbsp;shkollaora@gmail.com<br>
    &nbsp;info@akademiaora.com<br>
    &nbsp;+3846 50 50 55
  </div>
</div>
<script>
  window.onload = function () {
    window.print();
    window.onfocus = function () { setTimeout(function () { window.close(); }, 400); };
  };
</script>
</body>
</html>`;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function Vertetime() {
  const [active, setActive] = useState<CertType | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [nr, setNr] = useState("");
  const [certDate, setCertDate] = useState(todayFmt());
  const [body, setBody] = useState("");

  useEffect(() => {
    fetch("/api/students?limit=500&status=ACTIVE")
      .then(r => r.json())
      .then(d => setStudents(d.students ?? []));
    fetch("/api/staff")
      .then(r => r.json())
      .then(setStaff);
  }, []);

  const persons: Person[] = active
    ? active.personSource === "student"
      ? students
      : active.staffFilter
        ? staff.filter(active.staffFilter)
        : staff
    : [];

  const openType = (t: CertType) => {
    setActive(t);
    setSelId(null);
    setBody("");
    setCertDate(todayFmt());
    setNr("");
  };

  const handleSelect = (id: number) => {
    setSelId(id);
    const p = persons.find(x => x.id === id);
    if (p && active) setBody(makeTemplate(active.id, p));
  };

  const resetBody = () => {
    if (!active || selId === null) return;
    const p = persons.find(x => x.id === selId);
    if (p) setBody(makeTemplate(active.id, p));
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=860,height=700");
    if (w) { w.document.write(buildPrintHtml(nr, certDate, body)); w.document.close(); }
  };

  // ── inline style constants ──────────────────────────────────────────────────
  const paper: React.CSSProperties = {
    width: "100%", maxWidth: "660px", background: "white",
    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
    fontFamily: "'Times New Roman', Times, serif",
    padding: "52px 60px",
    minHeight: "880px",
    display: "flex", flexDirection: "column",
    color: "#000",
  };

  return (
    <>
      <Header title="Vërtetime" backHref="/sekretaria" />
      <div className="p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sekretaria" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gjenerues Vërtetime</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CERT_TYPES.map(t => (
            <button key={t.id} onClick={() => openType(t)}
              className={`card p-5 flex items-start gap-4 hover:ring-2 ${t.ring} transition-all group text-left`}>
              <div className={`w-11 h-11 rounded-xl ${t.bg} flex items-center justify-center flex-shrink-0`}>
                <t.icon className={`w-5 h-5 ${t.color}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 dark:text-white text-sm">{t.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 group-hover:text-slate-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Certificate modal ──────────────────────────────────────────────── */}
      {active && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col">

          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${active.bg} flex items-center justify-center`}>
                <active.icon className={`w-4 h-4 ${active.color}`} />
              </div>
              <span className="font-semibold text-slate-900 dark:text-white text-sm">{active.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={resetBody} title="Rifillo shabllonin"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={handlePrint} className="btn-primary text-sm">
                <Printer className="w-4 h-4" /> Printo
              </button>
              <button onClick={() => setActive(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body: controls + preview */}
          <div className="flex flex-1 overflow-hidden">

            {/* Controls panel */}
            <div className="w-60 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="label">{active.personSource === "student" ? "Nxënësi/ja" : "Anëtari i stafit"}</label>
                <select className="input w-full text-sm" value={selId ?? ""}
                  onChange={e => handleSelect(Number(e.target.value))}>
                  <option value="">— Zgjidh —</option>
                  {persons.map(p => (
                    <option key={p.id} value={p.id}>{personLabel(p)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Nr i protokollit</label>
                <input className="input w-full text-sm" placeholder="p.sh. 1116/26"
                  value={nr} onChange={e => setNr(e.target.value)} />
              </div>

              <div>
                <label className="label">Data</label>
                <input className="input w-full text-sm" value={certDate}
                  onChange={e => setCertDate(e.target.value)} />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Teksti gjenerohet automatikisht. Kliko direkt mbi të për ta ndryshuar.
                </p>
              </div>
            </div>

            {/* Certificate preview */}
            <div className="flex-1 bg-slate-300 dark:bg-slate-700 overflow-y-auto flex justify-center p-8">
              <div style={paper}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Logo" style={{ height: "62px", objectFit: "contain" }} />
                  <div style={{ flex: 1, textAlign: "center", fontSize: "10.5pt", lineHeight: 1.75 }}>
                    <div style={{ textDecoration: "underline" }}>Republika e Kosovës</div>
                    <div style={{ textDecoration: "underline" }}>Komuna e Prishtinës</div>
                    <div style={{ textDecoration: "underline", fontWeight: "bold" }}>SHFMU &quot;AKADEMIA ORA&quot;</div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/stema.svg" alt="Stema" style={{ height: "62px", objectFit: "contain" }} />
                </div>

                <hr style={{ border: "none", borderTop: "1.5px solid #000", margin: "6px 0 22px" }} />

                {/* Protocol & date — editable inline */}
                <div style={{ fontSize: "10.5pt", lineHeight: 2.1, marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>Nr i protokollit:</span>
                    <input value={nr} onChange={e => setNr(e.target.value)}
                      placeholder="___"
                      style={{ border: "none", borderBottom: "1px dashed #94a3b8", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: "inherit", color: "inherit", width: "130px" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>Data:</span>
                    <input value={certDate} onChange={e => setCertDate(e.target.value)}
                      style={{ border: "none", borderBottom: "1px dashed #94a3b8", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: "inherit", color: "inherit", width: "130px" }} />
                  </div>
                </div>

                {/* Title */}
                <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "14.5pt", textDecoration: "underline", margin: "22px 0 30px" }}>
                  Vërtetim
                </div>

                {/* Body — editable textarea */}
                <div style={{ flex: 1 }}>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Zgjidh nxënësin ose stafin nga paneli majtas për të gjeneruar tekstin automatikisht. Pastaj mund ta editosh direkt."
                    style={{
                      width: "100%", minHeight: "210px",
                      border: "1px dashed #cbd5e1", borderRadius: "2px",
                      outline: "none", resize: "vertical", background: "transparent",
                      fontFamily: "'Times New Roman', Times, serif",
                      fontSize: "11pt", lineHeight: 1.85,
                      textAlign: "justify", color: "#000", padding: "6px",
                    }}
                  />
                </div>

                {/* Signature */}
                <div style={{ marginTop: "52px" }}>
                  <div style={{ fontSize: "10.5pt", marginBottom: "8px" }}>Shkolla &quot;Akademia Ora&quot;</div>
                  <div style={{ width: "190px", borderBottom: "1px solid #000" }} />
                </div>

                {/* Footer */}
                <div style={{ marginTop: "52px", paddingTop: "10px", borderTop: "0.5px solid #ccc", fontSize: "9pt", color: "#555", lineHeight: 1.7 }}>
                  <div>Për informata shtesë, mund të na kontaktoni në:</div>
                  <div>&nbsp;shkollaora@gmail.com</div>
                  <div>&nbsp;info@akademiaora.com</div>
                  <div>&nbsp;+3846 50 50 55</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
