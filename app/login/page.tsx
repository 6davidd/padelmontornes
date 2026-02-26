"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

const CLUB_GREEN = "#0f5e2e";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsg("Email o contraseña incorrectos.");
      return;
    }

    router.push("/app");
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="bg-white border border-gray-300 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* OJO: aquí NO ponemos logo ni “Acceso” para no duplicar el header global */}

          {msg && (
            <div className="mb-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-2xl border border-gray-300 bg-blue-50/50 px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-gray-300 bg-blue-50/50 px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-3.5 font-semibold text-white shadow-sm active:scale-[0.99] transition disabled:opacity-60"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}