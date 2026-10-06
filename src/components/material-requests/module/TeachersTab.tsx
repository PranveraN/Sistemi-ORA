"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { STATUS_UI, requestStatusKey, type StatusKey } from "@/lib/materialStatusUi";
import { normalizeSearch } from "@/lib/utils";
import StatusBadge from "../StatusBadge";
import { requestSnippet, sentDate, type MaterialRequestRow } from "../admin/types";
import { Avatar, EmptyRow, ListPanel, ListRow, SplitLayout, fmtD } from "./ui";
import type { ModuleData } from "./types";

// Materialet → Mësimdhënësit: kush kërkon çka, me statuset e kërkesave të tyre.

interface TeacherSummary {
  id: number; name: string; requests: MaterialRequestRow[];
  byStatus: Record<StatusKey, number>; last: string;
}
const ORDER: StatusKey[] = ["DELIVERED", "ORDERED", "APPROVED", "UNDER_REVIEW", "SUBMITTED", "REJECTED"];
const plural = (n: number) => `${n} ${n === 1 ? "kërkesë" : "kërkesa"}`;

export default function TeachersTab({ data, selectedId }: { data: ModuleData; selectedId: number | null }) {
  const { requests, loading, setExporter } = data;
  const [search, setSearch] = useState("");

  const teachers = useMemo(() => {
    const m = new Map<number, TeacherSummary>();
    for (const r of requests) {
      const t = m.get(r.teacherId) ?? { id: r.teacherId, name: r.teacher.name, requests: [], byStatus: { SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 0, ORDERED: 0, DELIVERED: 0, REJECTED: 0, CANCELLED: 0 }, last: sentDate(r) };
      t.requests.push(r);
      t.byStatus[requestStatusKey(r.status)]++;
      if (sentDate(r) > t.last) t.last = sentDate(r);
      m.set(r.teacherId, t);
    }
    for (const t of m.values()) t.requests.sort((a, b) => sentDate(b).localeCompare(sentDate(a)));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "sq"));
  }, [requests]);

  const visible = useMemo(() => {
    const q = normalizeSearch(search.trim());
    return q ? teachers.filter(t => normalizeSearch(t.name).includes(q)) : teachers;
  }, [teachers, search]);
  const selected = teachers.find(t => t.id === selectedId) ?? (selectedId ? null : visible[0] ?? null);

  useEffect(() => {
    setExporter(() => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Mësuesi", "Kërkesa gjithsej", "Dorëzuar", "Në proces", "Refuzuar", "Kërkesa e fundit"],
        ...visible.map(t => [t.name, t.requests.length, t.byStatus.DELIVERED, inProcess(t), t.byStatus.REJECTED, fmtD(t.last)]),
      ]), "Mësimdhënësit");
      XLSX.writeFile(wb, `Mesimdhenesit-Materiale-${fmtD(new Date()).replace(/\//g, "-")}.xlsx`);
    });
    return () => setExporter(null);
  }, [visible, setExporter]);

  return (
    <SplitLayout
      list={
        <ListPanel search={search} onSearch={setSearch} label="Kërko mësuesin" placeholder="Kërko mësuesin…">
          {loading ? <EmptyRow text="Duke ngarkuar…" />
            : visible.length === 0 ? <EmptyRow text={teachers.length ? "Asnjë mësues nuk përputhet me kërkimin." : "Asnjë mësues nuk ka bërë kërkesë ende."} />
            : visible.map(t => (
              <ListRow key={t.id} href={`/materialet/mesimdhenesit/${t.id}`} active={selected?.id === t.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} />
                  <div className="min-w-0 flex-1">
                    <b className="text-sm text-slate-900 dark:text-white">{t.name}</b>
                    <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">{plural(t.requests.length)} · {t.byStatus.DELIVERED} të dorëzuara</p>
                  </div>
                  <StatusBar t={t} />
                </div>
              </ListRow>
            ))}
        </ListPanel>
      }
      detail={selected ? <TeacherDetail t={selected} /> : <div className="card p-10 text-center text-sm text-slate-500">{loading ? "Duke ngarkuar…" : "Asnjë mësues nuk ka bërë kërkesë ende."}</div>}
    />
  );
}

const inProcess = (t: TeacherSummary) => t.byStatus.SUBMITTED + t.byStatus.UNDER_REVIEW + t.byStatus.APPROVED + t.byStatus.ORDERED;

function StatusBar({ t }: { t: TeacherSummary }) {
  const total = t.requests.length || 1;
  return (
    <span className="flex w-[60px] h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0" role="img"
      aria-label={ORDER.filter(k => t.byStatus[k]).map(k => `${STATUS_UI[k].label} ${t.byStatus[k]}`).join(", ")}>
      {ORDER.map(k => t.byStatus[k] > 0 && <span key={k} className={STATUS_UI[k].dot} style={{ width: `${(t.byStatus[k] / total) * 100}%` }} />)}
    </span>
  );
}

function TeacherDetail({ t }: { t: TeacherSummary }) {
  const boxes = [
    { label: "Kërkesa gjithsej", value: t.requests.length, cls: "text-slate-900 dark:text-white" },
    { label: "Dorëzuar", value: t.byStatus.DELIVERED, cls: "text-green-700 dark:text-green-400" },
    { label: "Në proces", value: inProcess(t), cls: "text-blue-700 dark:text-blue-300" },
    { label: "Refuzuar", value: t.byStatus.REJECTED, cls: "text-red-700 dark:text-red-400" },
  ];
  return (
    <section className="card p-5 sm:p-6 space-y-5" aria-labelledby="td-title">
      <div className="flex items-center gap-3.5">
        <Avatar name={t.name} size="lg" />
        <div>
          <h2 id="td-title" className="text-xl font-extrabold text-slate-900 dark:text-white">{t.name}</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Kërkesa e fundit: {fmtD(t.last)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {boxes.map(b => (
          <div key={b.label} className="rounded-[10px] bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
            <p className="text-[12.5px] font-bold text-slate-600 dark:text-slate-300">{b.label}</p>
            <p className={`text-[22px] font-extrabold mt-0.5 ${b.cls}`}>{b.value}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white mb-2.5">Kërkesat</h3>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                <th className="px-4 py-2.5 w-[100px]">DATA</th><th className="px-4 py-2.5">ARTIKUJT</th><th className="px-4 py-2.5 w-[140px]">POROSIA</th>
                <th className="px-4 py-2.5 w-[120px]">STATUSI</th><th className="px-4 py-2.5 w-[60px]"><span className="sr-only">Hap</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {t.requests.map(r => {
                const orders = new Map<number, string>();
                for (const it of r.items) for (const l of it.orderLinks) orders.set(l.orderItem.order.id, l.orderItem.order.orderNumber);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtD(sentDate(r))}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{requestSnippet(r)}</td>
                    <td className="px-4 py-3 text-[13px]">
                      {orders.size ? [...orders.entries()].map(([id, num], i) => (
                        <span key={id}>{i > 0 && ", "}<Link href={`/materialet/porosite/${id}`} className="text-primary-700 dark:text-primary-300 hover:underline">{num}</Link></span>
                      )) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3"><Link href={`/materialet/kerkesat/${r.id}`} className="text-[13px] font-bold text-primary-700 dark:text-primary-300 hover:underline" aria-label={`Hap kërkesën e ${fmtD(sentDate(r))}`}>Hap</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
