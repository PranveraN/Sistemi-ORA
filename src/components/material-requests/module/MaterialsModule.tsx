"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Package, Download } from "lucide-react";
import Header from "@/components/layout/Header";
import { parseLeadDays } from "@/lib/materialConfig";
import type { MaterialRequestRow, PendingItem } from "../admin/types";
import type { ModuleData, OrderRow } from "./types";
import RequestsTab from "./RequestsTab";
import OrdersTab from "./OrdersTab";
import TeachersTab from "./TeachersTab";
import AnalyticsTab from "./AnalyticsTab";

// "Materialet" — një titull, një header dhe e njëjta gjerësi për të katër
// tab-at. URL: /materialet/{kerkesat|porosite|mesimdhenesit|analitika}/{id}
// që linket mes faqeve të hapin direkt elementin.

export type TabKey = "kerkesat" | "porosite" | "mesimdhenesit" | "analitika";
const TABS: { key: TabKey; label: string }[] = [
  { key: "kerkesat", label: "Kërkesat" },
  { key: "porosite", label: "Porositë" },
  { key: "mesimdhenesit", label: "Mësimdhënësit" },
  { key: "analitika", label: "Analitika" },
];

export function parseMaterialsPath(pathname: string): { tab: TabKey; id: number | null } {
  const [, , t, id] = pathname.split("/");
  const tab = (TABS.some(x => x.key === t) ? t : "kerkesat") as TabKey;
  return { tab, id: parseInt(id ?? "") || null };
}

export default function MaterialsModule() {
  const pathname = usePathname() ?? "/materialet";
  const { tab, id } = parseMaterialsPath(pathname);
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canAct = role === "SUPERADMIN" || role === "FINANCE" || role === "ADMIN";

  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [leadDays, setLeadDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const exporter = useRef<(() => void) | null>(null);
  const [canExport, setCanExport] = useState(false);

  const reload = useCallback(async () => {
    const [rq, od, pd, nw] = await Promise.all([
      fetch("/api/material-requests").catch(() => null),
      fetch("/api/material-orders").catch(() => null),
      fetch("/api/material-orders/pending-items").catch(() => null),
      fetch("/api/materials?reviewStatus=pending").catch(() => null),
    ]);
    if (rq?.ok) setRequests(await rq.json());
    if (od?.ok) { setOrders(await od.json()); setOrdersError(""); }
    else setOrdersError(od?.status === 403 ? "Nuk ke leje për porositë." : "Porositë s'u ngarkuan.");
    if (pd?.ok) setPending(await pd.json());
    if (nw?.ok) setNewItemsCount(((await nw.json()) as unknown[]).length);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    fetch("/api/settings").then(r => (r.ok ? r.json() : null)).then(d => d && setLeadDays(parseLeadDays(d.materialRequestLeadDays))).catch(() => {});
  }, []);

  const setExporter = useCallback((fn: (() => void) | null) => { exporter.current = fn; setCanExport(!!fn); }, []);
  const teacherCount = useMemo(() => new Set(requests.map(r => r.teacherId)).size, [requests]);
  const counts: Record<TabKey, number | null> = { kerkesat: requests.length, porosite: orders.length, mesimdhenesit: teacherCount, analitika: null };

  const data: ModuleData = { requests, orders, ordersError, pending, newItemsCount, leadDays, loading, reload, setExporter, canAct };

  return (
    <>
      <Header />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-10 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-[9px] bg-primary-600 flex items-center justify-center" aria-hidden><Package className="w-[17px] h-[17px] text-white" /></span>
            <h1 className="text-[19px] font-extrabold text-slate-900 dark:text-white">Materialet</h1>
          </div>
          <button type="button" onClick={() => exporter.current?.()} disabled={!canExport} className="btn-secondary text-sm">
            <Download className="w-4 h-4" aria-hidden /> Eksporto Excel
          </button>
        </div>

        <nav aria-label="Pamjet e materialeve" className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1">
          {TABS.map(t => {
            const active = t.key === tab;
            const n = counts[t.key];
            return (
              <Link key={t.key} href={`/materialet/${t.key}`} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 h-10 px-3.5 rounded-[9px] text-sm transition-colors ${
                  active ? "bg-white dark:bg-slate-700 shadow-sm text-violet-900 dark:text-violet-200 font-extrabold" : "text-slate-600 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white"}`}>
                {t.label}
                {n !== null && (
                  <span className={`text-xs font-extrabold px-[7px] py-px rounded-full ${active ? "bg-primary-600 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200"}`}>{n}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {tab === "kerkesat" && <RequestsTab data={data} selectedId={id} />}
        {tab === "porosite" && <OrdersTab data={data} selectedId={id} />}
        {tab === "mesimdhenesit" && <TeachersTab data={data} selectedId={id} />}
        {tab === "analitika" && <AnalyticsTab data={data} />}
      </div>
    </>
  );
}
