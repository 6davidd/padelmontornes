import {
  addDaysToISODate,
  formatDateLong,
  getTodayClubISODate,
  isISODate,
  isSaturdayISO,
} from "./booking-window";

export const TORNEO_SABADO_SLUG = "torneo-sabado";
export const TOURNAMENT_DEFAULT_NAME = "Torneo Montornés";
export const TOURNAMENT_AUTO_REFRESH_MS = 12000;

export const TOURNAMENT_GROUP_IDS = ["A", "B", "C", "D"] as const;

export type TournamentGroupId = (typeof TOURNAMENT_GROUP_IDS)[number];
export type TournamentPlace = "first" | "second" | "third";
export type TournamentBracketKey = "mainBracket" | "consolationBracket";

export type TournamentPlayer = {
  id: string;
  name: string;
  memberUserIds: string[];
  pointsFor: number;
  pointsAgainst: number;
};

export type TournamentGroupMatch = {
  id: string;
  pair1Id: string;
  pair2Id: string;
  score: string;
};

export type TournamentGroup = {
  id: TournamentGroupId;
  name: string;
  players: TournamentPlayer[];
  matches: TournamentGroupMatch[];
  standings: Record<TournamentPlace, string>;
};

export type TournamentMatch = {
  id: string;
  label: string;
  player1: string;
  player2: string;
  score: string;
  winner: string;
  nextMatchId?: string;
  nextSlot?: 1 | 2;
};

export type TournamentRound = {
  id: string;
  title: string;
  matches: TournamentMatch[];
};

export type TournamentBracket = {
  title: string;
  rounds: TournamentRound[];
  champion: string;
};

export type TournamentState = {
  version: 1;
  groups: TournamentGroup[];
  mainBracket: TournamentBracket;
  consolationBracket: TournamentBracket;
};

export type TournamentEvent = {
  id: string;
  slug: string;
  name: string;
  date: string | null;
  public_enabled: boolean;
  state: TournamentState;
  created_at?: string;
  updated_at?: string;
};

export type TournamentEventRow = Omit<TournamentEvent, "state"> & {
  state: unknown;
};

const STANDING_LABELS: Record<TournamentPlace, string> = {
  first: "1º",
  second: "2º",
  third: "3º",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

function createGroup(id: TournamentGroupId): TournamentGroup {
  const players = Array.from({ length: 4 }, (_, index) => ({
    id: `${id}${index + 1}`,
    name: "",
    memberUserIds: ["", ""],
    pointsFor: 0,
    pointsAgainst: 0,
  }));

  return {
    id,
    name: `Grupo ${id}`,
    players,
    matches: createGroupMatches(id, players.map((player) => player.id)),
    standings: {
      first: "",
      second: "",
      third: "",
    },
  };
}

function createGroupMatches(
  groupId: TournamentGroupId,
  playerIds: string[]
): TournamentGroupMatch[] {
  const pairings = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ] as const;

  return pairings.map(([left, right], index) => ({
    id: `${groupId}-match-${index + 1}`,
    pair1Id: playerIds[left] ?? "",
    pair2Id: playerIds[right] ?? "",
    score: "",
  }));
}

function createMatch(params: {
  id: string;
  label: string;
  player1?: string;
  player2?: string;
  nextMatchId?: string;
  nextSlot?: 1 | 2;
}): TournamentMatch {
  return {
    id: params.id,
    label: params.label,
    player1: params.player1 ?? "",
    player2: params.player2 ?? "",
    score: "",
    winner: "",
    nextMatchId: params.nextMatchId,
    nextSlot: params.nextSlot,
  };
}

