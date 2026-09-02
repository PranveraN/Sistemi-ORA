"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

export default function TeacherRegisterPage() {
  const [teachers, setTeachers] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/teacher-auth/teachers-list")
      .then(r => r.json())
      .then(d => setTeachers(d.teachers || []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name) {
      setError("Zgjidh emrin tënd nga lista.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Fjalëkalimet nuk përputhen.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/teacher-auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Diçka shkoi keq.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      router.push("/login");
    } else {
      // Navigim i PLOTË (jo router.push) — garanton që middleware-i i ri-
      // ekzekutohet me sesionin e ri, kështu që roli TEACHER drejtohet
      // gjithmonë saktë te /kerkesa-material, pa rrezik të shfaqet
      // përkohësisht faqja e mëparshme (p.sh. Dashboard-i i administratës)
      // e ruajtur në cache të klientit.
      window.location.href = "/";
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Akademia Ora</h1>
          <p className="text-primary-200 mt-1 text-sm">Kërkesa për Material Didaktik</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-1">Regjistrohu</h2>
          <p className="text-sm text-slate-400 mb-6">Vetëm hera e parë — pastaj kyçesh me email dhe fjalëkalim.</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Emri</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="form-input pl-10"
                  required
                >
                  <option value="">— Zgjidh emrin tënd —</option>
                  {teachers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-input pl-10"
                  placeholder="emri@gmail.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Fjalëkalimi</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="form-input pl-10 pr-10"
                  placeholder="Të paktën 6 shkronja"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Konfirmo Fjalëkalimin</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="form-input pl-10"
                  placeholder="Përsërit fjalëkalimin"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-xl transition-colors duration-150 mt-2"
            >
              {loading ? "Duke u regjistruar..." : "Regjistrohu"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-500">
              Ke tashmë llogari? <Link href="/login" className="text-primary-600 font-medium hover:underline">Kyçu këtu</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
