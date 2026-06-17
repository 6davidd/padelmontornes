"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { copyTextToClipboard } from "@/lib/client-clipboard";
import {
  getGroupPlayerStats,
  getSortedGroupPlayers,
  normalizeTournamentEvent,
  TOURNAMENT_AUTO_REFRESH_MS,
  TORNEO_SLUG,
  type TournamentBracket,
  type TournamentEvent,
  type TournamentEventRow,
  type TournamentGroup,
  type TournamentMatch,
} from "@/lib/tournament";

type PublicTab = "main" | "consolation";
type MobileSection = "groups" | "round-0" | "round-1" | "round-2";

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

function formatRoundLabel(title: string) {
  const cleanTitle = title.trim().toLocaleLowerCase("es-ES");

  return cleanTitle ? cleanTitle[0].toLocaleUpperCase("es-ES") + cleanTitle.slice(1) : "Ronda";
}

function getMobileRoundIndex(section: MobileSection) {
  if (section === "groups") {
    return null;
  }

  return Number(section.replace("round-", ""));
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
        "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-base font-black sm:text-lg",
        winner
          ? "border-[#0f5e2e] bg-[#0f5e2e] text-white"
          : "border-gray-200 bg-gray-50 text-gray-950"
      )}
    >
      <span className="min-w-0 break-words leading-tight">{displayName(name)}</span>
      {winner ? (
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-[#0f5e2e]">
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
  const score = match.score.trim() || "-";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_4.75rem] gap-2">
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
        <div className="flex min-h-full items-center justify-center rounded-lg border border-[#0f5e2e]/25 bg-[#eef8f1] px-2 text-center text-xl font-black text-[#0f5e2e]">
          {score}
        </div>
      </div>

      {cleanWinner && !winnerIsPlayer ? (
        <div className="mt-2 rounded-lg border border-[#0f5e2e]/25 bg-[#eef8f1] px-3 py-2 text-sm font-bold text-[#0f5e2e]">
          Ganador: {cleanWinner}
        </div>
      ) : null}
    </div>
  );
}

function getBracketStageClass(bracket: TournamentBracket) {
  return bracket.rounds[0]?.matches.length === 4 ? "h-[30rem]" : "h-[16rem]";
}

function getMatchTop(count: number, index: number) {
  if (count >= 4) {
    return [12.5, 37.5, 62.5, 87.5][index] ?? 50;
  }

  if (count === 2) {
    return [25, 75][index] ?? 50;
  }

  return 50;
}

