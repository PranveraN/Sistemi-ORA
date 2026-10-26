"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, Plus, Pencil, Trash2, X, Check, Users, Download, Upload, Loader2,
  MoreHorizontal, Eye, EyeOff, FilePen, FileText, ChevronLeft, ChevronRight,
  ChevronDown, Columns3, AlertTriangle, FileSpreadsheet,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import * as XLSX from "xlsx";

interface StaffMember {
  id: number;
  emri: string;
  telefoni: string | null;
  lenda: string | null;
  nrPersonal: string | null;
  nrLlogarise: string | null;
  banka: string | null;
  totalBruto: number | null;
  kontrata: string | null;
  llojiKontrates: string | null;
  cmimOres: number | null;
  oreMuaj: number | null;
  adresa: string | null;
  kodi: string | null;
  tipi: string | null;
  status: string;
  dataLindjes: string | null;
  vendlindja: string | null;
  gjinia: string | null;
  shtetesia: string | null;
  email: string | null;
  dataFillimit: string | null;
  orari: string | null;
  niveliShkollimit: string | null;
  profesioni: string | null;
  pozita: string | null;
  contractEndDate: string | null;
}

interface StaffDoc {
  id: number;
  type: string;
  label: string;
  module: string | null;
  createdAt: string;
  generatedBy: string | null;
}

const EMPTY: Omit<StaffMember, "id"> = {
  emri: "", telefoni: null, lenda: null, nrPersonal: null,
  nrLlogarise: null, banka: null, totalBruto: null,
  kontrata: null, llojiKontrates: null, cmimOres: null, oreMuaj: null,
  adresa: null, kodi: null, tipi: "Primar", status: "ACTIVE",
  dataLindjes: null, vendlindja: null, gjinia: null, shtetesia: null,
  email: null, dataFillimit: null, orari: null, niveliShkollimit: null,
  profesioni: null, pozita: null, contractEndDate: null,
};

// Kolonat e template-it Excel të stafit — të njëjtat për shkarkimin e
// template-it bosh, eksportin e stafit ekzistues, dhe importin (kërkimi i
// kolonave është fleksibël sipas emrit të header-it, jo pozicionit).
const TEMPLATE_HEADERS = [
  "Nr", "Emri Mbiemri", "Nr.Personal", "Datlindja", "Vendlindja", "Gjinia",
  "Shtetesia", "Telefoni", "Emaili", "Data e fillimit të punës",
  "Përzgjedhja e punëdhënësit Primar/Sekondar", "Orari", "Niveli i shkollimit",
  "Profesioni", "Pozita",
];

const PAGE_SIZE = 25;
// Vlerat e fushës "kontrata" që do të thonë kontratë e nënshkruar
const SIGNED = ["po", "nenshkruar", "nënshkruar", "po/nënshkruar", "po/nenshkruar"];

// Rolet që i shohin vlerat e ndjeshme në tabelë (kur e ndezin kolonën); të tjerët shohin "•••"
const SENSITIVE_ROLES = ["SUPERADMIN", "ADMIN", "FINANCE"];

const isHourlyStaff = (m: StaffMember) => m.llojiKontrates === "Me Orë" || m.llojiKontrates === "Gjysmë Orari";
/** Paga për shfaqje: stafi me orë → çmimi i orës (si në kontratë), të tjerët → shuma mujore. */
function payText(m: StaffMember): string | null {
  if (isHourlyStaff(m)) return m.cmimOres != null ? `${m.cmimOres} €/orë` : null;
  return m.totalBruto != null ? `€${m.totalBruto.toLocaleString()}` : null;
}

// Kolonat e tabelës: 4 të parat të ndezura si parazgjedhje, të tjerat i ndez përdoruesi te "Kolonat".
// `cell` = vlera e thjeshtë për kolonat shtesë; `sensitive` = "•••" për rolet pa leje.
const COLS = [
  { key: "roli", label: "Roli", def: true },
  { key: "tipi", label: "Tipi", def: true },
  { key: "telefoni", label: "Telefoni", def: true },
  { key: "fillimi", label: "Fillimi", def: true },
  { key: "email", label: "Email", def: false, cell: (m: StaffMember) => m.email },
  { key: "kodi", label: "Kodi", def: false, cell: (m: StaffMember) => m.kodi },
  { key: "nrPersonal", label: "Nr. personal", def: false, sensitive: true, cell: (m: StaffMember) => m.nrPersonal },
  { key: "dataLindjes", label: "Datëlindja", def: false, cell: (m: StaffMember) => fmtDate(m.dataLindjes) },
  { key: "vendlindja", label: "Vendlindja", def: false, cell: (m: StaffMember) => m.vendlindja },
  { key: "gjinia", label: "Gjinia", def: false, cell: (m: StaffMember) => m.gjinia },
  { key: "shtetesia", label: "Shtetësia", def: false, cell: (m: StaffMember) => m.shtetesia },
  { key: "adresa", label: "Adresa", def: false, cell: (m: StaffMember) => m.adresa },
  { key: "orari", label: "Orari", def: false, cell: (m: StaffMember) => m.orari },
  { key: "niveli", label: "Niveli i shkollimit", def: false, cell: (m: StaffMember) => m.niveliShkollimit },
  { key: "profesioni", label: "Profesioni", def: false, cell: (m: StaffMember) => m.profesioni },
  { key: "kontrata", label: "Statusi i kontratës", def: false, cell: (m: StaffMember) => m.kontrata },
  { key: "llojiKontrates", label: "Lloji i kontratës", def: false, cell: (m: StaffMember) => m.llojiKontrates },
  { key: "mbarimi", label: "Mbarimi i kontratës", def: false, cell: (m: StaffMember) => fmtDate(m.contractEndDate) },
  { key: "llogaria", label: "Llogaria bankare", def: false, sensitive: true, cell: (m: StaffMember) => m.nrLlogarise ? `${m.nrLlogarise}${m.banka ? ` (${m.banka})` : ""}` : null },
  { key: "bruto", label: "Paga", def: false, sensitive: true, cell: payText },
] as const satisfies readonly { key: string; label: string; def: boolean; sensitive?: boolean; cell?: (m: StaffMember) => string | null }[];
type ColKey = (typeof COLS)[number]["key"];
const DEFAULT_COLS: ColKey[] = COLS.filter(c => c.def).map(c => c.key);
const EXTRA_COLS = COLS.filter(c => !c.def);
const COLS_KEY = "stafi.kolonat.v2";

