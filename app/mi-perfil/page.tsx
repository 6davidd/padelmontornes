"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  getCurrentMember,
  setCachedCurrentMember,
} from "@/lib/client-current-member";
import { supabase } from "../../lib/supabase";

const CLUB_GREEN = "#0f5e2e";

export default function MiPerfilPage() {
  const [fullName, setFullName] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const member = await getCurrentMember();

      if (!member) {
        setMsg("No se ha podido cargar tu perfil.");
        setLoading(false);
        return;
      }

      if (!member.is_active) {
        setMsg("Tu usuario está desactivado. Contacta con el club.");
        setLoading(false);
        return;
      }

      setFullName(member.full_name ?? "");
      setAlias(member.alias ?? "");
      setLoading(false);
    }

    loadProfile();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setOk(null);
    setSaving(true);

    const member = await getCurrentMember();

    if (!member) {
      setSaving(false);
      setMsg("No se ha podido validar la sesión.");
      return;
    }

    const cleanAlias = alias.trim();

    const update = await supabase
      .from("members")
      .update({
        alias: cleanAlias === "" ? null : cleanAlias,
      })
      .eq("user_id", member.user_id);

    if (update.error) {
      setMsg(update.error.message);
      setSaving(false);
      return;
    }

    setCachedCurrentMember({
      ...member,
      alias: cleanAlias === "" ? null : cleanAlias,
    });

    setAlias(cleanAlias);
    setOk("Alias guardado correctamente.");
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <h1
            className="text-3xl font-bold sm:text-4xl"
            style={{ color: CLUB_GREEN }}
          >
            Mi perfil
          </h1>

          <p className="mt-2 text-gray-600">
            Aquí puedes elegir el nombre con el que te verá el resto en la app.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          {loading ? (
            <p className="text-gray-600">Cargando...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
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
                  className="mb-2 block text-sm font-semibold text-gray-900"
                >
                  Alias
                </label>

                <input
                  id="alias"
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  maxLength={30}
                  placeholder="Escribe tu alias..."
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-300 focus:ring-2 focus:ring-black/5"
                />

                <p className="mt-2 text-sm text-gray-500">
                  Si lo dejas vacío, se mostrará tu nombre.
                </p>
              </div>

              {msg && (
                <div className="rounded-2xl bg-yellow-50 p-4 ring-1 ring-yellow-200">
                  <p className="text-sm text-yellow-900">{msg}</p>
                </div>
              )}

              {ok && (
                <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
                  <p className="text-sm text-green-900">{ok}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-70"
                  style={{ backgroundColor: CLUB_GREEN }}
                >
                  {saving ? "Guardando..." : "Guardar alias"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

    </div>
  );
}
