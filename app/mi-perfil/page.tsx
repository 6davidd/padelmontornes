"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const CLUB_GREEN = "#0f5e2e";

type MemberRow = {
  full_name: string;
  alias: string | null;
  is_active: boolean;
};

export default function MiPerfilPage() {
  const [fullName, setFullName] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        setMsg("No se ha podido validar la sesiÃ³n.");
        setLoading(false);
        return;
      }

      const m = await supabase
        .from("members")
        .select("full_name, alias, is_active")
        .eq("user_id", user.id)
        .single();

      if (m.error || !m.data) {
        setMsg("No se ha podido cargar tu perfil.");
        setLoading(false);
        return;
      }

      const row = m.data as MemberRow;

      if (!row.is_active) {
        setMsg("Tu usuario está desactivado. Contacta con el club.");
        setLoading(false);
        return;
      }

      setFullName(row.full_name ?? "");
      setAlias(row.alias ?? "");
      setLoading(false);
    }

    loadProfile();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setOk(null);
    setSaving(true);

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      setSaving(false);
      setMsg("No se ha podido validar la sesiÃ³n.");
      return;
    }

    const cleanAlias = alias.trim();

    const update = await supabase
      .from("members")
      .update({
        alias: cleanAlias === "" ? null : cleanAlias,
      })
      .eq("user_id", user.id);

    if (update.error) {
      setMsg(update.error.message);
      setSaving(false);
      return;
    }

    setAlias(cleanAlias);
    setOk("Alias guardado correctamente.");
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 sm:p-8">
          <h1
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: CLUB_GREEN }}
          >
            Mi perfil
          </h1>

          <p className="mt-2 text-gray-600">
            Aquí puedes elegir el nombre con el que te verá el resto en la app.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 sm:p-8">
          {loading ? (
            <p className="text-gray-600">Cargando...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Nombre real
                </label>
                <input
                  type="text"
                  value={fullName}
                  disabled
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500 outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="alias"
                  className="block text-sm font-semibold text-gray-900 mb-2"
                >
                  Alias
                </label>

                <input
                  id="alias"
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  maxLength={30}
                  placeholder="Escribe tu alias…"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-300 focus:ring-2 focus:ring-black/5"
                />

                <p className="mt-2 text-sm text-gray-500">
                  Si lo dejas vacío, se mostrará tu nombre.
                </p>
              </div>

              {msg && (
                <div className="rounded-2xl p-4 bg-yellow-50 ring-1 ring-yellow-200">
                  <p className="text-sm text-yellow-900">{msg}</p>
                </div>
              )}

              {ok && (
                <div className="rounded-2xl p-4 bg-green-50 ring-1 ring-green-200">
                  <p className="text-sm text-green-900">{ok}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70"
                  style={{ backgroundColor: CLUB_GREEN }}
                >
                  {saving ? "Guardando..." : "Guardar alias"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
