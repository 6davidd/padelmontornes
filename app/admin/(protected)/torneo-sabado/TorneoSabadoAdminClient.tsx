"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LoadingButton } from "@/app/_components/LoadingButton";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";
import { copyTextToClipboard } from "@/lib/client-clipboard";
import { getClientSession } from "@/lib/client-session";
import {
  createEmptyTournamentState,
  getNextSaturdayISODate,
  normalizeTournamentEvent,
  syncBracketEntrantsFromStandings,
  TOURNAMENT_DEFAULT_NAME,
  TORNEO_SABADO_SLUG,
  updateTournamentMatch,
  updateTournamentMatchWinner,
  type TournamentBracket,
  type TournamentBracketKey,
  type TournamentEvent,
  type TournamentEventRow,
  type TournamentGroup,
  type TournamentGroupId,
  type TournamentMatch,
  type TournamentPlace,
  type TournamentState,
} from "@/lib/tournament-sabado";

type AdminTab = "groups" | "main" | "consolation";

type AdminApiResponse = {
  ok?: boolean;
  error?: string;
  created?: boolean;
  tournament?: TournamentEventRow | null;
};

const CLUB_GREEN = "#0f5e2e";

const FIELD_CLASS =
  "app-form-control rounded-2xl border border-gray-300 bg-white px-3.5 py-3 text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-green-200";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function playerLabel(player: { name: string }, fallback: string) {
  return player.name.trim() || fallback;
}

function ButtonIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center text-base leading-none">
      {children}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "ok" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border px-3.5 py-3 text-sm font-medium",
        tone === "ok"
          ? "border-green-200 bg-green-50 text-green-900"
          : "border-yellow-300 bg-yellow-50 text-yellow-900"
      )}
    >
      {children}
    </div>
  );
}

