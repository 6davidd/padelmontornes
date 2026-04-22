"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  getCurrentMember,
  setCachedCurrentMember,
} from "@/lib/client-current-member";
import { PageHeaderCard } from "../_components/PageHeaderCard";
import { ReservationActionButton } from "../_components/ReservationCard";
import { supabase } from "../../lib/supabase";

export default function MiPerfilPage() {
  const [fullName, setFullName] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const member = await getCurrentMember();

      if (!member) {
        setMsg("No se ha podido cargar tu perfil.");
        setCanEdit(false);
        setLoading(false);
        return;
      }

      if (!member.is_active) {
        setMsg("Tu usuario está desactivado. Contacta con el club.");
        setCanEdit(false);
        setLoading(false);
        return;
      }

      setFullName(member.full_name ?? "");
      setAlias(member.alias ?? "");
      setCanEdit(true);
      setLoading(false);
    }

    void loadProfile();
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
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard title="Mi perfil" contentClassName="space-y-2">
          <p className="text-sm leading-6 text-gray-600 sm:text-base">
            Elige el nombre con el que te ve el resto en la app.
          </p>
        </PageHeaderCard>

        {loading ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-5 text-gray-700 shadow-sm">
            Cargando...
          </div>
        ) : (
          <section className="rounded-3xl border border-gray-300 bg-white p-5 shadow-sm sm:p-6">
            {canEdit ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-gray-900">Alias visible</h2>
                  <p className="text-sm leading-5 text-gray-600">
                    Si lo dejas vacío, se mostrará tu nombre.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-900">
                      Nombre real
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      disabled
                      className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-500 shadow-sm outline-none"
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
                      placeholder="Escribe tu alias"
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition focus:border-green-200 focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                </div>

                {msg ? (
                  <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
                    <p className="text-sm text-yellow-900">{msg}</p>
                  </div>
                ) : null}

                {ok ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm text-green-900">{ok}</p>
                  </div>
                ) : null}

                <div className="pt-1">
                  <ReservationActionButton
                    type="submit"
                    tone="primary"
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? "Guardando..." : "Guardar alias"}
                  </ReservationActionButton>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-900">
                  {msg ?? "No se ha podido cargar tu perfil."}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
