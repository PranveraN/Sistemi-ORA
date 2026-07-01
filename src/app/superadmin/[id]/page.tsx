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
  ADMIN: "Admin",
  FINANCE: "Financë",
  SECRETARY: "Sekretari",
  SUPERADMIN: "Super Admin",
};

const PLAN_COLORS: Record<string, string> = {
  pro: "bg-purple-900 text-purple-300",
  basic: "bg-blue-900 text-blue-300",
  trial: "bg-yellow-900 text-yellow-300",
};

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
      setMsg("✅ Përdoruesi u shtua!");
      setUserForm({ name: "", email: "", password: "", role: "SECRETARY" });
      setShowAddUser(false);
      fetchOrg();
    } else {
      setMsg("❌ " + (data.error || "Gabim"));
    }
    setSaving(false);
  }

  async function togglePlan(plan: string) {
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.ok) fetchOrg();
  }

  async function toggleActive() {
    if (!org) return;
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !org.active }),
    });
    if (res.ok) fetchOrg();
  }

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-xl">Duke ngarkuar...</div>;
  if (!org) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-xl">Institucioni nuk u gjet.</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push("/superadmin")} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition">
          ← Kthehu te lista
        </button>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              <p className="text-gray-400 text-sm mt-1">/{org.slug}</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${PLAN_COLORS[org.plan] ?? "bg-gray-700 text-gray-300"}`}>
                {org.plan.toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${org.active ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                {org.active ? "Aktiv" : "Joaktiv"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-400 mr-2 self-center">Paketa:</span>
            {["trial", "basic", "pro"].map(p => (
              <button key={p} onClick={() => togglePlan(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${org.plan === p ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}`}>
                {p === "trial" ? "Trial" : p === "basic" ? "Basic (49€)" : "Pro (89€)"}
              </button>
            ))}
            <button onClick={toggleActive}
              className={`ml-auto px-4 py-1.5 rounded-lg text-sm font-medium transition ${org.active ? "bg-red-700 hover:bg-red-600" : "bg-green-700 hover:bg-green-600"}`}>
              {org.active ? "Çaktivizo" : "Aktivizo"}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Përdoruesit ({org.users.length})</h2>
            <button onClick={() => setShowAddUser(!showAddUser)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition">
              + Shto Përdorues
            </button>
          </div>

          {msg && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${msg.startsWith("✅") ? "bg-green-800" : "bg-red-800"}`}>{msg}</div>
          )}

          {showAddUser && (
            <form onSubmit={addUser} className="mb-6 grid grid-cols-2 gap-3 bg-gray-700 p-4 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Emri</label>
                <input className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-sm"
                  value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input type="email" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-sm"
                  value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fjalëkalimi</label>
                <input type="password" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-sm"
                  value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Roli</label>
                <select className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-sm"
                  value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                  <option value="ADMIN">Admin</option>
                  <option value="FINANCE">Financë</option>
                  <option value="SECRETARY">Sekretari</option>
                </select>
              </div>
              <div className="col-span-2 flex gap-2">
                <button type="submit" disabled={saving}
                  className="bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm font-medium transition disabled:opacity-50">
                  {saving ? "Duke shtuar..." : "Shto"}
                </button>
                <button type="button" onClick={() => setShowAddUser(false)}
                  className="bg-gray-500 hover:bg-gray-400 px-4 py-1.5 rounded text-sm font-medium transition">
                  Anulo
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {org.users.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium">{u.name}</span>
                  <span className="text-gray-400 text-sm ml-2">— {u.email}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  u.role === "ADMIN" ? "bg-blue-900 text-blue-300" :
                  u.role === "FINANCE" ? "bg-green-900 text-green-300" :
                  u.role === "SUPERADMIN" ? "bg-purple-900 text-purple-300" :
                  "bg-gray-600 text-gray-300"}`}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
