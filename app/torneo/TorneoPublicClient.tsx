"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function BackArrowIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ShareIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  );
}

function AppBackLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Volver a inicio"
      title="Volver a inicio"
      className={classNames(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent bg-white text-gray-900 shadow-sm outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-300 active:scale-[0.98] active:bg-gray-200/70",
        className
      )}
    >
      <BackArrowIcon className="-translate-y-[3px] h-6 w-6" />
    </Link>
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
        "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-base font-semibold sm:text-lg xl:min-h-7 xl:gap-2 xl:px-2 xl:py-1 xl:text-xs",
        winner
          ? "border-[#0f5e2e] bg-[#0f5e2e] text-white"
          : "border-gray-200 bg-gray-50 text-gray-950"
      )}
    >
      <span className="min-w-0 break-words leading-tight">{displayName(name)}</span>
    </div>
  );
}

function MatchMeta({
  court,
  startTime,
  endTime,
}: {
  court: string;
  startTime: string;
  endTime: string;
}) {
  const schedule = [startTime, endTime].filter(Boolean).join(" - ");
  const items = [court, schedule].filter(Boolean);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase text-[#0f5e2e] xl:mb-1 xl:text-[9px]">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-[#0f5e2e]/15 bg-[#eef8f1] px-2 py-0.5"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function getScoreDisplayParts(score: string) {
  const cleanScore = score.trim();

  if (!cleanScore) {
    return ["-"];
  }

  const parts = cleanScore.split(/\s*-\s*/).filter(Boolean);

  return parts.length === 2 ? [parts[0], "-", parts[1]] : [cleanScore];
}
function MatchCard({ match }: { match: TournamentMatch }) {
  const cleanWinner = match.winner.trim();
  const winnerIsPlayer =
    cleanWinner &&
    [match.player1.trim(), match.player2.trim()].includes(cleanWinner);
  const scoreParts = getScoreDisplayParts(match.score);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm xl:p-1.5">
      <MatchMeta
        court={match.court}
        startTime={match.startTime}
        endTime={match.endTime}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_4.25rem] gap-2 xl:grid-cols-[minmax(0,1fr)_3.1rem] xl:gap-1.5">
        <div className="space-y-2 xl:space-y-1.5">
          <PlayerLine
            name={match.player1}
            winner={Boolean(cleanWinner) && cleanWinner === match.player1.trim()}
          />
          <PlayerLine
            name={match.player2}
            winner={Boolean(cleanWinner) && cleanWinner === match.player2.trim()}
          />
        </div>
        <div className="flex min-h-full flex-col items-center justify-center rounded-lg border border-[#0f5e2e]/25 bg-[#eef8f1] px-2 text-center text-xl font-bold leading-none text-[#0f5e2e] xl:px-1 xl:text-base">
          {scoreParts.map((part, index) => (
            <span key={`${part}-${index}`}>{part}</span>
          ))}
        </div>
      </div>

      {cleanWinner && !winnerIsPlayer ? (
        <div className="mt-2 rounded-lg border border-[#0f5e2e]/25 bg-[#eef8f1] px-3 py-2 text-sm font-bold text-[#0f5e2e] xl:mt-1.5 xl:px-2 xl:py-1 xl:text-xs">
          Ganador: {cleanWinner}
        </div>
      ) : null}
    </div>
  );
}

