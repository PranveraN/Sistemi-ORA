"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin", FINANCE: "Financë", SECRETARY: "Sekretari", SUPERADMIN: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-violet-300 bg-violet-500/15 border-violet-500/20",
  FINANCE: "text-emerald-300 bg-emerald-500/15 border-emerald-500/20",
  SECRETARY: "text-blue-300 bg-blue-500/15 border-blue-500/20",
  SUPERADMIN: "text-amber-300 bg-amber-500/15 border-amber-500/20",
};

const ROLE_ICONS: Record<string, string> = {
  ADMIN: "⚡", FINANCE: "💰", SECRETARY: "📋", SUPERADMIN: "👑",
};

const FEATURES = [
  { icon: "👥", label: "Menaxhimi i nxënësve", desc: "Regjistrim, profile, grupe" },
  { icon: "💰", label: "Financa & Pagesa", desc: "Arkëtim, raporte, fatura" },
  { icon: "📋", label: "Menaxhimi i klasave", desc: "Orare, programe mësimore" },
  { icon: "📊", label: "Raporte & Statistika", desc: "Dashboard, eksport Excel" },
  { icon: "🏢", label: "Multi-Institucion", desc: "Izolim të dhënash per org." },
  { icon: "👤", label: "Rolet e Stafit", desc: "Admin, Financë, Sekretar" },
  { icon: "🔒", label: "Siguri & Autentikim", desc: "NextAuth, sesione të sigurta" },
  { icon: "📱", label: "Ndërfaqe responsive", desc: "Funksionon në çdo pajisje" },
];

