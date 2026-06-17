"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LoadingButton } from "@/app/_components/LoadingButton";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";
import { copyTextToClipboard } from "@/lib/client-clipboard";
import { getClientSession } from "@/lib/client-session";
import { getDisplayName } from "@/lib/display-name";
import { supabase } from "@/lib/supabase";
import {
  createEmptyTournamentState,
  getGroupPlayerStats,
  getNextSaturdayISODate,
  getSortedGroupPlayers,
  normalizeTournamentEvent,
  parseTournamentScore,
  syncBracketEntrantsFromStandings,
  TOURNAMENT_DEFAULT_NAME,
  TORNEO_SLUG,
  updateTournamentMatch,
  updateTournamentMatchWinner,
  type TournamentBracket,
  type TournamentBracketKey,
  type TournamentEvent,
  type TournamentEventRow,
  type TournamentGroup,
  type TournamentGroupId,
  type TournamentMatch,
  type TournamentState,
} from "@/lib/tournament";

type AdminTab = "groups" | "main" | "consolation";

type AdminApiResponse = {
  ok?: boolean;
  error?: string;
  created?: boolean;
  tournament?: TournamentEventRow | null;
};

type MemberRow = {
  user_id: string;
  full_name: string;
  alias?: string | null;
  email?: string | null;
  is_active: boolean;
};

const CLUB_GREEN = "#0f5e2e";

const FIELD_CLASS =
  "app-form-control rounded-2xl border border-gray-300 bg-white px-3.5 py-3 text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-green-200";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getSaveSnapshot({
  name,
  date,
  publicEnabled,
  state,
}: {
  name: string;
  date: string;
  publicEnabled: boolean;
  state: TournamentState;
}) {
  return JSON.stringify({
    name,
    date: date || null,
    publicEnabled,
    state,
  });
}

function buildPairName(memberUserIds: string[], membersById: Map<string, MemberRow>) {
  const names = memberUserIds
    .map((userId) => membersById.get(userId))
    .filter((member): member is MemberRow => Boolean(member))
    .map(getDisplayName);

  return names.join(" / ");
}

function getPairDisplayName(
  player: { name: string; memberUserIds: string[] },
  membersById: Map<string, MemberRow>,
  fallback = "Por definir"
) {
  return buildPairName(player.memberUserIds, membersById) || player.name || fallback;
}

function withResolvedPairNames(
  state: TournamentState,
  membersById: Map<string, MemberRow>
) {
  return {
    ...state,
    groups: state.groups.map((group) => ({
      ...group,
      players: group.players.map((player) => ({
        ...player,
        name: getPairDisplayName(player, membersById, player.name),
      })),
    })),
  };
}

function withSyncedBracketEntrants(
  state: TournamentState,
  membersById: Map<string, MemberRow>
) {
  return syncBracketEntrantsFromStandings(withResolvedPairNames(state, membersById));
}

