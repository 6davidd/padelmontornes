"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentMember } from "@/lib/client-current-member";
import { getSupabaseClient } from "@/lib/client-supabase";
import {
  NOTIFICATION_PREFERENCE_DEFAULTS,
  NOTIFICATION_PREFERENCE_SELECT,
  normalizeNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferenceRow,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";

const CLUB_GREEN = "#0f5e2e";

type NotificationOption = {
  key: NotificationPreferenceKey;
  title: string;
  explanation: string;
};

const notificationOptions: NotificationOption[] = [
  {
    key: "booking_created_email",
    title: "Reserva confirmada",
    explanation:
      "Recibirás un correo cuando crees una reserva o te unas a una partida.",
  },
  {
    key: "added_to_match_email",
    title: "Me han añadido a una partida",
    explanation:
      "Recibirás un correo cuando un alguien te añada manualmente a una partida.",
  },
  {
    key: "match_reminder_email",
    title: "Recordatorio de partida",
    explanation:
      "Recibirás un correo recordatorio la noche antes de tus partidas.",
  },
  {
    key: "match_completed_email",
    title: "Partida completa",
    explanation:
      "Recibirás un aviso cuando una partida en la que participas se complete.",
  },
];

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ToggleSwitch({
  enabled,
  disabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex min-w-20 items-center justify-end gap-2 rounded-full px-1 py-1 outline-none transition focus-visible:ring-2 focus-visible:ring-green-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className="relative h-7 w-12 rounded-full border transition"
        style={
          enabled
            ? {
                backgroundColor: CLUB_GREEN,
                borderColor: CLUB_GREEN,
              }
            : undefined
        }
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </span>
      <span className="w-8 text-left text-xs font-bold text-gray-700">
        {enabled ? "ON" : "OFF"}
      </span>
    </button>
  );
}

export default function MiPerfilNotificacionesPage() {
  const [memberUserId, setMemberUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    NOTIFICATION_PREFERENCE_DEFAULTS
  );
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(
    null
  );
  const [expandedInfoKey, setExpandedInfoKey] =
    useState<NotificationPreferenceKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      setLoading(true);
      setMsg(null);

      const member = await getCurrentMember();

      if (!member) {
        setMsg("No se ha podido cargar tu perfil.");
        setMemberUserId(null);
        setLoading(false);
        return;
      }

      if (!member.is_active) {
        setMsg("Tu usuario está desactivado. Contacta con el club.");
        setMemberUserId(null);
        setLoading(false);
        return;
      }

      setMemberUserId(member.user_id);

      const supabase = await getSupabaseClient();
      const res = await supabase
        .from("notification_preferences")
        .select(NOTIFICATION_PREFERENCE_SELECT)
        .eq("member_user_id", member.user_id)
        .maybeSingle();

      if (res.error) {
        setMsg(res.error.message);
        setLoading(false);
        return;
      }

      setPreferences(
        normalizeNotificationPreferences(res.data as NotificationPreferenceRow | null)
      );
      setLoading(false);
    }

    void loadPreferences();
  }, []);

  async function handleToggle(key: NotificationPreferenceKey) {
    if (!memberUserId || savingKey) {
      return;
    }

    const previousPreferences = preferences;
    const nextPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    setPreferences(nextPreferences);
    setSavingKey(key);
    setMsg(null);
    setOk(null);

    const supabase = await getSupabaseClient();
    const res = await supabase
      .from("notification_preferences")
      .upsert(
        {
          member_user_id: memberUserId,
          ...nextPreferences,
        },
        { onConflict: "member_user_id" }
      )
      .select(NOTIFICATION_PREFERENCE_SELECT)
      .single();

    if (res.error) {
      setPreferences(previousPreferences);
      setMsg("No se ha podido guardar el cambio. Inténtalo de nuevo.");
      setSavingKey(null);
      return;
    }

    setPreferences(
      normalizeNotificationPreferences(res.data as NotificationPreferenceRow | null)
    );
    setOk("Preferencias actualizadas.");
    setSavingKey(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard
          title="Notificaciones"
          showBackButton={false}
          contentClassName="space-y-2"
          actions={
            <Link
              href="/mi-perfil"
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
            >
              Mi perfil
            </Link>
          }
        >
          <p className="text-sm leading-6 text-gray-600 sm:text-base">
            Activa o desactiva las notificaciones por correo electrónico.
          </p>
        </PageHeaderCard>

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

        {loading ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-5 text-gray-700 shadow-sm">
            Cargando...
          </div>
        ) : memberUserId ? (
          <section className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm">
            <div className="divide-y divide-gray-200">
              {notificationOptions.map((option) => {
                const enabled = preferences[option.key];
                const infoId = `notification-info-${option.key}`;
                const isInfoOpen = expandedInfoKey === option.key;

                return (
                  <div key={option.key} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-green-100 bg-green-50 text-green-900"
                        style={{ color: CLUB_GREEN }}
                      >
                        <MailIcon />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <h2 className="text-base font-bold text-gray-900">
                                {option.title}
                              </h2>
                              <button
                                type="button"
                                aria-label={`Ver información sobre ${option.title}`}
                                aria-controls={infoId}
                                aria-expanded={isInfoOpen}
                                onClick={() =>
                                  setExpandedInfoKey((current) =>
                                    current === option.key ? null : option.key
                                  )
                                }
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 outline-none transition hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-green-200"
                              >
                                <InfoIcon />
                              </button>
                            </div>

                            {isInfoOpen ? (
                              <p
                                id={infoId}
                                className="mt-2 text-sm leading-5 text-gray-600"
                              >
                                {option.explanation}
                              </p>
                            ) : null}
                          </div>

                          <ToggleSwitch
                            enabled={enabled}
                            disabled={savingKey !== null}
                            label={`${enabled ? "Desactivar" : "Activar"} ${
                              option.title
                            }`}
                            onToggle={() => handleToggle(option.key)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
