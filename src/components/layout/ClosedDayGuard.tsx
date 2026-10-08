"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { askDeleteReason, reasonHeaders } from "@/lib/auditReason";

// Ditët e mbyllura të arkës (Faza 2 e auditimit). Kur serveri refuzon një
// ndryshim sepse prek një ditë të mbyllur, Super Admin-it i ofrohet — në një
// vend të vetëm, për çdo faqe — mundësia ta bëjë me arsye: kërkesa përsëritet
// me arsyen dhe konfirmimin e posaçëm, dhe serveri krijon gjetje auditimi.
// Për rolet e tjera s'ndryshon asgjë: faqja shfaq mesazhin e serverit.
const MARK = "[DITË E MBYLLUR]";

export default function ClosedDayGuard() {
  const { data } = useSession();
  const isSuperAdmin = (data?.user as { role?: string } | undefined)?.role === "SUPERADMIN";

  useEffect(() => {
    if (!isSuperAdmin) return;
    const original = window.fetch;
    const patched: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);
      if (res.ok || res.status < 400 || typeof input !== "string" || (init?.headers && new Headers(init.headers).has("X-Closed-Day-Override"))) return res;
      const body = await res.clone().json().catch(() => null) as { error?: string; message?: string } | null;
      const msg = body?.error ?? body?.message ?? "";
      if (!msg.includes(MARK)) return res;
      const reason = askDeleteReason(`${msg.replace(MARK, "").trim()}\n\nSi Super Admin mund ta bëni këtë ndryshim. Do të krijohet një gjetje auditimi.`);
      if (!reason) return res;
      const headers = new Headers(init?.headers);
      for (const [k, v] of Object.entries(reasonHeaders(reason))) headers.set(k, v);
      headers.set("X-Closed-Day-Override", "1");
      return original(input, { ...init, headers });
    };
    window.fetch = patched;
    return () => { if (window.fetch === patched) window.fetch = original; };
  }, [isSuperAdmin]);

  return null;
}
