"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

const CLUB_GREEN = "#0f5e2e";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Te hemos enviado un correo para cambiar tu contraseña.");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white border border-gray-300 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="mt-2 text-sm text-gray-600">
            Introduce tu email y te enviaremos un enlace para crear o cambiar tu contraseña.
          </p>

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-3.5 font-semibold text-white shadow-sm active:scale-[0.99] transition disabled:opacity-60"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              {loading ? "Enviando…" : "Enviar enlace"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <a
              href="/login"
              className="text-sm font-semibold hover:underline"
              style={{ color: CLUB_GREEN }}
            >
              Volver al login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}