function createMainBracket(): TournamentBracket {
  return {
    title: "Cuadro principal",
    champion: "",
    rounds: [
      {
        id: "main-quarterfinals",
        title: "Cuartos",
        matches: [
          createMatch({
            id: "main-qf-1",
            label: "Cuarto 1",
            player1: "1º Grupo A",
            player2: "2º Grupo B",
            nextMatchId: "main-sf-1",
            nextSlot: 1,
          }),
          createMatch({
            id: "main-qf-2",
            label: "Cuarto 2",
            player1: "1º Grupo C",
            player2: "2º Grupo D",
            nextMatchId: "main-sf-1",
            nextSlot: 2,
          }),
          createMatch({
            id: "main-qf-3",
            label: "Cuarto 3",
            player1: "1º Grupo B",
            player2: "2º Grupo A",
            nextMatchId: "main-sf-2",
            nextSlot: 1,
          }),
          createMatch({
            id: "main-qf-4",
            label: "Cuarto 4",
            player1: "1º Grupo D",
            player2: "2º Grupo C",
            nextMatchId: "main-sf-2",
            nextSlot: 2,
          }),
        ],
      },
      {
        id: "main-semifinals",
        title: "Semifinales",
        matches: [
          createMatch({
            id: "main-sf-1",
            label: "Semifinal 1",
            player1: "Ganador cuarto 1",
            player2: "Ganador cuarto 2",
            nextMatchId: "main-final",
            nextSlot: 1,
          }),
          createMatch({
            id: "main-sf-2",
            label: "Semifinal 2",
            player1: "Ganador cuarto 3",
            player2: "Ganador cuarto 4",
            nextMatchId: "main-final",
            nextSlot: 2,
          }),
        ],
      },
      {
        id: "main-final-round",
        title: "Final",
        matches: [
          createMatch({
            id: "main-final",
            label: "Final",
            player1: "Ganador semifinal 1",
            player2: "Ganador semifinal 2",
          }),
        ],
      },
    ],
  };
}

function createConsolationBracket(): TournamentBracket {
  return {
    title: "Consolación",
    champion: "",
    rounds: [
      {
        id: "consolation-semifinals",
        title: "Semifinales",
        matches: [
          createMatch({
            id: "cons-sf-1",
            label: "Semifinal 1",
            player1: "3º Grupo A",
            player2: "3º Grupo B",
            nextMatchId: "cons-final",
            nextSlot: 1,
          }),
          createMatch({
            id: "cons-sf-2",
            label: "Semifinal 2",
            player1: "3º Grupo C",
            player2: "3º Grupo D",
            nextMatchId: "cons-final",
            nextSlot: 2,
          }),
        ],
      },
      {
        id: "consolation-final-round",
        title: "Final",
        matches: [
          createMatch({
            id: "cons-final",
            label: "Final",
            player1: "Ganador semifinal 1",
            player2: "Ganador semifinal 2",
          }),
        ],
      },
    ],
  };
}

export function createEmptyTournamentState(): TournamentState {
  return {
    version: 1,
    groups: TOURNAMENT_GROUP_IDS.map(createGroup),
    mainBracket: createMainBracket(),
    consolationBracket: createConsolationBracket(),
  };
}

function normalizeGroup(source: unknown, fallback: TournamentGroup) {
  const sourceRecord = isRecord(source) ? source : {};
  const sourcePlayers = Array.isArray(sourceRecord.players)
    ? sourceRecord.players
    : [];
  const sourceStandings = isRecord(sourceRecord.standings)
    ? sourceRecord.standings
    : {};
  const sourceMatches = Array.isArray(sourceRecord.matches)
    ? sourceRecord.matches
    : [];
  const sourceMatchesById = new Map<string, Record<string, unknown>>();

  for (const match of sourceMatches) {
    if (isRecord(match) && typeof match.id === "string") {
      sourceMatchesById.set(match.id, match);
    }
  }

  return {
    ...fallback,
    name: stringValue(sourceRecord.name, fallback.name),
    players: fallback.players.map((player, index) => {
      const sourcePlayer = sourcePlayers.find((candidate) => {
        return isRecord(candidate) && candidate.id === player.id;
      });
      const indexedPlayer = sourcePlayers[index];
      const row = isRecord(sourcePlayer)
        ? sourcePlayer
        : isRecord(indexedPlayer)
        ? indexedPlayer
        : {};

      return {
        id: player.id,
        name: stringValue(row.name),
        memberUserIds: normalizeMemberUserIds(row.memberUserIds),
        pointsFor: numberValue(row.pointsFor),
        pointsAgainst: numberValue(row.pointsAgainst),
      };
    }),
    matches: fallback.matches.map((match, index) => {
      const row = sourceMatchesById.get(match.id);
      const indexedRow = sourceMatches[index];
      const sourceMatch = isRecord(row)
        ? row
        : isRecord(indexedRow)
        ? indexedRow
        : {};

      return {
        id: match.id,
        pair1Id: stringValue(sourceMatch.pair1Id, match.pair1Id),
        pair2Id: stringValue(sourceMatch.pair2Id, match.pair2Id),
        score: stringValue(sourceMatch.score),
      };
    }),
    standings: {
      first: stringValue(sourceStandings.first),
      second: stringValue(sourceStandings.second),
      third: stringValue(sourceStandings.third),
    },
  } satisfies TournamentGroup;
}

