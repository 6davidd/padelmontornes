"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PASSWORD_RESET_SUCCESS_MESSAGE,
  requestPasswordReset,
} from "@/lib/request-password-reset";

const CLUB_GREEN = "#0f5e2e";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"error" | "success">("success");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);
    setLoading(true);

    const result = await requestPasswordReset(email);
    setLoading(false);

    if (!result.ok) {
      setMsgTone("error");
      setMsg(result.error);
      return;
    }

    setMsgTone("success");
    setMsg(PASSWORD_RESET_SUCCESS_MESSAGE);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Recuperar contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Introduce tu email y te enviaremos un enlace para cambiar tu
            contraseña.
          </p>

          {msg && (
            <div
              className={`mt-4 rounded-2xl border p-4 ${
                msgTone === "error"
                  ? "border-yellow-300 bg-yellow-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <p
                className={`text-sm ${
                  msgTone === "error" ? "text-yellow-900" : "text-green-900"
                }`}
              >
                {msg}
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-green-200"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-3.5 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="text-sm font-semibold hover:underline"
              style={{ color: CLUB_GREEN }}
            >
              Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
