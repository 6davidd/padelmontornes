"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isOwnerRole, type MemberRole } from "@/lib/auth-shared";
import { getCurrentMember } from "@/lib/client-current-member";
import { getClientSession } from "@/lib/client-session";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";
import { CLUB_NAME, CLUB_PUBLIC_URL } from "@/lib/brand";
import { getDisplayName, getNameWithFirstSurname } from "@/lib/display-name";
import { supabase } from "@/lib/supabase";

const CLUB_GREEN = "#0f5e2e";

type MemberRow = {
  user_id: string;
  full_name: string;
  alias: string | null;
  email: string | null;
  is_active: boolean;
  role: MemberRole;
};

type CreateMemberResponse = {
  ok?: boolean;
  error?: string;
  userId?: string;
};

type UpdateMemberResponse = {
  ok?: boolean;
  error?: string;
  member?: MemberRow;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        active
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function RoleBadge({ role }: { role: MemberRole }) {
  const stylesByRole: Record<MemberRole, string> = {
    owner: "border-amber-200 bg-amber-50 text-amber-800",
    superadmin: "border-emerald-200 bg-emerald-50 text-emerald-800",
    admin: "border-gray-300 bg-gray-100 text-gray-900",
    member: "border-gray-200 bg-white text-gray-700",
  };

  const labelByRole: Record<MemberRole, string> = {
    owner: "Owner",
    superadmin: "Superadmin",
    admin: "Admin",
    member: "Socio",
  };

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        stylesByRole[role]
      )}
    >
      {labelByRole[role]}
    </span>
  );
}

function buildWhatsappMessage(params: {
  fullName: string;
  email: string;
}) {
  const { email } = params;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    CLUB_PUBLIC_URL;

  return `Hola

Ya te he dado de alta en la APP del club ${CLUB_NAME}.

Puedes entrar aquí:
${appUrl}

Tu email es:
${email}

Te habrá llegado un correo para crear tu contraseña y entrar en la app.

Si no lo ves, mira también en spam.

¡Nos vemos en pista!`;
}

function getRoleOrder(role: MemberRole) {
  if (role === "owner") return 0;
  if (role === "superadmin") return 1;
  if (role === "admin") return 2;
  return 3;
}