function getWinnerFromScore(match: TournamentMatch, score: string) {
  if (!score.trim()) {
    return "";
  }

  const parsed = parseTournamentScore(score);

  if (!parsed.valid) {
    return "";
  }

  if (parsed.pointsFor > parsed.pointsAgainst) {
    return match.player1.trim();
  }

  if (parsed.pointsAgainst > parsed.pointsFor) {
    return match.player2.trim();
  }

  return "";
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
    link.download = "torneo-qr.svg";
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
            title="QR torneo"
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
  activeMembers,
  membersById,
  selectedMemberIds,
  onPlayerChange,
  onGroupMatchScoreChange,
}: {
  group: TournamentGroup;
  activeMembers: MemberRow[];
  membersById: Map<string, MemberRow>;
  selectedMemberIds: Set<string>;
  onPlayerChange: (
    groupId: TournamentGroupId,
    playerId: string,
    slot: 0 | 1,
    value: string
  ) => void;
  onGroupMatchScoreChange: (
    groupId: TournamentGroupId,
    matchId: string,
    value: string
  ) => void;
}) {
  const sortedPlayers = getSortedGroupPlayers(group);
  const playerById = new Map(group.players.map((player) => [player.id, player]));
  const pairNumberById = new Map(
    group.players.map((player, index) => [player.id, index + 1])
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-black text-gray-900">{group.name}</h2>
      </div>

      <div className="grid gap-2 p-3">
        {group.players.map((player, index) => (
          <div
            key={player.id}
            className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0f5e2e] text-xs font-black text-white">
              {index + 1}
            </span>

            {[0, 1].map((slot) => (
              <select
                key={slot}
                aria-label={`Socio ${slot + 1} de pareja ${index + 1}`}
                value={player.memberUserIds[slot] ?? ""}
                onChange={(event) =>
                  onPlayerChange(
                    group.id,
                    player.id,
                    slot as 0 | 1,
                    event.target.value
                  )
                }
                className="min-w-0 rounded-xl border border-gray-300 bg-white px-2 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">Socio {slot + 1}</option>
                {activeMembers.map((member) => {
                  const currentValue = player.memberUserIds[slot] ?? "";
                  const alreadySelected =
                    selectedMemberIds.has(member.user_id) &&
                    member.user_id !== currentValue;

                  return (
                    <option
                      key={member.user_id}
                      value={member.user_id}
                      disabled={alreadySelected}
                    >
                      {getDisplayName(member)}
                      {alreadySelected ? " (ya seleccionado)" : ""}
                    </option>
                  );
                })}
              </select>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          {group.matches.map((match) => {
            const left = playerById.get(match.pair1Id);
            const right = playerById.get(match.pair2Id);

            return (
              <div
                key={match.id}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] items-center gap-2 rounded-xl bg-gray-50 p-2"
              >
                <div className="flex justify-end">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f5e2e] text-sm font-black text-white">
                    {left ? pairNumberById.get(left.id) : "-"}
                  </span>
                </div>
                <input
                  value={match.score}
                  onChange={(event) =>
                    onGroupMatchScoreChange(group.id, match.id, event.target.value)
                  }
                  placeholder="-"
                  className="h-10 rounded-xl border border-gray-300 bg-white px-2 text-center text-sm font-black text-gray-900 outline-none focus:ring-2 focus:ring-green-200"
                />
                <div className="flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f5e2e] text-sm font-black text-white">
                    {right ? pairNumberById.get(right.id) : "-"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem_2.5rem_2.75rem] gap-1 px-3 py-2 text-center text-[11px] font-black uppercase text-gray-500">
          <span />
          <span className="text-left">Pareja</span>
          <span>PF</span>
          <span>PC</span>
          <span>DIF</span>
        </div>
        {sortedPlayers.map((player, index) => {
          const stats = getGroupPlayerStats(group, player.id);

          return (
            <div
              key={player.id}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem_2.5rem_2.75rem] gap-1 px-3 py-2 text-center text-sm font-black text-gray-900"
            >
              <span>{index + 1}</span>
              <span className="truncate text-left">
                {getPairDisplayName(player, membersById, "-")}
              </span>
              <span>{stats.pointsFor}</span>
              <span>{stats.pointsAgainst}</span>
              <span>{stats.diff}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GroupsPanel({
  state,
  activeMembers,
  membersById,
  setTournamentState,
}: {
  state: TournamentState;
  activeMembers: MemberRow[];
  membersById: Map<string, MemberRow>;
  setTournamentState: React.Dispatch<React.SetStateAction<TournamentState>>;
}) {
  const selectedMemberIds = useMemo(() => {
    return new Set(
      state.groups.flatMap((group) =>
        group.players.flatMap((player) =>
          player.memberUserIds.map((userId) => userId.trim()).filter(Boolean)
        )
      )
    );
  }, [state.groups]);

  function updateGroupPlayer(
    groupId: TournamentGroupId,
    playerId: string,
    slot: 0 | 1,
    value: string
  ) {
    setTournamentState((current) => {
      const next = {
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                players: group.players.map((player) =>
                  player.id === playerId
                    ? {
                        ...player,
                        memberUserIds: player.memberUserIds.map(
                          (currentValue, index) =>
                            index === slot ? value : currentValue
                        ),
                        name: buildPairName(
                          player.memberUserIds.map((currentValue, index) =>
                            index === slot ? value : currentValue
                          ),
                          membersById
                        ),
                      }
                    : player
                ),
              }
            : group
        ),
      };

      return withSyncedBracketEntrants(next, membersById);
    });
  }

  function updateGroupMatchScore(
    groupId: TournamentGroupId,
    matchId: string,
    value: string
  ) {
    setTournamentState((current) => {
      const next = {
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                matches: group.matches.map((match) =>
                  match.id === matchId ? { ...match, score: value } : match
                ),
              }
            : group
        ),
      };

      return withSyncedBracketEntrants(next, membersById);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {state.groups.map((group) => (
          <GroupEditor
            key={group.id}
            group={group}
            activeMembers={activeMembers}
            membersById={membersById}
            selectedMemberIds={selectedMemberIds}
            onPlayerChange={updateGroupPlayer}
            onGroupMatchScoreChange={updateGroupMatchScore}
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
  function updateScore(value: string) {
    setTournamentState((current) => {
      const next = updateTournamentMatch(current, bracketKey, match.id, {
        score: value,
      });
      const winner = getWinnerFromScore(match, value);

      return updateTournamentMatchWinner(next, bracketKey, match.id, winner);
    });
  }

  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <div className="min-w-0 space-y-2">
          <div
            className={classNames(
              "min-h-10 rounded-xl border px-3 py-2 text-sm font-black",
              match.winner.trim() && match.winner.trim() === match.player1.trim()
                ? "border-[#0f5e2e]/30 bg-[#eef8f1] text-[#0f5e2e]"
                : "border-gray-200 bg-gray-50 text-gray-900"
            )}
          >
            <span className="line-clamp-2 break-words">
              {match.player1.trim() || "Por definir"}
            </span>
          </div>
          <div
            className={classNames(
              "min-h-10 rounded-xl border px-3 py-2 text-sm font-black",
              match.winner.trim() && match.winner.trim() === match.player2.trim()
                ? "border-[#0f5e2e]/30 bg-[#eef8f1] text-[#0f5e2e]"
                : "border-gray-200 bg-gray-50 text-gray-900"
            )}
          >
            <span className="line-clamp-2 break-words">
              {match.player2.trim() || "Por definir"}
            </span>
          </div>
        </div>

        <label className="block">
          <span className="sr-only">Resultado</span>
          <input
            value={match.score}
            onChange={(event) => updateScore(event.target.value)}
            placeholder="-"
            className="h-full min-h-[5.5rem] w-full rounded-xl border border-gray-300 bg-white px-2 text-center text-base font-black text-gray-900 outline-none focus:ring-2 focus:ring-green-200"
          />
        </label>
      </div>
    </div>
  );
}

function getBracketStageClass(bracket: TournamentBracket) {
  return bracket.rounds[0]?.matches.length === 4 ? "h-[34rem]" : "h-[18rem]";
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

function DesktopRoundEditor({
  round,
  bracketKey,
  setTournamentState,
  stageClass,
}: {
  round: TournamentBracket["rounds"][number];
  bracketKey: TournamentBracketKey;
  setTournamentState: React.Dispatch<React.SetStateAction<TournamentState>>;
  stageClass: string;
}) {
  return (
    <section className="min-w-0">
      <h2 className="mb-2 text-lg font-black uppercase text-gray-900">
        {round.title}
      </h2>
      <div className={classNames("relative", stageClass)}>
        {round.matches.map((match, index) => (
          <div
            key={match.id}
            className="absolute left-0 right-0 -translate-y-1/2"
            style={{ top: `${getMatchTop(round.matches.length, index)}%` }}
          >
            <MatchEditor
              match={match}
              bracketKey={bracketKey}
              setTournamentState={setTournamentState}
            />
          </div>
        ))}
      </div>
    </section>
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
    sourceMatches >= 4
      ? [
          { from: 12.5, to: 37.5, target: 25 },
          { from: 62.5, to: 87.5, target: 75 },
        ]
      : [{ from: 25, to: 75, target: 50 }];
  const lineClass = "absolute bg-[#0f5e2e]";

  return (
    <div className="pt-9">
      <div aria-hidden="true" className={classNames("relative w-full", stageClass)}>
        {branches.map((branch) => (
          <div
            key={`${branch.from}-${branch.to}`}
          >
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
  const stageClass = getBracketStageClass(bracket);
  const gridTemplate =
    bracket.rounds.length === 3
      ? "xl:grid-cols-[1fr_3rem_1fr_3rem_1fr]"
      : "xl:grid-cols-[1fr_3rem_1fr]";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:hidden">
        {bracket.rounds.map((round) => (
          <section key={round.id} className="min-w-0 space-y-3">
            <h2 className="text-lg font-black uppercase text-gray-900">
              {round.title}
            </h2>
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

      <div
        className={classNames("hidden gap-4 xl:grid xl:items-start", gridTemplate)}
      >
        {bracket.rounds.map((round, index) => (
          <div key={round.id} className="contents">
            <DesktopRoundEditor
              round={round}
              bracketKey={bracketKey}
              setTournamentState={setTournamentState}
              stageClass={stageClass}
            />
            {index < bracket.rounds.length - 1 ? (
              <BracketConnector
                sourceMatches={round.matches.length}
                stageClass={stageClass}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#0f5e2e]/25 bg-[#eef8f1] p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#0f5e2e]">
          Campeones
        </div>
        <input
          value={bracket.champion || "Por definir"}
          readOnly
          placeholder="Campeón"
          className="mt-1 w-full border-0 bg-transparent p-0 text-2xl font-black text-gray-950 outline-none"
        />
      </div>
    </div>
  );
}

export default function TorneoAdminClient() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentEvent | null>(null);
  const [name, setName] = useState(TOURNAMENT_DEFAULT_NAME);
  const [date, setDate] = useState(getNextSaturdayISODate());
  const [publicEnabled, setPublicEnabled] = useState(true);
  const [state, setState] = useState<TournamentState>(() =>
    createEmptyTournamentState()
  );
  const [activeMembers, setActiveMembers] = useState<MemberRow[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("groups");
  const [publicUrl, setPublicUrl] = useState("/torneo");
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const lastSavedSnapshotRef = useRef("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiUrl = `/api/admin/tournaments/${TORNEO_SLUG}`;

  const activeBracket = useMemo(() => {
    return activeTab === "main" ? state.mainBracket : state.consolationBracket;
  }, [activeTab, state.consolationBracket, state.mainBracket]);

  const membersById = useMemo(() => {
    return new Map(activeMembers.map((member) => [member.user_id, member]));
  }, [activeMembers]);

  function applyTournament(nextTournament: TournamentEvent | null) {
    setTournament(nextTournament);

    if (!nextTournament) {
      const nextName = TOURNAMENT_DEFAULT_NAME;
      const nextDate = getNextSaturdayISODate();
      const nextPublicEnabled = true;
      const nextState = createEmptyTournamentState();

      lastSavedSnapshotRef.current = getSaveSnapshot({
        name: nextName,
        date: nextDate,
        publicEnabled: nextPublicEnabled,
        state: nextState,
      });

      setName(nextName);
      setDate(nextDate);
      setPublicEnabled(nextPublicEnabled);
      setState(nextState);
      return;
    }

    const nextName = nextTournament.name;
    const nextDate = nextTournament.date ?? "";
    const nextPublicEnabled = nextTournament.public_enabled;
    const nextState = nextTournament.state;

    lastSavedSnapshotRef.current = getSaveSnapshot({
      name: nextName,
      date: nextDate,
      publicEnabled: nextPublicEnabled,
      state: nextState,
    });

    setName(nextName);
    setDate(nextDate);
    setPublicEnabled(nextPublicEnabled);
    setState(nextState);
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

      const [res, membersRes] = await Promise.all([
        fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
        supabase
          .from("members")
          .select("user_id,full_name,alias,email,is_active")
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
      ]);
      const data = (await res.json().catch(() => null)) as AdminApiResponse | null;

      if (membersRes.error) {
        setMsg(membersRes.error.message);
      } else {
        setActiveMembers((membersRes.data ?? []) as MemberRow[]);
      }

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
    setPublicUrl(`${window.location.origin}/torneo`);
    void loadTournament();
  }, [loadTournament]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!tournament || !accessToken || loading) {
      return;
    }

    const snapshot = getSaveSnapshot({
      name,
      date,
      publicEnabled,
      state,
    });

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
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

        lastSavedSnapshotRef.current = snapshot;
        setTournament(normalizeTournamentEvent(data.tournament));
        setMsg(null);
      } finally {
        setSaving(false);
      }
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    accessToken,
    apiUrl,
    date,
    loading,
    name,
    publicEnabled,
    state,
    tournament,
  ]);

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
          title="Torneo"
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
                activeMembers={activeMembers}
                membersById={membersById}
                setTournamentState={setState}
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