export default function OrgDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "SECRETARY" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [activeLoading, setActiveLoading] = useState(false);

  useEffect(() => { fetchOrg(); }, [orgId]);

  async function fetchOrg() {
    setLoading(true);
    const res = await fetch(`/api/organizations/${orgId}`);
    if (res.ok) setOrg(await res.json());
    setLoading(false);
  }

  async function addUser(e: { preventDefault: () => void }) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/organizations/${orgId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg("ok");
      setUserForm({ name: "", email: "", password: "", role: "SECRETARY" });
      setShowAddUser(false);
      fetchOrg();
    } else {
      setMsg("err:" + (data.error || "Gabim"));
    }
    setSaving(false);
  }

  async function setLicense(licensed: boolean) {
    setLicenseLoading(true);
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: licensed ? "licensed" : "demo" }),
    });
    if (res.ok) fetchOrg();
    setLicenseLoading(false);
  }

  async function toggleActive() {
    if (!org) return;
    setActiveLoading(true);
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !org.active }),
    });
    if (res.ok) fetchOrg();
    setActiveLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-gray-400">
        Institucioni nuk u gjet.
      </div>
    );
  }

  const isLicensed = org.plan === "licensed";
  const licenseDate = new Date(org.createdAt).toLocaleDateString("sq-AL", {
    year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Top bar */}
      <div className="border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/superadmin")}
              className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] flex items-center justify-center transition">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="font-semibold text-sm">{org.name}</p>
              <p className="text-gray-600 text-xs">Detajet e institucionit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLicensed && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                ✓ Licencuar
              </span>
            )}
            {!isLicensed && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Demo
              </span>
            )}
            {!org.active && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                Joaktiv
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-6">

          {/* LEFT COLUMN */}
          <div className="col-span-2 space-y-5">

            {/* Org info card */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${isLicensed ? "bg-gradient-to-br from-emerald-500/25 to-teal-600/20 border border-emerald-500/20" : "bg-white/[0.06] border border-white/[0.08]"}`}>
                  🏫
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-semibold">{org.name}</h1>
                  <p className="text-gray-500 text-sm mt-0.5">/{org.slug}</p>
                  <p className="text-gray-600 text-xs mt-1">Krijuar: {licenseDate}</p>
                </div>
              </div>
            </div>

            {/* License control */}
            <div className={`rounded-2xl p-6 border ${isLicensed ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-amber-500/[0.03] border-amber-500/12"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold mb-0.5">
                    {isLicensed ? "✓ Licence Aktive" : "Periudhë Demo"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isLicensed
                      ? "Institucioni ka licencë të plotë të sistemit."
                      : "Institucioni ka akses demo. Pas blerjes, aktivizo licencën."}
                  </p>
                </div>
                <button
                  onClick={() => setLicense(!isLicensed)}
                  disabled={licenseLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                    isLicensed
                      ? "bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-gray-300"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  }`}>
                  {licenseLoading ? "..." : isLicensed ? "Hiq Licencën" : "Aktivizo Licencën"}
                </button>
              </div>
            </div>

            {/* Activation toggle */}
            <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Statusi i Aksesit</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {org.active ? "Stafi mund të hyjë në sistem." : "Aksesi i stafit është bllokuar."}
                </p>
              </div>
              <button
                onClick={toggleActive}
                disabled={activeLoading}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                  org.active
                    ? "bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400"
                    : "bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400"
                }`}>
                {activeLoading ? "..." : org.active ? "Çaktivizo Aksesin" : "Aktivizo Aksesin"}
              </button>
            </div>

            {/* Users section */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold">Stafi ({org.users.length})</h2>
                  <p className="text-xs text-gray-600 mt-0.5">Përdoruesit me akses në këtë institucion</p>
                </div>
                <button onClick={() => setShowAddUser(!showAddUser)}
                  className="flex items-center gap-1.5 bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/25 text-violet-300 hover:text-violet-200 px-3.5 py-2 rounded-xl text-xs font-medium transition">
                  + Shto Staf
                </button>
              </div>

              {msg === "ok" && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  ✓ Përdoruesi u shtua me sukses.
                </div>
              )}
              {msg.startsWith("err:") && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                  {msg.replace("err:", "")}
                </div>
              )}

              {showAddUser && (
                <form onSubmit={addUser} className="mb-5 bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-600 uppercase tracking-wider mb-1">Emri</label>
                    <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm placeholder-gray-700 focus:outline-none focus:border-violet-500/40 transition"
                      placeholder="Emri Mbiemri"
                      value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 uppercase tracking-wider mb-1">Email</label>
                    <input type="email" className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm placeholder-gray-700 focus:outline-none focus:border-violet-500/40 transition"
                      placeholder="email@shkolla.al"
                      value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 uppercase tracking-wider mb-1">Fjalëkalimi</label>
                    <input type="password" className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm placeholder-gray-700 focus:outline-none focus:border-violet-500/40 transition"
                      placeholder="••••••••"
                      value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 uppercase tracking-wider mb-1">Roli</label>
                    <select className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/40 transition"
                      value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                      <option value="ADMIN">⚡ Admin</option>
                      <option value="FINANCE">💰 Financë</option>
                      <option value="SECRETARY">📋 Sekretari</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex gap-2 pt-1">
                    <button type="submit" disabled={saving}
                      className="bg-violet-600 hover:bg-violet-500 px-5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50">
                      {saving ? "Duke shtuar..." : "Shto"}
                    </button>
                    <button type="button" onClick={() => setShowAddUser(false)}
                      className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] px-5 py-2 rounded-xl text-sm font-medium transition">
                      Anulo
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-1.5">
                {org.users.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] rounded-xl px-4 py-3 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm">
                        {ROLE_ICONS[u.role] ?? u.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-gray-600">{u.email}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role] ?? "text-gray-400 bg-white/[0.05] border-white/[0.08]"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — what's included */}
          <div className="space-y-5">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-[11px] text-gray-600 uppercase tracking-widest font-medium mb-4">Çfarë Përfshin</p>
              <div className="space-y-3">
                {FEATURES.map(f => (
                  <div key={f.label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-base flex-shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{f.label}</p>
                      <p className="text-[11px] text-gray-600">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-500/[0.07] to-purple-600/[0.04] border border-violet-500/15 rounded-2xl p-5">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Modeli i Shitjes</p>
              <p className="text-sm font-semibold text-violet-300 mb-1">Blerje e Njëhershme</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Sistemi shitet si licencë e plotë — pa tarifa mujore, pa abonim. Klienti paguan një herë dhe e ka sistemin përgjithmonë.
              </p>
              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5">Përfshin</p>
                <ul className="space-y-1 text-xs text-gray-400">
                  <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Instalim i plotë</li>
                  <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Trajnim i stafit</li>
                  <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Migrim i të dhënave</li>
                  <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Support teknik</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