export default function AdminSociosPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [canImportMembers, setCanImportMembers] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [creatingMember, setCreatingMember] = useState(false);

  const [lastWhatsappMessage, setLastWhatsappMessage] = useState<string | null>(
    null
  );
  const [lastCreatedName, setLastCreatedName] = useState<string | null>(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  useEffect(() => {
    async function init() {
      const [member] = await Promise.all([getCurrentMember(), loadMembers()]);
      setCanImportMembers(isOwnerRole(member?.role));
    }

    init();
  }, []);

  async function loadMembers() {
    setMsg(null);
    setLoading(true);

    const res = await supabase
      .from("members")
      .select("user_id,full_name,alias,email,is_active,role")
      .order("is_active", { ascending: false })
      .order("full_name", { ascending: true });

    if (res.error) {
      setMsg(res.error.message);
      setLoading(false);
      return;
    }

    setMembers((res.data ?? []) as MemberRow[]);
    setLoading(false);
  }

  const filteredMembers = useMemo(() => {
    const base = [...members].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

      const roleCompare = getRoleOrder(a.role) - getRoleOrder(b.role);
      if (roleCompare !== 0) return roleCompare;

      const an = getDisplayName(a).toLocaleLowerCase("es-ES");
      const bn = getDisplayName(b).toLocaleLowerCase("es-ES");
      return an.localeCompare(bn, "es-ES");
    });

    const term = search.trim().toLocaleLowerCase("es-ES");
    if (!term) return base;

    return base.filter((member) => {
      const displayName = getDisplayName(member).toLocaleLowerCase("es-ES");
      const fullName = (member.full_name ?? "").toLocaleLowerCase("es-ES");
      const alias = (member.alias ?? "").toLocaleLowerCase("es-ES");
      const email = (member.email ?? "").toLocaleLowerCase("es-ES");

      return (
        displayName.includes(term) ||
        fullName.includes(term) ||
        alias.includes(term) ||
        email.includes(term)
      );
    });
  }, [members, search]);

  function startEditAlias(member: MemberRow) {
    setMsg(null);
    setOk(null);
    setEditingId(member.user_id);
    setEditingAlias(member.alias ?? "");
  }

  function cancelEditAlias() {
    setEditingId(null);
    setEditingAlias("");
  }

  async function updateMember(
    memberUserId: string,
    payload: { alias?: string | null; isActive?: boolean }
  ) {
    const session = await getClientSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("No hay sesión válida. Vuelve a iniciar sesión.");
    }

    const res = await fetch(
      `/api/admin/members/${encodeURIComponent(memberUserId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = (await res
      .json()
      .catch(() => null)) as UpdateMemberResponse | null;

    if (!res.ok || !data?.ok || !data.member) {
      throw new Error(data?.error ?? "No se ha podido guardar el socio.");
    }

    return data.member;
  }

  function replaceMember(updatedMember: MemberRow) {
    setMembers((prev) =>
      prev.map((member) =>
        member.user_id === updatedMember.user_id ? updatedMember : member
      )
    );
  }

  async function saveAlias(member: MemberRow) {
    setMsg(null);
    setOk(null);
    setSavingId(member.user_id);

    const cleanAlias = editingAlias.trim();

    try {
      const updatedMember = await updateMember(member.user_id, {
        alias: cleanAlias === "" ? null : cleanAlias,
      });

      replaceMember(updatedMember);
      setEditingId(null);
      setEditingAlias("");
      setOk("Alias guardado correctamente.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(member: MemberRow) {
    setMsg(null);
    setOk(null);
    setSavingId(member.user_id);

    const nextIsActive = !member.is_active;

    try {
      const updatedMember = await updateMember(member.user_id, {
        isActive: nextIsActive,
      });

      replaceMember(updatedMember);
      setOk(
        nextIsActive
          ? "Socio activado correctamente."
          : "Socio desactivado correctamente."
      );
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSavingId(null);
    }
  }

  function toggleCreateForm() {
    setMsg(null);
    setOk(null);
    setCreating((prev) => !prev);

    if (creating) {
      setNewFullName("");
      setNewEmail("");
      setNewAlias("");
      setNewRole("member");
    }
  }

  async function createMember() {
    setMsg(null);
    setOk(null);
    setCreatingMember(true);

    try {
      const fullName = newFullName.trim();
      const email = newEmail.trim().toLowerCase();
      const alias = newAlias.trim();

      if (!fullName) {
        setMsg("El nombre es obligatorio.");
        return;
      }

      if (!email) {
        setMsg("El email es obligatorio.");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setMsg("El email no es válido.");
        return;
      }

      const session = await getClientSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
        return;
      }

      const res = await fetch("/api/admin/create-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName,
          email,
          alias,
          role: newRole,
        }),
      });

      const rawText = await res.text();

      let data: CreateMemberResponse | null = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        setMsg(rawText || "La respuesta del servidor no es válida.");
        return;
      }

      if (!res.ok || !data?.ok) {
        setMsg(data?.error || "No se ha podido crear el socio.");
        return;
      }

      const whatsappMessage = buildWhatsappMessage({
        fullName,
        email,
      });

      setLastWhatsappMessage(whatsappMessage);
      setLastCreatedName(getNameWithFirstSurname(fullName) || fullName);
      setCopiedWhatsapp(false);

      setNewFullName("");
      setNewEmail("");
      setNewAlias("");
      setNewRole("member");
      setCreating(false);
      setOk(
        "Socio creado correctamente. Se ha enviado el email de invitación."
      );
      await loadMembers();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setCreatingMember(false);
    }
  }

  async function copyWhatsappMessage() {
    if (!lastWhatsappMessage) return;

    try {
      await navigator.clipboard.writeText(lastWhatsappMessage);
      setCopiedWhatsapp(true);
    } catch {
      setMsg("No se ha podido copiar el mensaje.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <PageHeaderCard
          title="Socios"
          contentClassName="space-y-5"
          actions={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              {canImportMembers && (
                <Link
                  href="/admin/importar-socios"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-3 text-center font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 sm:w-auto"
                >
                  Importar socios
                </Link>
              )}

              <button
                onClick={toggleCreateForm}
                className="w-full rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition active:scale-[0.99] sm:w-auto"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                {creating ? "Cerrar" : "Añadir socio"}
              </button>
            </div>
          }
        >

          {creating && (
            <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-5 space-y-4">
              <div className="text-lg font-bold text-gray-900">Nuevo socio</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nombre real
                  </label>
                  <input
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Nombre y apellidos"
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Alias
                  </label>
                  <input
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    maxLength={30}
                    placeholder="Opcional"
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Rol
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(e.target.value === "admin" ? "admin" : "member")
                    }
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                  >
                    <option value="member">Socio</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Se enviará un email al socio para crear su contraseña y entrar en la APP del club.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={createMember}
                  disabled={creatingMember}
                  className="rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70"
                  style={{ backgroundColor: CLUB_GREEN }}
                >
                  {creatingMember ? "Creando..." : "Crear socio"}
                </button>

                <button
                  onClick={toggleCreateForm}
                  disabled={creatingMember}
                  className="rounded-2xl px-5 py-3 bg-white text-gray-900 font-semibold ring-1 ring-black/5 hover:bg-gray-50 transition active:scale-[0.99] disabled:opacity-70"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="mt-5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, alias o email…"
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
            />
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl p-4 bg-yellow-50 ring-1 ring-yellow-200">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {ok && (
            <div className="mt-4 rounded-2xl p-4 bg-green-50 ring-1 ring-green-200">
              <p className="text-sm text-green-900">{ok}</p>
            </div>
          )}

          {lastWhatsappMessage && (
            <div className="mt-4 rounded-3xl border border-green-200 bg-green-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold text-green-900">
                    Mensaje de WhatsApp listo
                  </div>

                  <p className="mt-2 text-sm text-green-800">
                    {lastCreatedName
                      ? `Puedes enviárselo ahora a ${lastCreatedName}.`
                      : "Puedes enviárselo ahora al nuevo socio."}
                  </p>
                </div>

                <button
                  onClick={copyWhatsappMessage}
                  className="rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition active:scale-[0.99]"
                  style={{ backgroundColor: CLUB_GREEN }}
                >
                  {copiedWhatsapp ? "Mensaje copiado" : "Copiar mensaje WhatsApp"}
                </button>
              </div>

              <pre className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-green-200 bg-white p-4 text-sm text-gray-800">
                {lastWhatsappMessage}
              </pre>
            </div>
          )}
        </PageHeaderCard>

        {loading ? (
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-5 text-gray-700">
            Cargando socios...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 text-center text-gray-700">
            No hay socios para mostrar.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMembers.map((member) => {
              const cleanAlias = member.alias?.trim() || "";
              const hasAlias = cleanAlias.length > 0;
              const titleName = getDisplayName(member);
              const isSaving = savingId === member.user_id;
              const isEditing = editingId === member.user_id;

              return (
                <div
                  key={member.user_id}
                  className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-bold text-gray-900">
                          {titleName}
                        </div>
                        <StatusBadge active={member.is_active} />
                        <RoleBadge role={member.role} />
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        {hasAlias && (
                          <div>
                            <span className="font-semibold text-gray-800">
                              Nombre real:
                            </span>{" "}
                            {member.full_name || "—"}
                          </div>
                        )}

                        <div className="break-all">
                          <span className="font-semibold text-gray-800">
                            Email:
                          </span>{" "}
                          {member.email || "—"}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="text-sm font-semibold text-gray-900 mb-2">
                            Editar alias
                          </div>

                          <input
                            value={editingAlias}
                            onChange={(e) => setEditingAlias(e.target.value)}
                            maxLength={30}
                            placeholder="Escribe el alias…"
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                          />

                          <p className="mt-2 text-sm text-gray-500">
                            Si lo dejas vacío, este socio mostrará su nombre.
                          </p>

                          <div className="mt-4 flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => saveAlias(member)}
                              disabled={isSaving}
                              className="rounded-2xl px-4 py-2.5 text-white font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70"
                              style={{ backgroundColor: CLUB_GREEN }}
                            >
                              {isSaving ? "Guardando..." : "Guardar alias"}
                            </button>

                            <button
                              onClick={cancelEditAlias}
                              disabled={isSaving}
                              className="rounded-2xl px-4 py-2.5 border border-gray-300 bg-white font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition active:scale-[0.99] disabled:opacity-70"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="sm:shrink-0 flex flex-col gap-3">
                      {!isEditing && (
                        <button
                          onClick={() => startEditAlias(member)}
                          className="w-full sm:w-auto rounded-2xl px-4 py-2.5 border border-gray-300 bg-white font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition active:scale-[0.99]"
                        >
                          Editar alias
                        </button>
                      )}

                      <button
                        onClick={() => toggleActive(member)}
                        disabled={isSaving}
                        className={classNames(
                          "w-full sm:w-auto rounded-2xl px-4 py-2.5 font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70",
                          member.is_active
                            ? "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                            : "border border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
                        )}
                      >
                        {isSaving
                          ? "Guardando..."
                          : member.is_active
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}