/** Gjendja e kontratës sipas datës së mbarimit (i njëjti rregull si paneli i Sekretarisë). */
function contractState(end: string | null, days: number): "expired" | "expiring" | null {
  if (!end) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(end);
  if (d < today) return "expired";
  const limit = new Date(today); limit.setDate(today.getDate() + days);
  return d <= limit ? "expiring" : null;
}

const hasContract = (m: StaffMember) => !!m.kontrata && SIGNED.includes(m.kontrata.trim().toLowerCase());

/** Tipi për shfaqje: Menaxhment, Asistent/e (pozita përmban "asist"), Mësimdhënës (Primar/Sekondar). */
function tipiView(m: StaffMember): { label: string; cls: string } | null {
  if (m.tipi === "Menaxhment") return { label: "Menaxhment", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" };
  if ((m.pozita || "").toLowerCase().includes("asist")) return { label: "Asistent/e", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" };
  if (m.tipi === "Primar" || m.tipi === "Sekondar") return { label: "Mësimdhënës", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
  return null;
}

/** Vetëm për shfaqje: 044 686 293 / 38344686293 → +383 44 686 293. Formatet e tjera mbeten siç janë. */
function formatPhone(raw: string | null): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00383")) d = d.slice(5);
  else if (d.startsWith("383")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 8) return raw;
  return `+383 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

/** Data ISO → dd.mm.yyyy (prerje teksti, pa zhvendosje nga zona kohore). */
function fmtDate(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

function monthsSince(iso: string): number {
  const [y, mo, d] = iso.slice(0, 10).split("-").map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
  if (now.getDate() < d) months--;
  return months;
}

function stazh(iso: string | null): string {
  if (!iso) return "";
  const months = monthsSince(iso);
  if (months < 0) return "ende pa filluar";
  if (months < 12) return months === 0 ? "< 1 muaj" : `${months} muaj`;
  const y = Math.floor(months / 12);
  return y === 1 ? "1 vit" : `${y} vjet`;
}

const isUnder18 = (iso: string | null) => !!iso && monthsSince(iso) < 18 * 12;

// 10 fushat kryesore — mungesa e tyre del bosh edhe në kontratë
const KEY_FIELDS: { key: keyof StaffMember; label: string }[] = [
  { key: "nrPersonal", label: "Nr. personal" },
  { key: "dataLindjes", label: "Datëlindja" },
  { key: "adresa", label: "Adresa" },
  { key: "email", label: "Email" },
  { key: "telefoni", label: "Telefoni" },
  { key: "dataFillimit", label: "Fillimi" },
  { key: "pozita", label: "Pozita" },
  { key: "niveliShkollimit", label: "Niveli i shkollimit" },
  { key: "nrLlogarise", label: "Llogaria bankare" },
  { key: "totalBruto", label: "Paga bruto" },
];
const missingFields = (m: StaffMember) => KEY_FIELDS.filter(f => m[f.key] == null || String(m[f.key]).trim() === "");

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span className={`flex-shrink-0 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 font-semibold flex items-center justify-center ${size === "lg" ? "w-12 h-12 text-base" : "w-8 h-8 text-xs"}`}>
      {initials(name)}
    </span>
  );
}

export default function StafiPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "menaxhment" | "mesimdhenes">("all");
  const [lendaFilter, setLendaFilter] = useState("");
  const [kontrataFilter, setKontrataFilter] = useState<"" | "me" | "pa">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Omit<StaffMember, "id">>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: session } = useSession();
  const canSeeSensitive = SENSITIVE_ROLES.includes((session?.user as { role?: string } | undefined)?.role ?? "");

  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_COLS);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(COLS_KEY) || "null");
      if (Array.isArray(v)) setVisibleCols(v.filter((k): k is ColKey => COLS.some(c => c.key === k)));
    } catch { /* localStorage i padisponueshëm */ }
  }, []);
  const toggleCol = (k: ColKey) => setVisibleCols(prev => {
    const next = prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k];
    try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /* s'ka rëndësi */ }
    return next;
  });
  const resetCols = () => {
    setVisibleCols(DEFAULT_COLS);
    try { localStorage.removeItem(COLS_KEY); } catch { /* s'ka rëndësi */ }
  };
  const show = (k: ColKey) => visibleCols.includes(k);
  const extraShown = EXTRA_COLS.filter(c => show(c.key));

  const load = () => {
    setLoading(true);
    fetch("/api/staff")
      .then(r => r.json())
      .then((data: StaffMember[]) => {
        setStaff(Array.isArray(data) ? [...data].sort((a, b) =>
          a.emri.localeCompare(b.emri, "sq", { sensitivity: "base" })
        ) : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Parametrat nga paneli i Sekretarisë: ?new=1 (shto), ?staffId=X (profili), ?kontrata=expiring|expired
  const [contractFilter, setContractFilter] = useState<"expiring" | "expired" | null>(null);
  const [expiryDays, setExpiryDays] = useState(30);
  const urlHandled = useRef(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const k = p.get("kontrata");
    if (k === "expiring" || k === "expired") {
      setContractFilter(k);
      fetch("/api/settings").then(r => r.json()).then(d => setExpiryDays(parseInt(d.staffContractExpiryDays) || 30)).catch(() => {});
    }
    if (p.get("new") === "1") { urlHandled.current = true; openAdd(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (urlHandled.current || loading) return;
    const id = parseInt(new URLSearchParams(window.location.search).get("staffId") || "");
    if (staff.some(s => s.id === id)) { urlHandled.current = true; setSelectedId(id); }
  }, [staff, loading]);

  const openAdd = () => { setForm(EMPTY); setModal("add"); };
  const openEdit = (m: StaffMember) => {
    setForm({
      emri: m.emri, telefoni: m.telefoni, lenda: m.lenda, nrPersonal: m.nrPersonal,
      nrLlogarise: m.nrLlogarise, banka: m.banka, totalBruto: m.totalBruto,
      kontrata: m.kontrata, llojiKontrates: m.llojiKontrates,
      cmimOres: m.cmimOres, oreMuaj: m.oreMuaj,
      adresa: m.adresa, kodi: m.kodi, tipi: m.tipi, status: m.status,
      dataLindjes: m.dataLindjes ? m.dataLindjes.slice(0, 10) : null,
      vendlindja: m.vendlindja, gjinia: m.gjinia, shtetesia: m.shtetesia,
      email: m.email,
      dataFillimit: m.dataFillimit ? m.dataFillimit.slice(0, 10) : null,
      contractEndDate: m.contractEndDate ? m.contractEndDate.slice(0, 10) : null,
      orari: m.orari, niveliShkollimit: m.niveliShkollimit,
      profesioni: m.profesioni, pozita: m.pozita,
    });
    setEditId(m.id);
    setModal("edit");
  };

  const save = async () => {
    setSaving(true);
    const res = modal === "add"
      ? await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      : await fetch(`/api/staff/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Ruajtja dështoi.");
      return;
    }
    setModal(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/staff/${deleteId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Fshirja dështoi.");
      return;
    }
    if (selectedId === deleteId) setSelectedId(null);
    setDeleteId(null);
    load();
  };

  // ?kontrata=expiring|expired (nga paneli i Sekretarisë) — vetëm filtër i listës
  const visibleStaff = contractFilter ? staff.filter(s => contractState(s.contractEndDate, expiryDays) === contractFilter) : staff;
  const menaxhment = visibleStaff.filter(s => s.tipi === "Menaxhment");
  const mesimdhenes = visibleStaff.filter(s => s.tipi !== "Menaxhment");

  const lendet = useMemo(
    () => [...new Set(staff.map(s => s.lenda?.trim()).filter((l): l is string => !!l))].sort((a, b) => a.localeCompare(b, "sq")),
    [staff],
  );

  const q = search.trim().toLowerCase();
  const filtered = (tab === "menaxhment" ? menaxhment : tab === "mesimdhenes" ? mesimdhenes : visibleStaff).filter(s =>
    (!q || s.emri.toLowerCase().includes(q) || (s.lenda || "").toLowerCase().includes(q) || (s.kodi || "").toLowerCase().includes(q)) &&
    (!lendaFilter || s.lenda?.trim() === lendaFilter) &&
    (!kontrataFilter || (kontrataFilter === "me" ? hasContract(s) : !hasContract(s)))
  );
  useEffect(() => { setPage(1); }, [search, tab, lendaFilter, kontrataFilter, contractFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const selected = staff.find(s => s.id === selectedId) ?? null;

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stafi");
    XLSX.writeFile(wb, "Template-Stafi.xlsx");
  };

  const exportExcel = () => {
    const rows = [...staff].sort((a, b) => a.emri.localeCompare(b.emri, "sq", { sensitivity: "base" }));
    const aoa = [
      TEMPLATE_HEADERS,
      ...rows.map((s, i) => [
        i + 1, s.emri, s.nrPersonal ?? "", s.dataLindjes?.slice(0, 10) ?? "", s.vendlindja ?? "",
        s.gjinia ?? "", s.shtetesia ?? "", s.telefoni ?? "", s.email ?? "",
        s.dataFillimit?.slice(0, 10) ?? "", s.tipi ?? "", s.orari ?? "",
        s.niveliShkollimit ?? "", s.profesioni ?? "", s.pozita ?? "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stafi");
    XLSX.writeFile(wb, `Stafi-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  function getCol(row: Record<string, unknown>, ...keys: string[]): string {
    const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
    for (const key of keys) {
      const v = lower[key.toLowerCase().trim()];
      if (v !== undefined && v !== null && v !== "") return String(v).trim();
    }
    return "";
  }

  function excelDateToIso(raw: string): string | null {
    if (!raw) return null;
    const asNum = parseFloat(raw);
    if (!isNaN(asNum) && asNum > 1000 && !raw.includes("-") && !raw.includes("/")) {
      const d = new Date(Math.round((asNum - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    const dmy = raw.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });

      const rows = rawRows
        .map(row => {
          const emri = getCol(row, "Emri Mbiemri", "Emri", "emri");
          if (!emri) return null;
          return {
            emri,
            nrPersonal: getCol(row, "Nr.Personal", "Nr Personal") || null,
            dataLindjes: excelDateToIso(getCol(row, "Datlindja", "Datëlindja")),
            vendlindja: getCol(row, "Vendlindja") || null,
            gjinia: getCol(row, "Gjinia") || null,
            shtetesia: getCol(row, "Shtetesia", "Shtetësia") || null,
            telefoni: getCol(row, "Telefoni") || null,
            email: getCol(row, "Emaili", "Email") || null,
            dataFillimit: excelDateToIso(getCol(row, "Data e fillimit të punës", "Data e fillimit te punes")),
            tipi: getCol(row, "Përzgjedhja e punëdhënësit Primar/Sekondar", "Perzgjedhja e punedhenesit Primar/Sekondar", "Tipi") || null,
            orari: getCol(row, "Orari") || null,
            niveliShkollimit: getCol(row, "Niveli i shkollimit") || null,
            profesioni: getCol(row, "Profesioni") || null,
            pozita: getCol(row, "Pozita") || null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length === 0) {
        setImportMsg("Asnjë rresht i vlefshëm (mungon 'Emri Mbiemri').");
        return;
      }

      const res = await fetch("/api/staff/merge-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(`U plotësuan të dhënat për ${data.updated} anëtarë ekzistues, u shtuan ${data.created} të rinj.`);
        load();
      } else {
        setImportMsg(data.error || "Importimi dështoi.");
      }
    } catch {
      setImportMsg("Gabim gjatë leximit të skedarit Excel.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: "all", label: "Të gjithë", count: visibleStaff.length },
    { key: "menaxhment", label: "Menaxhment", count: menaxhment.length },
    { key: "mesimdhenes", label: "Mësimdhënës", count: mesimdhenes.length },
  ];

  return (
    <>
      <Header title="Stafi" backHref="/sekretaria" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in text-zinc-900 dark:text-slate-100">
        {/* Titulli + veprimet */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Stafi</h1>
            <p className="text-sm text-zinc-600 dark:text-slate-400">
              {visibleStaff.length} anëtarë · {menaxhment.length} në menaxhment · {mesimdhenes.length} mësimdhënës
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExcelMenu importing={importing} onTemplate={downloadTemplate} onImport={() => fileRef.current?.click()} onExport={exportExcel} />
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <button onClick={openAdd} className="btn-primary bg-primary-700 hover:bg-primary-800">
              <Plus className="w-4 h-4" /> Shto anëtar
            </button>
          </div>
        </div>

        {importMsg && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-center justify-between">
            {importMsg}
            <button onClick={() => setImportMsg(null)} aria-label="Mbyll njoftimin" className="text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {contractFilter && (
          <div className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
            <span>Po shfaqen vetëm kontratat {contractFilter === "expired" ? "e skaduara" : `që skadojnë brenda ${expiryDays} ditëve`}.</span>
            <button onClick={() => setContractFilter(null)} className="text-xs underline">Shfaq të gjithë</button>
          </div>
        )}

        {/* Tabs + filtrat */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-slate-700">
          <div role="tablist" className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-primary-700 text-primary-700 dark:text-primary-300 dark:border-primary-400"
                    : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {t.label} <span className="ml-1 text-xs text-zinc-500">({t.count})</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                className="input pl-9 w-56 rounded-[10px]"
                placeholder="Kërko emër, lëndë, kod..."
                aria-label="Kërko stafin"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input w-40 rounded-[10px]" aria-label="Filtro sipas lëndës" value={lendaFilter} onChange={e => setLendaFilter(e.target.value)}>
              <option value="">Lënda: të gjitha</option>
              {lendet.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="input w-40 rounded-[10px]" aria-label="Filtro sipas kontratës" value={kontrataFilter} onChange={e => setKontrataFilter(e.target.value as "" | "me" | "pa")}>
              <option value="">Kontrata: të gjithë</option>
              <option value="me">Me kontratë</option>
              <option value="pa">Pa kontratë</option>
            </select>
            <ColumnsMenu visible={visibleCols} onToggle={toggleCol} onReset={resetCols} />
          </div>
        </div>

        <div className="flex gap-4 items-start">
          {/* Tabela */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="card rounded-[14px] p-12 text-center text-zinc-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{staff.length === 0 ? "Nuk ka anëtarë stafi." : "Asnjë anëtar nuk përputhet me filtrat."}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-[14px] overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-300px)]">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <Th sticky>Punonjësi</Th>
                        {show("roli") && <Th>Roli</Th>}
                        {show("tipi") && <Th>Tipi</Th>}
                        {show("telefoni") && <Th>Telefoni</Th>}
                        {show("fillimi") && <Th>Fillimi</Th>}
                        {extraShown.map(c => <Th key={c.key}>{c.label}</Th>)}
                        <Th><span className="sr-only">Veprime</span></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map(m => {
                        const isSel = m.id === selectedId;
                        const tv = tipiView(m);
                        const incomplete = missingFields(m).length >= 5;
                        const rowBg = isSel ? "bg-primary-50 dark:bg-primary-900/20" : "bg-white dark:bg-slate-800 group-hover:bg-zinc-50 dark:group-hover:bg-slate-700/40";
                        return (
                          <tr key={m.id} className={`group ${m.status === "INACTIVE" ? "opacity-50" : ""}`}>
                            <td className={`sticky left-0 z-10 px-4 py-2.5 border-b border-zinc-200 dark:border-slate-700 ${rowBg} ${isSel ? "shadow-[inset_3px_0_0_#6d28d9]" : ""}`}>
                              <button onClick={() => setSelectedId(m.id)} className="flex items-center gap-3 text-left min-w-[200px]">
                                <Avatar name={m.emri} />
                                <span className="min-w-0">
                                  <span className="block font-semibold text-zinc-900 dark:text-white whitespace-nowrap">{m.emri}</span>
                                  <span className="block text-xs text-zinc-500 dark:text-slate-400 truncate max-w-[220px]">{m.email || "Pa email"}</span>
                                  {incomplete && (
                                    <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Profil i paplotë
                                    </span>
                                  )}
                                </span>
                              </button>
                            </td>
                            {show("roli") && (
                              <Td bg={rowBg}>
                                <span className="block text-zinc-900 dark:text-slate-200 whitespace-nowrap">{m.pozita || "—"}</span>
                                <span className="block text-xs text-zinc-500 dark:text-slate-400 whitespace-nowrap">{m.lenda || "—"}</span>
                              </Td>
                            )}
                            {show("tipi") && (
                              <Td bg={rowBg}>
                                {tv ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${tv.cls}`}>{tv.label}</span> : <span className="text-zinc-400">—</span>}
                              </Td>
                            )}
                            {show("telefoni") && <Td bg={rowBg}><span className="whitespace-nowrap text-zinc-600 dark:text-slate-300">{formatPhone(m.telefoni) || "—"}</span></Td>}
                            {show("fillimi") && (
                              <Td bg={rowBg}>
                                <span className="block text-zinc-900 dark:text-slate-200">{m.dataFillimit ? m.dataFillimit.slice(0, 4) : "—"}</span>
                                {m.dataFillimit && <span className="block text-xs text-zinc-500 dark:text-slate-400 whitespace-nowrap">{stazh(m.dataFillimit)}</span>}
                              </Td>
                            )}
                            {extraShown.map(c => {
                              const v = c.cell(m);
                              return (
                                <Td key={c.key} bg={rowBg}>
                                  <span className="whitespace-nowrap text-zinc-600 dark:text-slate-300">
                                    {!v ? "—" : "sensitive" in c && c.sensitive && !canSeeSensitive ? "•••" : v}
                                  </span>
                                </Td>
                              );
                            })}
                            <Td bg={rowBg} right>
                              <RowMenu
                                name={m.emri}
                                onView={() => setSelectedId(m.id)}
                                onEdit={() => openEdit(m)}
                                contractHref={`/sekretaria/kontratat-mesimdhnesve?staffId=${m.id}&open=1&from=stafi`}
                                onDelete={() => setDeleteId(m.id)}
                              />
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-zinc-200 dark:border-slate-700 flex items-center justify-between text-xs text-zinc-600 dark:text-slate-400">
                  <span>
                    Duke shfaqur {(curPage - 1) * PAGE_SIZE + 1}–{(curPage - 1) * PAGE_SIZE + pageRows.length} nga {filtered.length}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage === 1} aria-label="Faqja e mëparshme"
                        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-slate-700 disabled:opacity-40">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2">{curPage} / {totalPages}</span>
                      <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage === totalPages} aria-label="Faqja tjetër"
                        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-slate-700 disabled:opacity-40">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Paneli anësor (në ekrane të mëdha) */}
          {selected && (
            <aside className="hidden lg:block w-[380px] flex-shrink-0 sticky top-4">
              <StaffPanel key={selected.id} m={selected} onClose={() => setSelectedId(null)} onEdit={() => openEdit(selected)} />
            </aside>
          )}
        </div>
      </div>

      {/* Paneli si drawer (në celular / ekrane të vogla) */}
      {selected && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 flex items-end" onClick={() => setSelectedId(null)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-[14px]" onClick={e => e.stopPropagation()}>
            <StaffPanel key={selected.id} m={selected} onClose={() => setSelectedId(null)} onEdit={() => openEdit(selected)} />
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {modal === "add" ? "Shto Anëtar Stafi" : "Ndrysho Anëtarin"}
              </h2>
              <button onClick={() => setModal(null)} aria-label="Mbyll" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Emri i plotë *</label>
                <input className="input w-full" value={form.emri} onChange={e => setForm(f => ({ ...f, emri: e.target.value }))} />
              </div>
              <div>
                <label className="label">Telefoni</label>
                <input className="input w-full" value={form.telefoni ?? ""} onChange={e => setForm(f => ({ ...f, telefoni: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Lënda / Roli</label>
                <input className="input w-full" value={form.lenda ?? ""} onChange={e => setForm(f => ({ ...f, lenda: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Nr. Personal</label>
                <input className="input w-full" value={form.nrPersonal ?? ""} onChange={e => setForm(f => ({ ...f, nrPersonal: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Kodi (EM...)</label>
                <div className="flex gap-1.5">
                  <input className="input w-full" value={form.kodi ?? ""} placeholder="gjenerohet vetë" onChange={e => setForm(f => ({ ...f, kodi: e.target.value || null }))} />
                  {!form.kodi && (
                    <button type="button" className="btn-secondary text-xs whitespace-nowrap" title="Merr kodin e radhës"
                      onClick={async () => { const r = await fetch("/api/staff/next-code").catch(() => null); const d = await r?.json().catch(() => null); if (d?.kodi) setForm(f => ({ ...f, kodi: d.kodi })); }}>
                      Gjenero
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Nr. Llogarisë</label>
                <input className="input w-full" value={form.nrLlogarise ?? ""} onChange={e => setForm(f => ({ ...f, nrLlogarise: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Banka</label>
                <input className="input w-full" value={form.banka ?? ""} onChange={e => setForm(f => ({ ...f, banka: e.target.value || null }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Adresa</label>
                <input className="input w-full" value={form.adresa ?? ""} onChange={e => setForm(f => ({ ...f, adresa: e.target.value || null }))} />
              </div>

              {/* Të dhëna shtesë (template Excel) */}
              <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Të Dhëna Shtesë</p>
              </div>
              <div>
                <label className="label">Datëlindja</label>
                <input type="date" className="input w-full" value={form.dataLindjes ?? ""} onChange={e => setForm(f => ({ ...f, dataLindjes: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Vendlindja</label>
                <input className="input w-full" value={form.vendlindja ?? ""} onChange={e => setForm(f => ({ ...f, vendlindja: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Gjinia</label>
                <select className="input w-full" value={form.gjinia ?? ""} onChange={e => setForm(f => ({ ...f, gjinia: e.target.value || null }))}>
                  <option value="">—</option>
                  <option>Mashkull</option>
                  <option>Femër</option>
                </select>
              </div>
              <div>
                <label className="label">Shtetësia</label>
                <input className="input w-full" value={form.shtetesia ?? ""} onChange={e => setForm(f => ({ ...f, shtetesia: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Emaili</label>
                <input type="email" className="input w-full" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Data e Fillimit të Punës</label>
                <input type="date" className="input w-full" value={form.dataFillimit ?? ""} onChange={e => setForm(f => ({ ...f, dataFillimit: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Orari</label>
                <input className="input w-full" placeholder="p.sh. 08:00–13:00" value={form.orari ?? ""} onChange={e => setForm(f => ({ ...f, orari: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Niveli i Shkollimit</label>
                <input className="input w-full" value={form.niveliShkollimit ?? ""} onChange={e => setForm(f => ({ ...f, niveliShkollimit: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Profesioni</label>
                <input className="input w-full" value={form.profesioni ?? ""} onChange={e => setForm(f => ({ ...f, profesioni: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Pozita</label>
                <input className="input w-full" value={form.pozita ?? ""} onChange={e => setForm(f => ({ ...f, pozita: e.target.value || null }))} />
              </div>

              {/* Lloji i Kontratës */}
              <div className="col-span-2">
                <label className="label">Lloji i Kontratës</label>
                <div className="flex gap-2">
                  {["Orar i Plotë", "Gjysmë Orari", "Me Orë"].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, llojiKontrates: f.llojiKontrates === opt ? null : opt }))}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        form.llojiKontrates === opt
                          ? "bg-primary-600 border-primary-600 text-white"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orar i Plotë — paga bruto */}
              {(!form.llojiKontrates || form.llojiKontrates === "Orar i Plotë") && (
                <div className="col-span-2">
                  <label className="label">Total Bruto (€/muaj)</label>
                  <input className="input w-full" type="number" step="0.01" placeholder="p.sh. 900"
                    value={form.totalBruto ?? ""}
                    onChange={e => setForm(f => ({ ...f, totalBruto: e.target.value ? parseFloat(e.target.value) : null }))} />
                </div>
              )}

              {/* Gjysmë Orari / Me Orë — çmim ore + numër orësh */}
              {(form.llojiKontrates === "Gjysmë Orari" || form.llojiKontrates === "Me Orë") && (
                <>
                  <div>
                    <label className="label">Çmimi i Orës (€)</label>
                    <input className="input w-full" type="number" step="0.01" placeholder="p.sh. 8.50"
                      value={form.cmimOres ?? ""}
                      onChange={e => setForm(f => {
                        const c = e.target.value ? parseFloat(e.target.value) : null;
                        const total = c && f.oreMuaj ? Math.round(c * f.oreMuaj * 100) / 100 : f.totalBruto;
                        return { ...f, cmimOres: c, totalBruto: total };
                      })} />
                  </div>
                  <div>
                    <label className="label">Orë / Muaj</label>
                    <input className="input w-full" type="number" step="1" placeholder="p.sh. 80"
                      value={form.oreMuaj ?? ""}
                      onChange={e => setForm(f => {
                        const o = e.target.value ? parseInt(e.target.value) : null;
                        const total = f.cmimOres && o ? Math.round(f.cmimOres * o * 100) / 100 : f.totalBruto;
                        return { ...f, oreMuaj: o, totalBruto: total };
                      })} />
                  </div>
                  <div className="col-span-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Total Bruto i llogaritur</span>
                    <span className="text-lg font-bold text-primary-600">
                      {form.cmimOres && form.oreMuaj
                        ? `€ ${(form.cmimOres * form.oreMuaj).toFixed(2)}`
                        : "—"}
                    </span>
                  </div>
                </>
              )}

              {/* Statusi kontratës + tipi + statusi */}
              <div>
                <label className="label">Statusi Kontratës</label>
                <select className="input w-full" value={form.kontrata ?? ""} onChange={e => setForm(f => ({ ...f, kontrata: e.target.value || null }))}>
                  <option value="">—</option>
                  <option>Po/Nënshkruar</option>
                  <option>Nuk e ka kthy</option>
                  <option>Nuk ka</option>
                  <option>Nuk eshte staf</option>
                </select>
              </div>
              <div>
                <label className="label">Data e Mbarimit të Kontratës</label>
                <input type="date" className="input w-full" value={form.contractEndDate ?? ""} onChange={e => setForm(f => ({ ...f, contractEndDate: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Tipi</label>
                <select className="input w-full" value={form.tipi ?? ""} onChange={e => setForm(f => ({ ...f, tipi: e.target.value || null }))}>
                  <option value="">—</option>
                  <option>Primar</option>
                  <option>Sekondar</option>
                  <option>Menaxhment</option>
                </select>
              </div>
              <div>
                <label className="label">Statusi</label>
                <select className="input w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Aktiv</option>
                  <option value="INACTIVE">Joaktiv</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={save} disabled={saving || !form.emri.trim()} className="btn-primary flex-1">
                {saving ? "Duke ruajtur..." : <><Check className="w-4 h-4" /> Ruaj</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Fshi anëtarin?</h3>
            <p className="text-sm text-slate-400 mb-6">Ky veprim nuk mund të kthehet.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={confirmDelete} className="btn-danger flex-1">Fshi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Qelizat e tabelës ─────────────────────────────────────── */

function Th({ children, sticky, right }: { children: React.ReactNode; sticky?: boolean; right?: boolean }) {
  return (
    <th className={`sticky top-0 ${sticky ? "left-0 z-30" : "z-20"} bg-zinc-50 dark:bg-slate-800 border-b border-zinc-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-zinc-600 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, bg, right }: { children: React.ReactNode; bg: string; right?: boolean }) {
  return <td className={`px-4 py-2.5 border-b border-zinc-200 dark:border-slate-700 ${bg} ${right ? "text-right" : ""}`}>{children}</td>;
}

/* ── Menutë ───────────────────────────────────────────────── */

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

const menuItem = "w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-zinc-700 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-slate-700";

function RowMenu({ name, onView, onEdit, contractHref, onDelete }: {
  name: string; onView: () => void; onEdit: () => void; contractHref: string; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(o => !o)} aria-label={`Veprime për ${name}`} aria-haspopup="menu" aria-expanded={open}
        className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-700">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-40 z-40 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-[10px] shadow-lg py-1">
          <button role="menuitem" onClick={pick(onView)} className={menuItem}><Eye className="w-4 h-4" /> Shiko</button>
          <button role="menuitem" onClick={pick(onEdit)} className={menuItem}><Pencil className="w-4 h-4" /> Ndrysho</button>
          <Link role="menuitem" href={contractHref} className={menuItem}><FilePen className="w-4 h-4" /> Kontrata</Link>
          <button role="menuitem" onClick={pick(onDelete)} className={`${menuItem} text-red-600 dark:text-red-400`}><Trash2 className="w-4 h-4" /> Fshi</button>
        </div>
      )}
    </div>
  );
}

function ExcelMenu({ importing, onTemplate, onImport, onExport }: {
  importing: boolean; onTemplate: () => void; onImport: () => void; onExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={importing} aria-haspopup="menu" aria-expanded={open} className="btn-secondary rounded-[10px]">
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
        {importing ? "Duke importuar..." : "Excel"}
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-48 z-40 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-[10px] shadow-lg py-1">
          <button role="menuitem" onClick={pick(onTemplate)} className={menuItem}><Download className="w-4 h-4" /> Template Excel</button>
          <button role="menuitem" onClick={pick(onImport)} className={menuItem}><Upload className="w-4 h-4" /> Importo Excel</button>
          <button role="menuitem" onClick={pick(onExport)} className={menuItem}><Download className="w-4 h-4" /> Eksporto Excel</button>
        </div>
      )}
    </div>
  );
}

function ColumnsMenu({ visible, onToggle, onReset }: { visible: ColKey[]; onToggle: (k: ColKey) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const item = (c: (typeof COLS)[number]) => (
    <label key={c.key} className={`${menuItem} cursor-pointer`}>
      <input type="checkbox" checked={visible.includes(c.key)} onChange={() => onToggle(c.key)} className="w-4 h-4 accent-violet-700" />
      {c.label}
    </label>
  );
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} className="btn-secondary rounded-[10px]">
        <Columns3 className="w-4 h-4" /> Kolonat
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-56 z-40 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-[10px] shadow-lg py-1">
          <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Kryesore</p>
          {COLS.filter(c => c.def).map(item)}
          <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 border-t border-zinc-200 dark:border-slate-700 mt-1">Të tjera</p>
          {EXTRA_COLS.map(item)}
          <button onClick={onReset} className="w-full mt-1 px-3 py-2 text-xs text-left text-primary-700 dark:text-primary-300 hover:underline border-t border-zinc-200 dark:border-slate-700">
            Kthe si në fillim
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Paneli i punonjësit ──────────────────────────────────── */

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 border-t border-zinc-200 dark:border-slate-700">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400 mb-2">
        {title}
        {badge && <span className="normal-case tracking-normal px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-slate-700 text-[11px] font-medium text-zinc-600 dark:text-slate-300">{badge}</span>}
      </h3>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-zinc-500 dark:text-slate-400 flex-shrink-0">{label}</dt>
      <dd className="text-zinc-900 dark:text-slate-100 text-right break-words min-w-0">{children}</dd>
    </div>
  );
}

const dash = (v: string | null | undefined) => (v && String(v).trim()) || "—";

function Masked({ value, masked, label }: { value: string | null; masked: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!value) return <>—</>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-[13px]">{open ? value : masked}</span>
      <button onClick={() => setOpen(o => !o)} aria-label={`${open ? "Fshih" : "Shfaq"} ${label}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline">
        {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {open ? "Fshih" : "Shfaq"}
      </button>
    </span>
  );
}

function StaffPanel({ m, onClose, onEdit }: { m: StaffMember; onClose: () => void; onEdit: () => void }) {
  // `key={m.id}` te prindi e rikrijon panelin → maskimet dhe dokumentet rifillojnë për çdo person
  const [docs, setDocs] = useState<StaffDoc[] | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const missing = missingFields(m);
  const end = contractState(m.contractEndDate, 30);

  const loadDocs = () => {
    setShowDocs(s => !s);
    if (docs) return;
    fetch(`/api/sekretaria/documents?staffId=${m.id}`)
      .then(r => (r.ok ? r.json() : []))
      .then((d: StaffDoc[]) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]));
  };

  const pay = payText(m);
  const iban = m.nrLlogarise ? `${m.nrLlogarise}${m.banka ? ` (${m.banka})` : ""}` : null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-[14px] overflow-hidden max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* Koka */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <Avatar name={m.emri} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-900 dark:text-white">{m.emri}</p>
            <p className="text-sm text-zinc-600 dark:text-slate-400">{[m.pozita, m.lenda].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <button onClick={onClose} aria-label="Mbyll panelin" className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onEdit} className="btn-secondary rounded-[10px] text-xs px-3 py-1.5"><Pencil className="w-3.5 h-3.5" /> Ndrysho</button>
          <Link href={`/sekretaria/kontratat-mesimdhnesve?staffId=${m.id}&open=1&from=stafi`} className="btn-secondary rounded-[10px] text-xs px-3 py-1.5"><FilePen className="w-3.5 h-3.5" /> Kontrata</Link>
          <button onClick={loadDocs} aria-expanded={showDocs} className="btn-secondary rounded-[10px] text-xs px-3 py-1.5"><FileText className="w-3.5 h-3.5" /> Dokumente</button>
        </div>
        {missing.length > 0 && (
          <div className="mt-4 px-3 py-2 rounded-[10px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <p className="font-semibold">
              {missing.length >= 5 ? `Profili është i paplotë — mungojnë ${missing.length} fusha` : `Mungojnë ${missing.length} fusha`}
            </p>
            <p className="mt-0.5">{missing.map(f => f.label).join(", ")}. Këto dalin bosh edhe në kontratë.</p>
          </div>
        )}
      </div>

      {showDocs && (
        <Section title="Dokumente të printuara">
          {docs === null ? (
            <p className="text-sm text-zinc-500">Duke ngarkuar...</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-zinc-500">Nuk ka dokumente të printuara.</p>
          ) : docs.map(d => (
            <div key={d.id} className="flex justify-between gap-3 text-sm">
              <span className="text-zinc-900 dark:text-slate-100">
                {d.module === "kontratat-mesimdhnesve"
                  ? <Link href={`/sekretaria/kontratat-mesimdhnesve?archiveId=${d.id}`} className="text-primary-700 dark:text-primary-300 hover:underline">{d.label}</Link>
                  : d.label}
              </span>
              <span className="text-zinc-500 dark:text-slate-400 text-right whitespace-nowrap">
                {fmtDate(d.createdAt)}{d.generatedBy ? ` · ${d.generatedBy}` : ""}
              </span>
            </div>
          ))}
        </Section>
      )}

      <Section title="Kontakti">
        <Row label="Email">{dash(m.email)}</Row>
        <Row label="Telefoni">{formatPhone(m.telefoni) || "—"}</Row>
      </Section>

      <Section title="Punësimi">
        <Row label="Pozita">{dash(m.pozita)}</Row>
        <Row label="Lënda / roli">{dash(m.lenda)}</Row>
        <Row label="Punëdhënësi">{dash(m.tipi)}</Row>
        <Row label="Orari">{dash(m.orari)}</Row>
        <Row label="Fillimi">{m.dataFillimit ? `${fmtDate(m.dataFillimit)} · ${stazh(m.dataFillimit)}` : "—"}</Row>
        <Row label="Kodi">{m.kodi ? <span className="font-mono text-[13px]">{m.kodi}</span> : "—"}</Row>
        <Row label="Kontrata">
          {dash(m.kontrata)}
          {m.llojiKontrates && <span className="block text-xs text-zinc-500">{m.llojiKontrates}</span>}
          {m.contractEndDate && (
            <span className={`block text-xs ${end === "expired" ? "text-red-600" : end === "expiring" ? "text-amber-600" : "text-zinc-500"}`}>
              {end === "expired" ? "Skadoi" : "Skadon"} më {fmtDate(m.contractEndDate)}
            </span>
          )}
        </Row>
      </Section>

      <Section title="Kualifikimi">
        <Row label="Niveli i shkollimit">{dash(m.niveliShkollimit)}</Row>
        <Row label="Profesioni">{dash(m.profesioni)}</Row>
      </Section>

      <Section title="Të dhëna personale" badge="Vetëm Admin">
        <Row label="Nr. personal"><Masked value={m.nrPersonal} masked={m.nrPersonal ? `${m.nrPersonal.slice(0, 4)}••••••` : ""} label="numrin personal" /></Row>
        <Row label="Datëlindja">
          {m.dataLindjes ? fmtDate(m.dataLindjes) : "—"}
          {isUnder18(m.dataLindjes) && (
            <span className="flex items-center justify-end gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" /> duket e gabuar
            </span>
          )}
        </Row>
        <Row label="Vendlindja">{dash(m.vendlindja)}</Row>
        <Row label="Gjinia">{dash(m.gjinia)}</Row>
        <Row label="Adresa">{dash(m.adresa)}</Row>
        <Row label="Llogaria bankare"><Masked value={iban} masked={m.nrLlogarise ? `${m.nrLlogarise.slice(0, 4)}••••${m.nrLlogarise.slice(-4)}` : ""} label="llogarinë bankare" /></Row>
        <Row label="Paga bruto"><Masked value={pay} masked="€•••" label="pagën" /></Row>
      </Section>
    </div>
  );
}