function normalizeMemberUserIds(value: unknown) {
  const ids = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : ""))
    : [];

  return [ids[0] ?? "", ids[1] ?? ""];
}

function normalizeBracket(source: unknown, fallback: TournamentBracket) {
  const sourceRecord = isRecord(source) ? source : {};
  const sourceRounds = Array.isArray(sourceRecord.rounds)
    ? sourceRecord.rounds
    : [];
  const sourceMatches = new Map<string, Record<string, unknown>>();

  for (const round of sourceRounds) {
    if (!isRecord(round) || !Array.isArray(round.matches)) {
      continue;
    }

    for (const match of round.matches) {
      if (isRecord(match) && typeof match.id === "string") {
        sourceMatches.set(match.id, match);
      }
    }
  }

  return {
    ...fallback,
    champion: stringValue(sourceRecord.champion),
    rounds: fallback.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => {
        const sourceMatch = sourceMatches.get(match.id);

        if (!sourceMatch) {
          return match;
        }

        return {
          ...match,
          player1: stringValue(sourceMatch.player1, match.player1),
          player2: stringValue(sourceMatch.player2, match.player2),
          score: stringValue(sourceMatch.score),
          winner: stringValue(sourceMatch.winner),
        };
      }),
    })),
  } satisfies TournamentBracket;
}

export function normalizeTournamentState(value: unknown): TournamentState {
  const fallback = createEmptyTournamentState();

  if (!isRecord(value)) {
    return fallback;
  }

  const sourceGroups = Array.isArray(value.groups) ? value.groups : [];

  return {
    version: 1,
    groups: fallback.groups.map((group, index) => {
      const byId = sourceGroups.find((candidate) => {
        return isRecord(candidate) && candidate.id === group.id;
      });

      return normalizeGroup(byId ?? sourceGroups[index], group);
    }),
    mainBracket: normalizeBracket(value.mainBracket, fallback.mainBracket),
    consolationBracket: normalizeBracket(
      value.consolationBracket,
      fallback.consolationBracket
    ),
  };
}

export function normalizeTournamentEvent(row: TournamentEventRow) {
  return {
    ...row,
    state: syncBracketEntrantsFromStandings(normalizeTournamentState(row.state)),
  } satisfies TournamentEvent;
}

export function getNextSaturdayISODate(baseISO = getTodayClubISODate()) {
  if (!isISODate(baseISO)) {
    return getTodayClubISODate();
  }

  let cursor = baseISO;
  for (let offset = 0; offset < 7; offset += 1) {
    if (isSaturdayISO(cursor)) {
      return cursor;
    }

    cursor = addDaysToISODate(cursor, 1);
  }

  return baseISO;
}

export function createInitialTournamentPayload(params?: {
  slug?: string;
  name?: string;
  date?: string | null;
}) {
  return {
    slug: params?.slug ?? TORNEO_SABADO_SLUG,
    name: params?.name?.trim() || TOURNAMENT_DEFAULT_NAME,
    date: params?.date === null ? null : params?.date ?? getNextSaturdayISODate(),
    public_enabled: true,
    state: syncBracketEntrantsFromStandings(createEmptyTournamentState()),
  };
}

export function formatTournamentDate(dateISO: string | null | undefined) {
  if (!dateISO) {
    return "";
  }

  return formatDateLong(dateISO);
}

export function getGroupStandingName(
  state: TournamentState,
  groupId: TournamentGroupId,
  place: TournamentPlace,
  fallback = `${STANDING_LABELS[place]} Grupo ${groupId}`
) {
  const group = state.groups.find((candidate) => candidate.id === groupId);
  const playerId = group ? getGroupStandingPlayerId(group, place) : "";
  const playerName = group?.players.find((player) => player.id === playerId)?.name;

  return playerName?.trim() || fallback;
}

