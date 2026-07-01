"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";

interface OrgUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

interface Org {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  plan: string;
  createdAt: string;
  users: OrgUser[];
}

const PLAN_CONFIG = {
  pro:   { label: "Pro",   color: "from-violet-500 to-purple-600",  badge: "bg-violet-500/20 text-violet-300 border border-violet-500/30" },
  basic: { label: "Basic", color: "from-blue-500 to-cyan-600",      badge: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  trial: { label: "Trial", color: "from-amber-500 to-orange-500",   badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
};

const ROLE_ICONS: Record<string, string> = {
  ADMIN: "⚡", FINANCE: "💰", SECRETARY: "📋", SUPERADMIN: "👑",
};

export default function SuperAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", adminEmail: "", adminName: "", adminPassword: "", plan: "trial"
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchOrgs(); }, []);

  async function fetchOrgs() {
    setLoading(true);
    const res = await fetch("/api/organizations");
    if (res.ok) setOrgs(await res.json());
    setLoading(false);
  }

  async function createOrg(e: { preventDefault: () => void }) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg("success");
      setForm({ name: "", slug: "", adminEmail: "", adminName: "", adminPassword: "", plan: "trial" });
      setShowForm(false);
      fetchOrgs();
    } else {
      setMsg("❌ " + data.error);
    }
    setSaving(false);
  }

  const totalUsers = orgs.reduce((s, o) => s + o.users.length, 0);
  const activeOrgs = orgs.filter(o => o.active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Duke ngarkuar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg shadow-lg shadow-violet-500/25">
              👑
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Super Admin</h1>
              <p className="text-gray-500 text-xs mt-0.5">Platforma SaaS — Sistemi ORA</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]"
          >
            <span className="text-lg leading-none">+</span>
            Institucion i Ri
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Institucione", value: orgs.length, icon: "🏫", color: "violet" },
            { label: "Aktive", value: activeOrgs, icon: "✅", color: "emerald" },
            { label: "Përdorues", value: totalUsers, icon: "👤", color: "blue" },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-3xl font-bold tracking-tight">{s.value}</span>
              </div>
              <p className="text-gray-500 text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Success message */}
        {msg === "success" && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
            <span>✓</span> Institucioni u krijua me sukses
          </div>
        )}
        {msg && msg !== "success" && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
            <span>✕</span> {msg.replace("❌ ", "")}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="mb-8 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">🏫</div>
              <h2 className="text-base font-semibold">Institucion i Ri</h2>
            </div>
            <form onSubmit={createOrg} className="grid grid-cols-2 gap-4">
              {[
                { label: "Emri i Institucionit", key: "name", placeholder: "Shkolla ABC", type: "text",
                  onChange: (v: string) => setForm(f => ({...f, name: v, slug: v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")})) },
                { label: "Slug (URL)", key: "slug", placeholder: "shkolla-abc", type: "text",
                  onChange: (v: string) => setForm(f => ({...f, slug: v})) },
                { label: "Email Admin", key: "adminEmail", placeholder: "admin@shkolla.al", type: "email",
                  onChange: (v: string) => setForm(f => ({...f, adminEmail: v})) },
                { label: "Emri Admin", key: "adminName", placeholder: "Admin Shkolla", type: "text",
                  onChange: (v: string) => setForm(f => ({...f, adminName: v})) },
                { label: "Fjalëkalimi", key: "adminPassword", placeholder: "••••••••", type: "password",
                  onChange: (v: string) => setForm(f => ({...f, adminPassword: v})) },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide">{field.label}</label>
                  <input
                    type={field.type}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition"
                    placeholder={field.placeholder}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => field.onChange(e.target.value)}
                    required={field.key !== "adminName"}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide">Paketa</label>
                <select
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 transition"
                  value={form.plan}
                  onChange={e => setForm({...form, plan: e.target.value})}
                >
                  <option value="trial">Trial — 30 ditë falas</option>
                  <option value="basic">Basic — 49€/muaj</option>
                  <option value="pro">Pro — 89€/muaj</option>
                </select>
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20">
                  {saving ? "Duke krijuar..." : "Krijo Institucionin"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] px-6 py-2.5 rounded-xl text-sm font-medium transition">
                  Anulo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Orgs list */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest font-medium mb-4">Institucionet</p>
          <div className="space-y-3">
            {orgs.map(org => {
              const plan = PLAN_CONFIG[org.plan as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.trial;
              return (
                <a key={org.id} href={`/superadmin/${org.id}`}
                  className="group flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.055] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl px-6 py-5 transition-all duration-200 no-underline text-white cursor-pointer">

                  {/* Left: avatar + info */}
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center text-lg shadow-lg flex-shrink-0`}>
                      🏫
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-sm">{org.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${plan.badge}`}>
                          {plan.label}
                        </span>
                        {!org.active && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                            Joaktiv
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-xs mt-0.5">/{org.slug}</p>
                    </div>
                  </div>

                  {/* Right: users + arrow */}
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">{org.users.length}</p>
                      <p className="text-gray-600 text-xs">përdorues</p>
                    </div>
                    <div className="flex -space-x-2">
                      {org.users.slice(0, 4).map(u => (
                        <div key={u.id} title={`${u.name} (${u.role})`}
                          className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 border-2 border-[#0a0a0f] flex items-center justify-center text-[10px] font-bold">
                          {ROLE_ICONS[u.role] ?? u.name[0]}
                        </div>
                      ))}
                      {org.users.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-[#0a0a0f] flex items-center justify-center text-[9px] text-gray-400 font-medium">
                          +{org.users.length - 4}
                        </div>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
