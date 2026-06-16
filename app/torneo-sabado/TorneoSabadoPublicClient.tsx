"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { copyTextToClipboard } from "@/lib/client-clipboard";
import {
  formatTournamentDate,
  normalizeTournamentEvent,
  TOURNAMENT_AUTO_REFRESH_MS,
  TORNEO_SABADO_SLUG,
  type TournamentBracket,
  type TournamentEvent,
  type TournamentEventRow,
  type TournamentGroup,
  type TournamentMatch,
} from "@/lib/tournament-sabado";

type PublicTab = "main" | "consolation";

type PublicApiResponse = {
  ok?: boolean;
  error?: string;
  tournament?: TournamentEventRow;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function displayName(name: string) {
  return name.trim() || "Por definir";
}

function getStandingName(group: TournamentGroup, playerId: string) {
  return displayName(
    group.players.find((player) => player.id === playerId)?.name ?? ""
  );
}

function PlayerLine({
  name,
  winner,
}: {
  name: string;
  winner: boolean;
}) {
  return (
    <div
      className={classNames(
        "flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-lg font-semibold sm:text-xl",
        winner
          ? "border-emerald-300 bg-emerald-300 text-zinc-950"
          : "border-white/10 bg-white/10 text-white"
      )}
    >
      <span className="min-w-0 break-words leading-tight">{displayName(name)}</span>
      {winner ? (
        <span className="shrink-0 rounded-full bg-zinc-950 px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Gana
        </span>
      ) : null}
    </div>
  );
}

function MatchCard({ match }: { match: TournamentMatch }) {
  const cleanWinner = match.winner.trim();
  const winnerIsPlayer =
    cleanWinner &&
    [match.player1.trim(), match.player2.trim()].includes(cleanWinner);

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/90 p-3 shadow-xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-bold uppercase tracking-wide text-emerald-200">
          {match.label}
        </div>
        {match.score.trim() ? (
          <div className="rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-zinc-950">
            {match.score}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <PlayerLine
          name={match.player1}
          winner={Boolean(cleanWinner) && cleanWinner === match.player1.trim()}
        />
        <PlayerLine
          name={match.player2}
          winner={Boolean(cleanWinner) && cleanWinner === match.player2.trim()}
        />
      </div>

      {cleanWinner && !winnerIsPlayer ? (
        <div className="mt-3 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-base font-bold text-emerald-100">
          Ganador: {cleanWinner}
        </div>
      ) : null}
    </div>
  );
}

function BracketView({ bracket }: { bracket: TournamentBracket }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/10 p-4 sm:p-5">
      <div
        className={classNames(
          "grid grid-cols-1 gap-4",
          bracket.rounds.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2"
        )}
      >
        {bracket.rounds.map((round) => (
          <div key={round.id} className="min-w-0">
            <h3 className="mb-3 text-xl font-black text-white sm:text-2xl">
              {round.title}
            </h3>
            <div className="space-y-3">
              {round.matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-4">
        <div className="text-sm font-bold uppercase tracking-wide text-amber-200">
          Campeón
        </div>
        <div className="mt-1 break-words text-3xl font-black text-white sm:text-4xl">
          {displayName(bracket.champion)}
        </div>
      </div>
    </section>
  );
}

function GroupCard({ group }: { group: TournamentGroup }) {
  const standings = [
    { label: "1º", playerId: group.standings.first },
    { label: "2º", playerId: group.standings.second },
    { label: "3º", playerId: group.standings.third },
  ];

  return (
    <section className="rounded-lg border border-white/10 bg-white/10 p-4">
      <h2 className="text-2xl font-black text-white sm:text-3xl">{group.name}</h2>

      <div className="mt-4 space-y-2">
        {group.players.map((player, index) => (
          <div
            key={player.id}
            className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-base font-black text-zinc-950">
              {index + 1}
            </span>
            <span className="min-w-0 break-words text-lg font-semibold text-white sm:text-xl">
              {displayName(player.name)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {standings.map((standing) => (
          <div
            key={standing.label}
            className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2 py-2 text-center"
          >
            <div className="text-sm font-black text-emerald-200">
              {standing.label}
            </div>
            <div className="mt-1 min-h-10 break-words text-sm font-bold leading-tight text-white sm:text-base">
              {getStandingName(group, standing.playerId)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TorneoSabadoPublicClient() {
  const [tournament, setTournament] = useState<TournamentEvent | null>(null);
  const [activeTab, setActiveTab] = useState<PublicTab>("main");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [publicUrl, setPublicUrl] = useState("/torneo-sabado");
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const selectedBracket = useMemo(() => {
    if (!tournament) {
      return null;
    }

    return activeTab === "main"
      ? tournament.state.mainBracket
      : tournament.state.consolationBracket;
  }, [activeTab, tournament]);

  const loadTournament = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/public/tournaments/${TORNEO_SABADO_SLUG}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as PublicApiResponse | null;

      if (!res.ok || !data?.ok || !data.tournament) {
        setError(String(data?.error ?? "No se ha podido cargar el torneo."));
        return;
      }

      setTournament(normalizeTournamentEvent(data.tournament));
      setError(null);
      setLastFetchedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cargar el torneo.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/torneo-sabado`);
    void loadTournament();

    const intervalId = window.setInterval(() => {
      void loadTournament(true);
    }, TOURNAMENT_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTournament]);

  async function shareTournament() {
    setShareStatus(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: tournament?.name ?? "Torneo sábado",
          url: publicUrl,
        });
        return;
      }

      const copied = await copyTextToClipboard(publicUrl);
      setShareStatus(copied ? "Enlace copiado" : "No se ha podido copiar");
    } catch {
      const copied = await copyTextToClipboard(publicUrl);
      setShareStatus(copied ? "Enlace copiado" : "No se ha podido copiar");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="text-3xl font-black">Cargando torneo...</div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="max-w-xl rounded-lg border border-white/10 bg-white/10 p-6 text-center">
          <h1 className="text-3xl font-black">Torneo no disponible</h1>
          {error ? <p className="mt-3 text-lg text-zinc-200">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[96rem] px-4 py-4 sm:px-6 sm:py-6">
        <header className="grid gap-4 border-b border-white/10 pb-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              Padel Montornés
            </div>
            <h1 className="mt-1 break-words text-4xl font-black leading-none text-white sm:text-6xl">
              {tournament.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-base font-semibold text-zinc-300 sm:text-lg">
              {tournament.date ? (
                <span>{formatTournamentDate(tournament.date)}</span>
              ) : null}
              {lastFetchedAt ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-200">
                  Actualizado {lastFetchedAt.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
              {error ? (
                <span className="rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-zinc-950">
                  Reintentando
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={shareTournament}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 active:scale-[0.99]"
            >
              Compartir
            </button>
            {shareStatus ? (
              <span className="text-sm font-semibold text-emerald-200">
                {shareStatus}
              </span>
            ) : null}
          </div>
        </header>

        <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {tournament.state.groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </section>

        <section className="mt-5">
          <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("main")}
              className={classNames(
                "rounded-full px-4 py-2 text-base font-black transition sm:px-5 sm:text-lg",
                activeTab === "main"
                  ? "bg-emerald-300 text-zinc-950"
                  : "text-white hover:bg-white/10"
              )}
            >
              Cuadro principal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("consolation")}
              className={classNames(
                "rounded-full px-4 py-2 text-base font-black transition sm:px-5 sm:text-lg",
                activeTab === "consolation"
                  ? "bg-emerald-300 text-zinc-950"
                  : "text-white hover:bg-white/10"
              )}
            >
              Consolación
            </button>
          </div>

          {selectedBracket ? <BracketView bracket={selectedBracket} /> : null}
        </section>
      </div>
    </main>
  );
}