function getBracketStageClass(bracket: TournamentBracket) {
  return bracket.rounds[0]?.matches.length === 4
    ? "h-[26rem] xl:min-h-[26rem] xl:flex-1"
    : "h-[16rem] xl:min-h-[14rem] xl:flex-1";
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
    <div className="min-w-0 xl:flex xl:h-full xl:flex-col">
      <div className={classNames("relative xl:min-h-0", stageClass)}>
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
    <div className="pt-9 xl:flex xl:h-full xl:flex-col xl:pt-0">
      <div aria-hidden="true" className={classNames("relative w-full xl:min-h-0", stageClass)}>
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

function BracketView({
  bracket,
  mobileRoundIndex,
  publicUrl,
}: {
  bracket: TournamentBracket;
  mobileRoundIndex: number | null;
  publicUrl: string;
}) {
  const stageClass = getBracketStageClass(bracket);
  const gridTemplate =
    bracket.rounds.length === 3
      ? "xl:grid-cols-[minmax(16rem,22rem)_4rem_minmax(16rem,22rem)_4rem_minmax(16rem,22rem)]"
      : "xl:grid-cols-[minmax(16rem,22rem)_4rem_minmax(16rem,22rem)]";
  const mobileRound =
    typeof mobileRoundIndex === "number" ? bracket.rounds[mobileRoundIndex] : null;

  return (
    <section className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:p-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="grid grid-cols-1 gap-4 xl:hidden">
        {mobileRound ? (
          <div key={mobileRound.id} className="min-w-0">
            <div className="space-y-3">
              {mobileRound.matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={classNames(
          "hidden gap-4 xl:mx-auto xl:grid xl:min-h-0 xl:w-fit xl:max-w-full xl:flex-1 xl:grid-rows-[1fr] xl:items-stretch xl:gap-2",
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
      </div>

      <div className="absolute bottom-3 right-3 z-10 hidden rounded-lg border border-[#0f5e2e]/20 bg-white p-2 shadow-sm shadow-black/10 2xl:block">
        <QRCodeSVG
          value={publicUrl}
          size={116}
          level="M"
          marginSize={1}
          title="QR torneo"
        />
      </div>
    </section>
  );
}

function GroupCard({ group }: { group: TournamentGroup }) {
  const sortedPlayers = getSortedGroupPlayers(group);
  const playerById = new Map(group.players.map((player) => [player.id, player]));

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 xl:px-2 xl:py-1">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#0f5e2e] xl:text-base">
            {group.name} - {group.court}
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-semibold uppercase text-gray-500 xl:text-[9px]">
          <span className="w-10 xl:w-8">PF</span>
          <span className="w-10 xl:w-8">PC</span>
          <span className="w-10 xl:w-8">DIF</span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {sortedPlayers.map((player, index) => {
          const stats = getGroupPlayerStats(group, player.id);

          return (
          <div
            key={player.id}
            className={classNames(
              "grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_7.75rem] items-center gap-2 px-3 py-2 xl:min-h-7 xl:grid-cols-[1.5rem_minmax(0,1fr)_6rem] xl:gap-1.5 xl:px-2 xl:py-1",
              index < 2
                ? "bg-[#eef8f1]"
                : index === 2
                ? "bg-[#f7fbf8]"
                : "bg-white"
            )}
          >
            <span
              className={classNames(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold xl:h-5 xl:w-5 xl:text-[11px]",
                index < 2
                  ? "bg-[#0f5e2e] text-white"
                  : index === 2
                  ? "bg-[#0f5e2e]/15 text-[#0f5e2e]"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 break-words text-sm font-semibold leading-tight text-gray-950 sm:text-base xl:text-xs">
              {displayName(player.name)}
            </span>
            <div className="grid grid-cols-3 gap-1 text-center text-sm font-semibold text-gray-950 xl:text-xs">
              <span>{stats.pointsFor}</span>
              <span>{stats.pointsAgainst}</span>
              <span>{stats.diff}</span>
            </div>
          </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-2 xl:px-2 xl:py-1.5">
        <div className="grid gap-1.5 xl:gap-1">
          {group.matches.map((match) => {
            const left = playerById.get(match.pair1Id);
            const right = playerById.get(match.pair2Id);
            const leftName = displayName(left?.name ?? "");
            const rightName = displayName(right?.name ?? "");

            return (
              <div
                key={match.id}
                className="grid grid-cols-[5.6rem_minmax(0,1fr)] items-start gap-2 rounded-lg bg-white px-2 py-1 text-xs text-gray-800 ring-1 ring-gray-200/70 xl:grid-cols-[4.5rem_minmax(0,1fr)] xl:gap-1 xl:px-1.5 xl:text-[10px]"
              >
                <span className="font-bold text-[#0f5e2e]">
                  {match.startTime} - {match.endTime}
                </span>
                <span className="min-w-0 break-words font-semibold leading-tight">
                  {leftName} vs {rightName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function TorneoPublicClient({
  showAppBackLink = false,
}: {
  showAppBackLink?: boolean;
}) {
  const [tournament, setTournament] = useState<TournamentEvent | null>(null);
  const [activeTab, setActiveTab] = useState<PublicTab>("main");
  const [mobileSection, setMobileSection] = useState<MobileSection>("groups");
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
    setPublicUrl(`${window.location.origin}/torneo-sabado`);
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
        {showAppBackLink ? (
          <AppBackLink className="fixed left-3 top-3 sm:left-5 sm:top-5" />
        ) : null}
        <div className="flex items-center gap-4 text-3xl font-bold text-[#0f5e2e]">
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
        {showAppBackLink ? (
          <AppBackLink className="fixed left-3 top-3 sm:left-5 sm:top-5" />
        ) : null}
        <div className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <img
            src="/logo-header.png"
            alt="Club Pàdel Montornès"
            className="mx-auto h-20 w-auto"
          />
          <h1 className="mt-4 text-3xl font-bold text-[#0f5e2e]">
            Torneo no disponible
          </h1>
          {error ? <p className="mt-3 text-lg text-gray-600">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8f5] text-gray-950 2xl:h-[100dvh] 2xl:overflow-hidden">
      <div className="mx-auto max-w-[118rem] px-4 py-5 sm:px-6 sm:py-6 xl:flex xl:max-w-none xl:flex-col xl:px-5 xl:py-3 2xl:h-full">
        <header className="relative grid gap-3 border-b border-[#0f5e2e]/15 pb-5 pr-24 lg:gap-5 lg:pr-0 lg:grid-cols-[1fr_auto] lg:items-end xl:flex-none xl:gap-3 xl:pb-3">
          <div className="flex min-w-0 items-center gap-4 xl:gap-3">
            <img
              src="/logo-header.png"
              alt="Club Pàdel Montornès"
              className="h-28 w-auto shrink-0 sm:h-36 lg:h-44 xl:h-28 2xl:h-32"
            />
            <div className="hidden">
              Padel Montornés
            </div>
            <div className="min-w-0">
            <h1 className="break-words text-4xl font-bold leading-none text-[#0f5e2e] sm:text-6xl xl:text-4xl">
              {tournament.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-base font-semibold text-gray-600 sm:text-lg xl:mt-1 xl:text-sm">
              {lastFetchedAt ? (
                <span className="rounded-full border border-[#0f5e2e]/15 bg-white px-3 py-1 text-sm text-[#0f5e2e] shadow-sm xl:px-2 xl:py-0.5 xl:text-xs">
                  Actualizado {lastFetchedAt.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
              {error ? (
                <span className="rounded-full bg-yellow-200 px-3 py-1 text-sm font-bold text-gray-950 xl:px-2 xl:py-0.5 xl:text-xs">
                  Reintentando
                </span>
              ) : null}
            </div>
            </div>
          </div>

          <div className="absolute right-0 top-0 flex items-center gap-2 lg:static lg:flex-wrap lg:justify-end">
            {showAppBackLink ? <AppBackLink /> : null}
            <button
              type="button"
              aria-label="Compartir torneo"
              title="Compartir torneo"
              onClick={shareTournament}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0f5e2e] bg-white text-[#0f5e2e] shadow-sm transition hover:bg-[#eef8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f5e2e]/30 active:scale-[0.99]"
            >
              <ShareIcon />
            </button>
            {shareStatus ? (
              <span className="absolute right-0 top-12 whitespace-nowrap text-xs font-semibold text-[#0f5e2e] lg:static lg:text-sm">
                {shareStatus}
              </span>
            ) : null}
          </div>
        </header>

        <nav className="mt-4 grid grid-cols-2 gap-2 xl:hidden">
          {mobileSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setMobileSection(section.id)}
              className={classNames(
                "min-w-0 rounded-full border px-2.5 py-2 text-center text-[13px] font-bold leading-4 shadow-sm transition",
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
            "mt-5 gap-3 xl:mt-2 xl:flex-none xl:gap-2",
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
            "mt-5 xl:mt-2 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col",
            mobileSection === "groups" ? "hidden xl:flex" : "block"
          )}
        >
          <div className="mb-4 inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm xl:mb-2 xl:flex-none">
            <button
              type="button"
              onClick={() => setActiveTab("main")}
              className={classNames(
                "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-base font-bold transition sm:px-5 sm:text-lg xl:px-3 xl:py-1.5 xl:text-sm",
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
                "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-base font-bold transition sm:px-5 sm:text-lg xl:px-3 xl:py-1.5 xl:text-sm",
                activeTab === "consolation"
                  ? "bg-[#0f5e2e] text-white"
                  : "text-gray-700 hover:bg-[#eef8f1]"
              )}
            >
              <span aria-hidden="true">{"\u{1F949}"}</span>
              <span>3r puesto</span>
            </button>
          </div>

          {selectedBracket ? (
            <BracketView
              bracket={selectedBracket}
              mobileRoundIndex={mobileRoundIndex}
              publicUrl={publicUrl}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
