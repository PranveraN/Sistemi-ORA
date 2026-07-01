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

const ROLE_ICONS: Record<string, string> = {
  ADMIN: "⚡", FINANCE: "💰", SECRETARY: "📋", SUPERADMIN: "👑",
};

export default function SuperAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", adminEmail: "", adminName: "", adminPassword: ""
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
      body: JSON.stringify({ ...form, plan: "demo" }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg("success");
      setForm({ name: "", slug: "", adminEmail: "", adminName: "", adminPassword: "" });
      setShowForm(false);
      fetchOrgs();
    } else {
      setMsg(data.error || "Gabim");
    }
    setSaving(false);
  }

  const licensed = orgs.filter(o => o.plan === "licensed").length;
  const demos    = orgs.filter(o => o.plan !== "licensed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Top bar */}
      <div className="border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/25 text-base">
              👑
            </div>
            <div>
              <p className="font-semibold text-sm">Sistemi ORA</p>
              <p className="text-gray-600 text-xs">Paneli i Menaxhimit</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-violet-500/20 hover:scale-[1.02]">
            + Institucion i Ri
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-3xl font-bold mb-1">{orgs.length}</p>
            <p className="text-gray-500 text-sm">Gjithsej institucione</p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-3xl font-bold text-emerald-400">{licensed}</p>
              <span className="text-emerald-500 text-lg">✓</span>
            </div>
            <p className="text-gray-500 text-sm">Me licencë aktive</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5">
            <p className="text-3xl font-bold text-amber-400 mb-1">{demos}</p>
            <p className="text-gray-500 text-sm">Në periudhë demo</p>
          </div>
        </div>

        {/* Notifications */}
        {msg === "success" && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
            <span className="text-base">✓</span> Institucioni u shtua. Statusi fillestar: <strong>Demo</strong>.
          </div>
        )}
        {msg && msg !== "success" && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {msg}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="mb-8 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
            <h2 className="font-semibold text-sm mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs">🏫</span>
              Institucion i Ri
            </h2>
            <form onSubmit={createOrg} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Emri i Institucionit</label>
                <input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/40 transition"
                  placeholder="Shkolla ABC"
                  value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")}))}
                  required />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Slug (URL)</label>
                <input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/40 transition"
                  placeholder="shkolla-abc"
                  value={form.slug}
                  onChange={e => setForm(f => ({...f, slug: e.target.value}))}
                  required />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Email Admin</label>
                <input type="email" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/40 transition"
                  placeholder="admin@shkolla.al"
                  value={form.adminEmail}
                  onChange={e => setForm(f => ({...f, adminEmail: e.target.value}))}
                  required />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Emri Admin</label>
                <input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/40 transition"
                  placeholder="Admin Shkolla"
                  value={form.adminName}
                  onChange={e => setForm(f => ({...f, adminName: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Fjalëkalimi</label>
                <input type="password" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/40 transition"
                  placeholder="••••••••"
                  value={form.adminPassword}
                  onChange={e => setForm(f => ({...f, adminPassword: e.target.value}))}
                  required />
              </div>
              <div className="col-span-2 bg-amber-500/8 border border-amber-500/15 rounded-xl p-3 text-xs text-amber-400/80">
                ℹ️ Institucioni do të fillojë si <strong>Demo</strong>. Pas blerjes, e aktivizon manualisht si <strong>Licencuar</strong>.
              </div>
              <div className="col-span-2 flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20">
                  {saving ? "Duke shtuar..." : "Shto Institucionin"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] px-6 py-2.5 rounded-xl text-sm font-medium transition">
                  Anulo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Institutions list */}
        <div>
          <p className="text-[11px] text-gray-600 uppercase tracking-widest font-medium mb-4">Institucionet ({orgs.length})</p>
          <div className="space-y-2">
            {orgs.map(org => {
              const isLicensed = org.plan === "licensed";
              return (
                <a key={org.id} href={`/superadmin/${org.id}`}
                  className="group flex items-center justify-between bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl px-5 py-4 transition-all no-underline text-white cursor-pointer">

                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${isLicensed ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border border-emerald-500/20" : "bg-white/[0.06] border border-white/[0.07]"}`}>
                      🏫
                    </div>
                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{org.name}</span>
                        {isLicensed ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            ✓ Licencuar
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Demo
                          </span>
                        )}
                        {!org.active && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            Joaktiv
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-xs mt-0.5">/{org.slug}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    {/* User avatars */}
                    <div className="flex -space-x-1.5">
                      {org.users.slice(0, 5).map(u => (
                        <div key={u.id} title={`${u.name} (${u.role})`}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 border-2 border-[#0a0a0f] flex items-center justify-center text-[9px]">
                          {ROLE_ICONS[u.role] ?? u.name[0]}
                        </div>
                      ))}
                      {org.users.length > 5 && (
                        <div className="w-6 h-6 rounded-full bg-white/10 border-2 border-[#0a0a0f] flex items-center justify-center text-[8px] text-gray-400">
                          +{org.users.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-gray-600 text-xs hidden sm:block">{org.users.length} user</span>
                    {/* Arrow */}
                    <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
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