export function getTournamentPlayerDiff(player: TournamentPlayer) {
  return player.pointsFor - player.pointsAgainst;
}

export function parseTournamentScore(score: string) {
  const pairs = score.match(/\d+\s*[-:]\s*\d+/g) ?? [];
  let pointsFor = 0;
  let pointsAgainst = 0;
  let validPairs = 0;

  for (const pair of pairs) {
    const [left, right] = pair.split(/[-:]/).map((value) => Number(value.trim()));

    if (Number.isFinite(left) && Number.isFinite(right)) {
      validPairs += 1;
      pointsFor += left;
      pointsAgainst += right;
    }
  }

  return { pointsFor, pointsAgainst, valid: validPairs > 0 };
}

export function getGroupPlayerStats(group: TournamentGroup, playerId: string) {
  let pointsFor = 0;
  let pointsAgainst = 0;
  let played = 0;

  for (const match of group.matches) {
    if (match.pair1Id !== playerId && match.pair2Id !== playerId) {
      continue;
    }

    const parsed = parseTournamentScore(match.score);
    if (!parsed.valid) {
      continue;
    }

    played += 1;

    if (match.pair1Id === playerId) {
      pointsFor += parsed.pointsFor;
      pointsAgainst += parsed.pointsAgainst;
    } else {
      pointsFor += parsed.pointsAgainst;
      pointsAgainst += parsed.pointsFor;
    }
  }

  const player = group.players.find((candidate) => candidate.id === playerId);

  if (played === 0 && player) {
    pointsFor = player.pointsFor;
    pointsAgainst = player.pointsAgainst;
  }

  return {
    played,
    pointsFor,
    pointsAgainst,
    diff: pointsFor - pointsAgainst,
  };
}

export function getSortedGroupPlayers(group: TournamentGroup) {
  return [...group.players].sort((a, b) => {
    const statsA = getGroupPlayerStats(group, a.id);
    const statsB = getGroupPlayerStats(group, b.id);
    const diff = statsB.diff - statsA.diff;
    if (diff !== 0) {
      return diff;
    }

    const pointsFor = statsB.pointsFor - statsA.pointsFor;
    if (pointsFor !== 0) {
      return pointsFor;
    }

    return a.id.localeCompare(b.id);
  });
}

export function getGroupStandingPlayerId(
  group: TournamentGroup,
  place: TournamentPlace
) {
  const indexByPlace: Record<TournamentPlace, number> = {
    first: 0,
    second: 1,
    third: 2,
  };

  return getSortedGroupPlayers(group)[indexByPlace[place]]?.id ?? "";
}

export function isTournamentGroupComplete(group: TournamentGroup) {
  return (
    group.matches.length > 0 &&
    group.matches.every((match) => parseTournamentScore(match.score).valid)
  );
}

function cloneState(state: TournamentState): TournamentState {
  return JSON.parse(JSON.stringify(state)) as TournamentState;
}

function findMatch(bracket: TournamentBracket, matchId: string) {
  for (const round of bracket.rounds) {
    const match = round.matches.find((candidate) => candidate.id === matchId);

    if (match) {
      return match;
    }
  }

  return null;
}

function assignMatchPlayer(
  bracket: TournamentBracket,
  matchId: string,
  slot: 1 | 2,
  value: string
) {
  const match = findMatch(bracket, matchId);

  if (!match) {
    return;
  }

  if (slot === 1) {
    match.player1 = value;
  } else {
    match.player2 = value;
  }
}

function clearMatchWinnerAndDownstream(
  bracket: TournamentBracket,
  match: TournamentMatch
) {
  const previousWinner = match.winner.trim();

  match.score = "";
  match.winner = "";

  if (!match.nextMatchId || !match.nextSlot || !previousWinner) {
    if (!match.nextMatchId) {
      bracket.champion = "";
    }

    return;
  }

  const nextMatch = findMatch(bracket, match.nextMatchId);
  const currentNextPlayer =
    match.nextSlot === 1 ? nextMatch?.player1 : nextMatch?.player2;

  if (nextMatch && currentNextPlayer?.trim() === previousWinner) {
    assignMatchPlayer(bracket, nextMatch.id, match.nextSlot, "");
    clearMatchWinnerAndDownstream(bracket, nextMatch);
  }
}

