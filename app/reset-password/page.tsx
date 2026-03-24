"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

const CLUB_GREEN = "#0f5e2e";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 6) {
      setMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== password2) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white border border-gray-300 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
          <p className="mt-2 text-sm text-gray-600">
            Escribe tu nueva contraseña para poder entrar en la app.
          </p>

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Nueva contraseña</label>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Repetir contraseña</label>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
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
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}