function QRCard({
  publicUrl,
  onError,
  onOk,
}: {
  publicUrl: string;
  onError: (message: string) => void;
  onOk: (message: string) => void;
}) {
  const qrRef = useRef<SVGSVGElement | null>(null);

  async function copyLink() {
    const copied = await copyTextToClipboard(publicUrl);
    if (copied) {
      onOk("Enlace copiado.");
    } else {
      onError("No se ha podido copiar el enlace.");
    }
  }

  function openPublicPage() {
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }

  function downloadQr() {
    const svg = qrRef.current;

    if (!svg) {
      onError("No se ha podido preparar el QR.");
      return;
    }

    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "torneo-sabado-qr.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-3xl border border-gray-300 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex justify-center rounded-2xl border border-gray-200 bg-white p-3">
          <QRCodeSVG
            ref={qrRef}
            value={publicUrl}
            size={168}
            level="M"
            marginSize={2}
            title="QR torneo sábado"
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <div className="text-lg font-bold text-gray-900">QR público</div>
            <div className="mt-1 break-all text-sm font-medium text-gray-600">
              {publicUrl}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
            >
              <ButtonIcon>⧉</ButtonIcon>
              Copiar enlace
            </button>
            <button
              type="button"
              onClick={openPublicPage}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
            >
              <ButtonIcon>↗</ButtonIcon>
              Abrir pública
            </button>
            <button
              type="button"
              onClick={downloadQr}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
            >
              <ButtonIcon>↓</ButtonIcon>
              Descargar QR
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function GroupEditor({
  group,
  onPlayerChange,
  onStandingChange,
}: {
  group: TournamentGroup;
  onPlayerChange: (
    groupId: TournamentGroupId,
    playerId: string,
    value: string
  ) => void;
  onStandingChange: (
    groupId: TournamentGroupId,
    place: TournamentPlace,
    playerId: string
  ) => void;
}) {
  const standingRows: Array<{ place: TournamentPlace; label: string }> = [
    { place: "first", label: "1º" },
    { place: "second", label: "2º" },
    { place: "third", label: "3º" },
  ];

  return (
    <section className="rounded-3xl border border-gray-300 bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900">{group.name}</h2>

      <div className="mt-4 space-y-3">
        {group.players.map((player, index) => (
          <label key={player.id} className="block space-y-1.5">
            <span className="text-sm font-semibold text-gray-700">
              Jugador {index + 1}
            </span>
            <input
              value={player.name}
              onChange={(event) =>
                onPlayerChange(group.id, player.id, event.target.value)
              }
              placeholder={`Jugador ${index + 1}`}
              className={FIELD_CLASS}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {standingRows.map((standing) => (
          <label key={standing.place} className="block space-y-1.5">
            <span className="text-sm font-semibold text-gray-700">
              {standing.label} clasificado
            </span>
            <select
              value={group.standings[standing.place]}
              onChange={(event) =>
                onStandingChange(group.id, standing.place, event.target.value)
              }
              className={FIELD_CLASS}
            >
              <option value="">Sin marcar</option>
              {group.players.map((player, index) => (
                <option key={player.id} value={player.id}>
                  {playerLabel(player, `Jugador ${index + 1}`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}

function GroupsPanel({
  state,
  setTournamentState,
  onSynced,
}: {
  state: TournamentState;
  setTournamentState: React.Dispatch<React.SetStateAction<TournamentState>>;
  onSynced: () => void;
}) {
  function updateGroupPlayer(
    groupId: TournamentGroupId,
    playerId: string,
    value: string
  ) {
    setTournamentState((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              players: group.players.map((player) =>
                player.id === playerId ? { ...player, name: value } : player
              ),
            }
          : group
      ),
    }));
  }

  function updateGroupStanding(
    groupId: TournamentGroupId,
    place: TournamentPlace,
    playerId: string
  ) {
    setTournamentState((current) => ({
      ...current,
      groups: current.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        const standings = {
          ...group.standings,
          [place]: playerId,
        };

        if (playerId) {
          for (const key of ["first", "second", "third"] as TournamentPlace[]) {
            if (key !== place && standings[key] === playerId) {
              standings[key] = "";
            }
          }
        }

        return { ...group, standings };
      }),
    }));
  }

  function syncEntrants() {
    setTournamentState((current) => syncBracketEntrantsFromStandings(current));
    onSynced();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={syncEntrants}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.99]"
          style={{ backgroundColor: CLUB_GREEN }}
        >
          Pasar clasificados a cuadros
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {state.groups.map((group) => (
          <GroupEditor
            key={group.id}
            group={group}
            onPlayerChange={updateGroupPlayer}
            onStandingChange={updateGroupStanding}
          />
        ))}
      </div>
    </div>
  );
}

function MatchEditor({
  match,
  bracketKey,
  setTournamentState,
}: {
  match: TournamentMatch;
  bracketKey: TournamentBracketKey;
  setTournamentState: React.Dispatch<React.SetStateAction<TournamentState>>;
}) {
  function updateMatch(
    updates: Partial<Pick<TournamentMatch, "player1" | "player2" | "score">>
  ) {
    setTournamentState((current) =>
      updateTournamentMatch(current, bracketKey, match.id, updates)
    );
  }

  function updateWinner(value: string) {
    setTournamentState((current) =>
      updateTournamentMatchWinner(current, bracketKey, match.id, value)
    );
  }

  return (
    <div className="rounded-3xl border border-gray-300 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-gray-900">{match.label}</h3>
        {match.winner.trim() ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
            Ganador marcado
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-gray-700">Jugador 1</span>
          <input
            value={match.player1}
            onChange={(event) => updateMatch({ player1: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-gray-700">Jugador 2</span>
          <input
            value={match.player2}
            onChange={(event) => updateMatch({ player2: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.3fr]">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-gray-700">Resultado</span>
          <input
            value={match.score}
            onChange={(event) => updateMatch({ score: event.target.value })}
            placeholder="6-4 / 7-5"
            className={FIELD_CLASS}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-gray-700">Ganador</span>
          <input
            value={match.winner}
            onChange={(event) => updateWinner(event.target.value)}
            placeholder="Nombre ganador"
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[match.player1, match.player2]
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => updateWinner(value)}
              className="rounded-full border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 active:scale-[0.99]"
            >
              Gana {value}
            </button>
          ))}
      </div>
    </div>
  );
}

function BracketEditor({
  bracket,
  bracketKey,
  setTournamentState,
}: {
  bracket: TournamentBracket;
  bracketKey: TournamentBracketKey;
  setTournamentState: React.Dispatch<React.SetStateAction<TournamentState>>;
}) {
  function updateChampion(value: string) {
    setTournamentState((current) => ({
      ...current,
      [bracketKey]: {
        ...current[bracketKey],
        champion: value,
      },
    }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {bracket.rounds.map((round) => (
          <section key={round.id} className="min-w-0 space-y-3">
            <h2 className="text-xl font-bold text-gray-900">{round.title}</h2>
            {round.matches.map((match) => (
              <MatchEditor
                key={match.id}
                match={match}
                bracketKey={bracketKey}
                setTournamentState={setTournamentState}
              />
            ))}
          </section>
        ))}
      </div>

      <label className="block rounded-3xl border border-gray-300 bg-white p-4 shadow-sm">
        <span className="text-sm font-semibold text-gray-700">
          Campeón del cuadro
        </span>
        <input
          value={bracket.champion}
          onChange={(event) => updateChampion(event.target.value)}
          placeholder="Campeón"
          className={classNames(FIELD_CLASS, "mt-2")}
        />
      </label>
    </div>
  );
}

export default function TorneoSabadoAdminClient() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentEvent | null>(null);
  const [name, setName] = useState(TOURNAMENT_DEFAULT_NAME);
  const [date, setDate] = useState(getNextSaturdayISODate());
  const [publicEnabled, setPublicEnabled] = useState(true);
  const [state, setState] = useState<TournamentState>(() =>
    createEmptyTournamentState()
  );
  const [activeTab, setActiveTab] = useState<AdminTab>("groups");
  const [publicUrl, setPublicUrl] = useState("/torneo-sabado");
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const apiUrl = `/api/admin/tournaments/${TORNEO_SABADO_SLUG}`;

  const activeBracket = useMemo(() => {
    return activeTab === "main" ? state.mainBracket : state.consolationBracket;
  }, [activeTab, state.consolationBracket, state.mainBracket]);

  function applyTournament(nextTournament: TournamentEvent | null) {
    setTournament(nextTournament);

    if (!nextTournament) {
      setName(TOURNAMENT_DEFAULT_NAME);
      setDate(getNextSaturdayISODate());
      setPublicEnabled(true);
      setState(createEmptyTournamentState());
      return;
    }

    setName(nextTournament.name);
    setDate(nextTournament.date ?? "");
    setPublicEnabled(nextTournament.public_enabled);
    setState(nextTournament.state);
  }

  const loadTournament = useCallback(async () => {
    setMsg(null);
    setOk(null);
    setLoading(true);

    try {
      const session = await getClientSession();
      const token = session?.access_token ?? null;
      setAccessToken(token);

      if (!token) {
        setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
        return;
      }

      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as AdminApiResponse | null;

      if (!res.ok || !data?.ok) {
        setMsg(String(data?.error ?? "No se ha podido cargar el torneo."));
        return;
      }

      applyTournament(
        data.tournament ? normalizeTournamentEvent(data.tournament) : null
      );
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "No se ha podido cargar.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/torneo-sabado`);
    void loadTournament();
  }, [loadTournament]);

  async function initializeTournament() {
    setMsg(null);
    setOk(null);

    if (!accessToken) {
      setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
      return;
    }

    setInitializing(true);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: TOURNAMENT_DEFAULT_NAME,
          date: getNextSaturdayISODate(),
        }),
      });
      const data = (await res.json().catch(() => null)) as AdminApiResponse | null;

      if (!res.ok || !data?.ok || !data.tournament) {
        setMsg(String(data?.error ?? "No se ha podido inicializar el torneo."));
        return;
      }

      applyTournament(normalizeTournamentEvent(data.tournament));
      setOk(data.created ? "Torneo inicializado." : "El torneo ya existía.");
    } finally {
      setInitializing(false);
    }
  }

  async function saveTournament() {
    setMsg(null);
    setOk(null);

    if (!accessToken) {
      setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name,
          date: date || null,
          publicEnabled,
          state,
        }),
      });
      const data = (await res.json().catch(() => null)) as AdminApiResponse | null;

      if (!res.ok || !data?.ok || !data.tournament) {
        setMsg(String(data?.error ?? "No se han podido guardar los cambios."));
        return;
      }

      applyTournament(normalizeTournamentEvent(data.tournament));
      setOk("Cambios guardados.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-8">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="rounded-3xl border border-gray-300 bg-white p-5 text-gray-700 shadow-sm">
            Cargando...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard
          title="Torneo sábado"
          actions={
            tournament ? (
              <LoadingButton
                loading={saving}
                onClick={saveTournament}
                className="rounded-full px-5 py-3 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                Guardar cambios
              </LoadingButton>
            ) : null
          }
          contentClassName="space-y-4"
        >
          {msg ? <Notice tone="warning">{msg}</Notice> : null}
          {ok ? <Notice tone="ok">{ok}</Notice> : null}

          {!tournament ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <LoadingButton
                loading={initializing}
                onClick={initializeTournament}
                className="rounded-full px-5 py-3 font-semibold text-white shadow-sm transition active:scale-[0.99]"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                Inicializar torneo
              </LoadingButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_auto_auto] lg:items-end">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  Nombre
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  Fecha
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={classNames(FIELD_CLASS, "app-date-input")}
                />
              </label>

              <label className="flex min-h-[3.25rem] items-center gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm">
                <input
                  type="checkbox"
                  checked={publicEnabled}
                  onChange={(event) => setPublicEnabled(event.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 accent-green-700"
                />
                <span className="text-sm font-semibold text-gray-900">
                  Pública
                </span>
              </label>
            </div>
          )}
        </PageHeaderCard>

        {tournament ? (
          <>
            <QRCard publicUrl={publicUrl} onError={setMsg} onOk={setOk} />

            <div className="flex overflow-x-auto rounded-full border border-gray-300 bg-white p-1 shadow-sm">
              {[
                ["groups", "Grupos"],
                ["main", "Cuadro principal"],
                ["consolation", "Consolación"],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab as AdminTab)}
                  className={classNames(
                    "min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-bold transition",
                    activeTab === tab
                      ? "text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                  style={
                    activeTab === tab ? { backgroundColor: CLUB_GREEN } : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "groups" ? (
              <GroupsPanel
                state={state}
                setTournamentState={setState}
                onSynced={() => {
                  setOk("Clasificados aplicados a los cuadros. Guarda cambios.");
                  setMsg(null);
                }}
              />
            ) : (
              <BracketEditor
                bracket={activeBracket}
                bracketKey={
                  activeTab === "main" ? "mainBracket" : "consolationBracket"
                }
                setTournamentState={setState}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