function assignBracketEntrant(
  bracket: TournamentBracket,
  matchId: string,
  slot: 1 | 2,
  value: string
) {
  const match = findMatch(bracket, matchId);

  if (!match) {
    return;
  }

  const previousValue = slot === 1 ? match.player1 : match.player2;
  assignMatchPlayer(bracket, matchId, slot, value);

  if (previousValue.trim() !== value.trim()) {
    clearMatchWinnerAndDownstream(bracket, match);
  }
}

function getReadyGroupStandingName(
  state: TournamentState,
  groupId: TournamentGroupId,
  place: TournamentPlace
) {
  const group = state.groups.find((candidate) => candidate.id === groupId);

  if (!group || !isTournamentGroupComplete(group)) {
    return "";
  }

  return getGroupStandingName(state, groupId, place, "");
}

export function syncBracketEntrantsFromStandings(state: TournamentState) {
  const next = cloneState(normalizeTournamentState(state));

  assignBracketEntrant(
    next.mainBracket,
    "main-qf-1",
    1,
    getReadyGroupStandingName(next, "A", "first")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-1",
    2,
    getReadyGroupStandingName(next, "B", "second")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-2",
    1,
    getReadyGroupStandingName(next, "C", "first")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-2",
    2,
    getReadyGroupStandingName(next, "D", "second")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-3",
    1,
    getReadyGroupStandingName(next, "B", "first")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-3",
    2,
    getReadyGroupStandingName(next, "A", "second")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-4",
    1,
    getReadyGroupStandingName(next, "D", "first")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-4",
    2,
    getReadyGroupStandingName(next, "C", "second")
  );

  assignBracketEntrant(
    next.consolationBracket,
    "cons-sf-1",
    1,
    getReadyGroupStandingName(next, "A", "third")
  );
  assignBracketEntrant(
    next.consolationBracket,
    "cons-sf-1",
    2,
    getReadyGroupStandingName(next, "B", "third")
  );
  assignBracketEntrant(
    next.consolationBracket,
    "cons-sf-2",
    1,
    getReadyGroupStandingName(next, "C", "third")
  );
  assignBracketEntrant(
    next.consolationBracket,
    "cons-sf-2",
    2,
    getReadyGroupStandingName(next, "D", "third")
  );

  return next;
}

export function updateTournamentMatch(
  state: TournamentState,
  bracketKey: TournamentBracketKey,
  matchId: string,
  updates: Partial<Pick<TournamentMatch, "player1" | "player2" | "score">>
) {
  const next = cloneState(normalizeTournamentState(state));
  const match = findMatch(next[bracketKey], matchId);

  if (!match) {
    return next;
  }

  if (typeof updates.player1 === "string") {
    match.player1 = updates.player1;
  }

  if (typeof updates.player2 === "string") {
    match.player2 = updates.player2;
  }

  if (typeof updates.score === "string") {
    match.score = updates.score;
  }

  return next;
}

export function updateTournamentMatchWinner(
  state: TournamentState,
  bracketKey: TournamentBracketKey,
  matchId: string,
  winner: string
) {
  const next = cloneState(normalizeTournamentState(state));
  const bracket = next[bracketKey];
  const match = findMatch(bracket, matchId);
  const cleanWinner = winner.trim();

  if (!match) {
    return next;
  }

  const previousWinner = match.winner.trim();
  match.winner = cleanWinner;

  if (match.nextMatchId && match.nextSlot && cleanWinner) {
    assignMatchPlayer(bracket, match.nextMatchId, match.nextSlot, cleanWinner);
  } else if (match.nextMatchId && match.nextSlot && previousWinner) {
    const nextMatch = findMatch(bracket, match.nextMatchId);
    const currentNextPlayer =
      match.nextSlot === 1 ? nextMatch?.player1 : nextMatch?.player2;

    if (currentNextPlayer?.trim() === previousWinner) {
      assignMatchPlayer(bracket, match.nextMatchId, match.nextSlot, "");
    }
  } else if (!match.nextMatchId) {
    bracket.champion = cleanWinner;
  }

  return next;
}
