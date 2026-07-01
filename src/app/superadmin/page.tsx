"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";

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
      setMsg("✅ Institucioni u krijua!");
      setForm({ name: "", slug: "", adminEmail: "", adminName: "", adminPassword: "", plan: "trial" });
      setShowForm(false);
      fetchOrgs();
    } else {
      setMsg("❌ " + data.error);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-xl">Duke ngarkuar...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Super Admin</h1>
            <p className="text-gray-400 mt-1">Menaxho të gjitha institucionet</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition"
          >
            + Institucion i Ri
          </button>
        </div>

        {msg && (
          <div className={`mb-6 p-4 rounded-lg ${msg.startsWith("✅") ? "bg-green-800" : "bg-red-800"}`}>
            {msg}
          </div>
        )}

        {showForm && (
          <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Krijo Institucion të Ri</h2>
            <form onSubmit={createOrg} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Emri i Institucionit</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Shkolla ABC"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Slug</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="shkolla-abc"
                  value={form.slug}
                  onChange={e => setForm({...form, slug: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email Admin</label>
                <input
                  type="email"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="admin@shkolla.al"
                  value={form.adminEmail}
                  onChange={e => setForm({...form, adminEmail: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Emri Admin</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Admin Shkolla"
                  value={form.adminName}
                  onChange={e => setForm({...form, adminName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Fjalëkalimi Admin</label>
                <input
                  type="password"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="••••••••"
                  value={form.adminPassword}
                  onChange={e => setForm({...form, adminPassword: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Paketa</label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  value={form.plan}
                  onChange={e => setForm({...form, plan: e.target.value})}
                >
                  <option value="trial">Trial (30 ditë)</option>
                  <option value="basic">Basic (49€/muaj)</option>
                  <option value="pro">Pro (89€/muaj)</option>
                </select>
              </div>
              <div className="col-span-2 flex gap-3 mt-2">
                <button type="submit" disabled={saving}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50">
                  {saving ? "Duke krijuar..." : "Krijo Institucionin"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg font-medium transition">
                  Anulo
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-300">{orgs.length} Institucione</h2>
          {orgs.map(org => (
            <Link key={org.id} href={`/superadmin/${org.id}`} className="block bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{org.name}</h3>
                  <p className="text-gray-400 text-sm">/{org.slug}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    org.plan === "pro" ? "bg-purple-900 text-purple-300" :
                    org.plan === "basic" ? "bg-blue-900 text-blue-300" :
                    "bg-yellow-900 text-yellow-300"}`}>
                    {org.plan.toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${org.active ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                    {org.active ? "Aktiv" : "Joaktiv"}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400 mb-2">Përdoruesit ({org.users.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {org.users.map(u => (
                    <div key={u.id} className="bg-gray-700 rounded-lg px-3 py-1 text-sm">
                      <span className="text-white">{u.name}</span>
                      <span className="text-gray-400 ml-1">({u.role})</span>
                      <span className="text-gray-500 ml-1">— {u.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