function DesktopRound({
  round,
  stageClass,
}: {
  round: TournamentBracket["rounds"][number];
  stageClass: string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-lg font-black uppercase text-[#0f5e2e]">
        {round.title}
      </h3>
      <div className={classNames("relative", stageClass)}>
        {round.matches.map((match, index) => (
          <div
            key={match.id}
            className="absolute left-0 right-0 -translate-y-1/2"
            style={{ top: `${getMatchTop(round.matches.length, index)}%` }}
          >
            <MatchCard match={match} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketConnector({
  sourceMatches,
  stageClass,
}: {
  sourceMatches: number;
  stageClass: string;
}) {
  const branches =
    sourceMatches === 1
      ? [{ from: 50, to: 50, target: 50 }]
      : sourceMatches >= 4
      ? [
          { from: 12.5, to: 37.5, target: 25 },
          { from: 62.5, to: 87.5, target: 75 },
        ]
      : [{ from: 25, to: 75, target: 50 }];
  const lineClass = "absolute bg-[#0f5e2e]";

  return (
    <div className="pt-9">
      <div aria-hidden="true" className={classNames("relative w-full", stageClass)}>
        {branches.map((branch) =>
          sourceMatches === 1 ? (
            <div
              key={`${branch.from}-${branch.to}`}
              className={classNames(lineClass, "left-0 h-1 w-full")}
              style={{ top: `calc(${branch.target}% - 2px)` }}
            />
          ) : (
            <div key={`${branch.from}-${branch.to}`}>
              <div
                className={classNames(lineClass, "left-0 h-1 w-[68%]")}
                style={{ top: `calc(${branch.from}% - 2px)` }}
              />
              <div
                className={classNames(lineClass, "left-0 h-1 w-[68%]")}
                style={{ top: `calc(${branch.to}% - 2px)` }}
              />
              <div
                className={classNames(lineClass, "left-[68%] w-1")}
                style={{
                  top: `calc(${branch.from}% - 2px)`,
                  height: `calc(${branch.to - branch.from}% + 4px)`,
                }}
              />
              <div
                className={classNames(lineClass, "left-[68%] h-1 w-[32%]")}
                style={{ top: `calc(${branch.target}% - 2px)` }}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ChampionCard({ champion }: { champion: string }) {
  return (
    <div className="rounded-lg border border-[#0f5e2e]/25 bg-[#eef8f1] p-4 shadow-sm">
      <div className="text-xs font-black uppercase text-[#0f5e2e]">
        Campeones
      </div>
      <div className="mt-1 break-words text-2xl font-black text-gray-950">
        {displayName(champion)}
      </div>
    </div>
  );
}

function DesktopChampion({
  champion,
  stageClass,
}: {
  champion: string;
  stageClass: string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-lg font-black uppercase text-[#0f5e2e]">
        Campeones
      </h3>
      <div className={classNames("relative", stageClass)}>
        <div className="absolute left-0 right-0 -translate-y-1/2 top-1/2">
          <ChampionCard champion={champion} />
        </div>
      </div>
    </div>
  );
}

function BracketView({
  bracket,
  mobileRoundIndex,
}: {
  bracket: TournamentBracket;
  mobileRoundIndex: number | null;
}) {
  const stageClass = getBracketStageClass(bracket);
  const gridTemplate =
    bracket.rounds.length === 3
      ? "xl:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)_3rem_minmax(0,1fr)_3rem_minmax(12rem,0.7fr)]"
      : "xl:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)_3rem_minmax(12rem,0.7fr)]";
  const mobileRound =
    typeof mobileRoundIndex === "number" ? bracket.rounds[mobileRoundIndex] : null;
  const showMobileChampion =
    typeof mobileRoundIndex === "number" &&
    mobileRoundIndex === bracket.rounds.length - 1;

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:p-3">
      <div className="grid grid-cols-1 gap-4 xl:hidden">
        {mobileRound ? (
          <div key={mobileRound.id} className="min-w-0">
            <h3 className="mb-2 text-lg font-black uppercase text-[#0f5e2e]">
              {mobileRound.title}
            </h3>
            <div className="space-y-3">
              {mobileRound.matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ) : null}
        {showMobileChampion ? (
          <div className="min-w-0">
            <h3 className="mb-2 text-lg font-black uppercase text-[#0f5e2e]">
              Campeones
            </h3>
            <ChampionCard champion={bracket.champion} />
          </div>
        ) : null}
      </div>

      <div
        className={classNames(
          "hidden gap-4 xl:grid xl:items-start",
          gridTemplate
        )}
      >
        {bracket.rounds.map((round, index) => (
          <div key={round.id} className="contents">
            <DesktopRound round={round} stageClass={stageClass} />

            {index < bracket.rounds.length - 1 ? (
              <BracketConnector
                sourceMatches={round.matches.length}
                stageClass={stageClass}
              />
            ) : null}
          </div>
        ))}
        <BracketConnector sourceMatches={1} stageClass={stageClass} />
        <DesktopChampion champion={bracket.champion} stageClass={stageClass} />
      </div>
    </section>
  );
}

function GroupCard({ group }: { group: TournamentGroup }) {
  const sortedPlayers = getSortedGroupPlayers(group);

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <h2 className="text-xl font-black text-[#0f5e2e]">{group.name}</h2>
        <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-black uppercase text-gray-500">
          <span className="w-10">PF</span>
          <span className="w-10">PC</span>
          <span className="w-10">DIF</span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {sortedPlayers.map((player, index) => {
          const stats = getGroupPlayerStats(group, player.id);

          return (
          <div
            key={player.id}
            className={classNames(
              "grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_7.75rem] items-center gap-2 px-3 py-2",
              index < 2
                ? "bg-[#eef8f1]"
                : index === 2
                ? "bg-[#f7fbf8]"
                : "bg-white"
            )}
          >
            <span
              className={classNames(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black",
                index < 2
                  ? "bg-[#0f5e2e] text-white"
                  : index === 2
                  ? "bg-[#0f5e2e]/15 text-[#0f5e2e]"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 break-words text-sm font-black leading-tight text-gray-950 sm:text-base">
              {displayName(player.name)}
            </span>
            <div className="grid grid-cols-3 gap-1 text-center text-sm font-black text-gray-950">
              <span>{stats.pointsFor}</span>
              <span>{stats.pointsAgainst}</span>
              <span>{stats.diff}</span>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}

export default function TorneoPublicClient() {
  const [tournament, setTournament] = useState<TournamentEvent | null>(null);
  const [activeTab, setActiveTab] = useState<PublicTab>("main");
  const [mobileSection, setMobileSection] = useState<MobileSection>("groups");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [publicUrl, setPublicUrl] = useState("/torneo");
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const selectedBracket = useMemo(() => {
    if (!tournament) {
      return null;
    }

    return activeTab === "main"
      ? tournament.state.mainBracket
      : tournament.state.consolationBracket;
  }, [activeTab, tournament]);
  const mobileRoundIndex = useMemo(() => {
    if (!selectedBracket) {
      return null;
    }

    const index = getMobileRoundIndex(mobileSection);

    if (index === null || index < 0 || index >= selectedBracket.rounds.length) {
      return null;
    }

    return index;
  }, [mobileSection, selectedBracket]);
  const mobileSections = useMemo(() => {
    const roundOptions =
      selectedBracket?.rounds.map((round, index) => ({
        id: `round-${index}` as MobileSection,
        label: formatRoundLabel(round.title),
      })) ?? [];

    return [{ id: "groups" as MobileSection, label: "Fase grupos" }, ...roundOptions];
  }, [selectedBracket]);

  const loadTournament = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/public/tournaments/${TORNEO_SLUG}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as PublicApiResponse | null;

      if (!res.ok || !data?.ok || !data.tournament) {
        if (res.status === 404 || (data?.ok && !data.tournament)) {
          setTournament(null);
        }

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
    setPublicUrl(`${window.location.origin}/torneo`);
    void loadTournament();

    const intervalId = window.setInterval(() => {
      void loadTournament(true);
    }, TOURNAMENT_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTournament]);

  useEffect(() => {
    if (!selectedBracket || mobileSection === "groups") {
      return;
    }

    const index = getMobileRoundIndex(mobileSection);

    if (index === null || index < selectedBracket.rounds.length) {
      return;
    }

    setMobileSection(`round-${Math.max(selectedBracket.rounds.length - 1, 0)}` as MobileSection);
  }, [mobileSection, selectedBracket]);

  async function shareTournament() {
    setShareStatus(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: tournament?.name ?? "Torneo",
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
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] p-6 text-gray-950">
        <div className="flex items-center gap-4 text-3xl font-black text-[#0f5e2e]">
          <img
            src="/logo-header.png"
            alt="Club Pàdel Montornès"
            className="h-16 w-auto"
          />
          <span>Cargando torneo...</span>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] p-6 text-gray-950">
        <div className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <img
            src="/logo-header.png"
            alt="Club Pàdel Montornès"
            className="mx-auto h-20 w-auto"
          />
          <h1 className="mt-4 text-3xl font-black text-[#0f5e2e]">
            Torneo no disponible
          </h1>
          {error ? <p className="mt-3 text-lg text-gray-600">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8f5] text-gray-950">
      <div className="mx-auto max-w-[118rem] px-3 py-3 sm:px-5 sm:py-5">
        <header className="grid gap-4 border-b border-[#0f5e2e]/15 pb-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src="/logo-header.png"
              alt="Club Pàdel Montornès"
              className="h-24 w-auto shrink-0 sm:h-32 lg:h-36"
            />
            <div className="hidden">
              Padel Montornés
            </div>
            <div className="min-w-0">
            <h1 className="break-words text-4xl font-black leading-none text-[#0f5e2e] sm:text-6xl">
              {tournament.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-base font-semibold text-gray-600 sm:text-lg">
              {lastFetchedAt ? (
                <span className="rounded-full border border-[#0f5e2e]/15 bg-white px-3 py-1 text-sm text-[#0f5e2e] shadow-sm">
                  Actualizado {lastFetchedAt.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
              {error ? (
                <span className="rounded-full bg-yellow-200 px-3 py-1 text-sm font-black text-gray-950">
                  Reintentando
                </span>
              ) : null}
            </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={shareTournament}
              className="rounded-full border border-[#0f5e2e] bg-white px-4 py-2 text-sm font-bold text-[#0f5e2e] shadow-sm transition hover:bg-[#eef8f1] active:scale-[0.99]"
            >
              Compartir
            </button>
            {shareStatus ? (
              <span className="text-sm font-semibold text-[#0f5e2e]">
                {shareStatus}
              </span>
            ) : null}
          </div>
        </header>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
          {mobileSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setMobileSection(section.id)}
              className={classNames(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-black shadow-sm transition",
                mobileSection === section.id
                  ? "border-[#0f5e2e] bg-[#0f5e2e] text-white"
                  : "border-gray-200 bg-white text-gray-700"
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <section
          className={classNames(
            "mt-5 gap-3",
            mobileSection === "groups"
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
              : "hidden xl:grid xl:grid-cols-4"
          )}
        >
          {tournament.state.groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </section>

        <section
          className={classNames(
            "mt-5",
            mobileSection === "groups" ? "hidden xl:block" : "block"
          )}
        >
          <div className="mb-4 inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("main")}
              className={classNames(
                "rounded-full px-4 py-2 text-base font-black transition sm:px-5 sm:text-lg",
                activeTab === "main"
                  ? "bg-[#0f5e2e] text-white"
                  : "text-gray-700 hover:bg-[#eef8f1]"
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
                  ? "bg-[#0f5e2e] text-white"
                  : "text-gray-700 hover:bg-[#eef8f1]"
              )}
            >
              Consolación
            </button>
          </div>

          {selectedBracket ? (
            <BracketView
              bracket={selectedBracket}
              mobileRoundIndex={mobileRoundIndex}
            />
          ) : null}
        </section>
      </div>

      <aside className="fixed bottom-4 right-4 hidden rounded-lg border border-[#0f5e2e]/20 bg-white p-3 shadow-xl shadow-black/10 lg:block">
        <QRCodeSVG
          value={publicUrl}
          size={116}
          level="M"
          marginSize={1}
          title="QR torneo"
        />
      </aside>
    </main>
  );
}
