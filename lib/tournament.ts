import {
  addDaysToISODate,
  formatDateLong,
  getTodayClubISODate,
  isISODate,
  isSaturdayISO,
} from "./booking-window";

export const TORNEO_SLUG = "torneo";
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
  court: string;
  startTime: string;
  endTime: string;
  score: string;
};

export type TournamentGroup = {
  id: TournamentGroupId;
  name: string;
  court: string;
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
  court: string;
  startTime: string;
  endTime: string;
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

const GROUP_COURTS: Record<TournamentGroupId, string> = {
  A: "Pista 1",
  B: "Pista 2",
  C: "Pista 3",
  D: "Pista 4",
};

const GROUP_MATCH_SLOTS = [
  { startTime: "17:30", endTime: "17:55" },
  { startTime: "17:55", endTime: "18:20" },
  { startTime: "18:20", endTime: "18:45" },
  { startTime: "18:45", endTime: "19:10" },
  { startTime: "19:10", endTime: "19:35" },
  { startTime: "19:35", endTime: "20:00" },
] as const;

const GROUP_PAIRINGS = [
  [0, 3],
  [1, 2],
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["\u00c2\u00ba", "º"],
  ["\u00c2\u00aa", "ª"],
  ["\u00c2\u00bf", "¿"],
  ["\u00c2\u00a1", "¡"],
  ["\u00c3\u00a0", "à"],
  ["\u00c3\u00a1", "á"],
  ["\u00c3\u00a8", "è"],
  ["\u00c3\u00a9", "é"],
  ["\u00c3\u00ad", "í"],
  ["\u00c3\u00b1", "ñ"],
  ["\u00c3\u00b2", "ò"],
  ["\u00c3\u00b3", "ó"],
  ["\u00c3\u00ba", "ú"],
  ["\u00c3\u00bc", "ü"],
  ["\u00c3\u0081", "Á"],
  ["\u00c3\u0089", "É"],
  ["\u00c3\u008d", "Í"],
  ["\u00c3\u0091", "Ñ"],
  ["\u00c3\u0093", "Ó"],
  ["\u00c3\u009a", "Ú"],
  ["\u00c3\u009c", "Ü"],
  ["\u00c3\u0153", "Ü"],
  ["\u00c3\u20ac", "À"],
  ["\u00c3\u2030", "É"],
  ["\u00c3\u02c6", "È"],
  ["\u00c3\u2018", "Ñ"],
  ["\u00c3\u201c", "Ó"],
  ["\u00c3\u2019", "Ò"],
  ["\u00c3\u0161", "Ú"],
];

export function repairMojibakeText(value: string) {
  if (!/[\u00c2\u00c3]/.test(value)) {
    return value;
  }

  return MOJIBAKE_REPLACEMENTS.reduce(
    (next, [bad, good]) => next.split(bad).join(good),
    value
  );
}

function stringValue(value: unknown, fallback = "") {
  return repairMojibakeText(typeof value === "string" ? value : fallback);
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
    court: GROUP_COURTS[id],
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
  return GROUP_PAIRINGS.map(([left, right], index) => ({
    id: `${groupId}-match-${index + 1}`,
    pair1Id: playerIds[left] ?? "",
    pair2Id: playerIds[right] ?? "",
    court: GROUP_COURTS[groupId],
    startTime: GROUP_MATCH_SLOTS[index]?.startTime ?? "",
    endTime: GROUP_MATCH_SLOTS[index]?.endTime ?? "",
    score: "",
  }));
}

function createMatch(params: {
  id: string;
  label: string;
  player1?: string;
  player2?: string;
  court: string;
  startTime: string;
  endTime: string;
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
    court: params.court,
    startTime: params.startTime,
    endTime: params.endTime,
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
            label: "Cuartos Pista 1",
            player1: "1º Grupo A",
            player2: "2º Grupo D",
            court: "Pista 1",
            startTime: "20:15",
            endTime: "20:40",
            nextMatchId: "main-sf-1",
            nextSlot: 1,
          }),
          createMatch({
            id: "main-qf-2",
            label: "Cuartos Pista 2",
            player1: "2º Grupo B",
            player2: "1º Grupo C",
            court: "Pista 2",
            startTime: "20:15",
            endTime: "20:40",
            nextMatchId: "main-sf-1",
            nextSlot: 2,
          }),
          createMatch({
            id: "main-qf-3",
            label: "Cuartos Pista 3",
            player1: "1º Grupo B",
            player2: "2º Grupo C",
            court: "Pista 3",
            startTime: "20:15",
            endTime: "20:40",
            nextMatchId: "main-sf-2",
            nextSlot: 1,
          }),
          createMatch({
            id: "main-qf-4",
            label: "Cuartos Pista 4",
            player1: "2º Grupo A",
            player2: "1º Grupo D",
            court: "Pista 4",
            startTime: "20:15",
            endTime: "20:40",
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
            label: "Semifinal Pista 1",
            player1: "Ganador Cuartos Pista 1",
            player2: "Ganador Cuartos Pista 2",
            court: "Pista 1",
            startTime: "20:40",
            endTime: "21:05",
            nextMatchId: "main-final",
            nextSlot: 1,
          }),
          createMatch({
            id: "main-sf-2",
            label: "Semifinal Pista 2",
            player1: "Ganador Cuartos Pista 3",
            player2: "Ganador Cuartos Pista 4",
            court: "Pista 2",
            startTime: "20:40",
            endTime: "21:05",
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
            player1: "Ganador Semifinal Pista 1",
            player2: "Ganador Semifinal Pista 2",
            court: "Pista 1",
            startTime: "21:05",
            endTime: "21:30",
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
            label: "Semifinal Consolación Pista 3",
            player1: "3º Grupo A",
            player2: "3º Grupo C",
            court: "Pista 3",
            startTime: "20:40",
            endTime: "21:05",
            nextMatchId: "cons-final",
            nextSlot: 1,
          }),
          createMatch({
            id: "cons-sf-2",
            label: "Semifinal Consolación Pista 4",
            player1: "3º Grupo B",
            player2: "3º Grupo D",
            court: "Pista 4",
            startTime: "20:40",
            endTime: "21:05",
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
            player1: "Ganador Semi Consolación Pista 3",
            player2: "Ganador Semi Consolación Pista 4",
            court: "Pista 3",
            startTime: "21:05",
            endTime: "21:30",
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
  const sourceMatchesByPair = new Map<string, Record<string, unknown>>();

  for (const match of sourceMatches) {
    if (isRecord(match) && typeof match.id === "string") {
      sourceMatchesById.set(match.id, match);
    }

    if (
      isRecord(match) &&
      typeof match.pair1Id === "string" &&
      typeof match.pair2Id === "string"
    ) {
      sourceMatchesByPair.set(getPairKey(match.pair1Id, match.pair2Id), match);
    }
  }

  return {
    ...fallback,
    name: stringValue(sourceRecord.name, fallback.name),
    court: stringValue(sourceRecord.court, fallback.court),
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
      const row =
        sourceMatchesByPair.get(getPairKey(match.pair1Id, match.pair2Id)) ??
        sourceMatchesById.get(match.id);
      const indexedRow = sourceMatches[index];
      const sourceMatch = isRecord(row)
        ? row
        : isRecord(indexedRow)
        ? indexedRow
        : {};

      return {
        id: match.id,
        pair1Id: match.pair1Id,
        pair2Id: match.pair2Id,
        court: stringValue(sourceMatch.court, match.court),
        startTime: stringValue(sourceMatch.startTime, match.startTime),
        endTime: stringValue(sourceMatch.endTime, match.endTime),
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

function getPairKey(left: string, right: string) {
  return [left, right].sort().join("::");
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
          court: stringValue(sourceMatch.court, match.court),
          startTime: stringValue(sourceMatch.startTime, match.startTime),
          endTime: stringValue(sourceMatch.endTime, match.endTime),
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
    name: repairMojibakeText(row.name),
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
    slug: params?.slug ?? TORNEO_SLUG,
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
  const fallback = `${STANDING_LABELS[place]} Grupo ${groupId}`;

  if (!group || !isTournamentGroupComplete(group)) {
    return fallback;
  }

  return getGroupStandingName(state, groupId, place, fallback);
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
    getReadyGroupStandingName(next, "D", "second")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-2",
    1,
    getReadyGroupStandingName(next, "B", "second")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-2",
    2,
    getReadyGroupStandingName(next, "C", "first")
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
    getReadyGroupStandingName(next, "C", "second")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-4",
    1,
    getReadyGroupStandingName(next, "A", "second")
  );
  assignBracketEntrant(
    next.mainBracket,
    "main-qf-4",
    2,
    getReadyGroupStandingName(next, "D", "first")
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
    getReadyGroupStandingName(next, "C", "third")
  );
  assignBracketEntrant(
    next.consolationBracket,
    "cons-sf-2",
    1,
    getReadyGroupStandingName(next, "B", "third")
  );
  assignBracketEntrant(
    next.consolationBracket,
    "cons-sf-2",
    2,
    getReadyGroupStandingName(next, "D", "third")
  );

  return next;
}

function findGroupMatchByPair(
  group: TournamentGroup,
  pair1Id: string,
  pair2Id: string
) {
  const pairKey = getPairKey(pair1Id, pair2Id);

  return group.matches.find((match) => {
    return getPairKey(match.pair1Id, match.pair2Id) === pairKey;
  });
}

function getBracketMatchesInOrder(bracket: TournamentBracket) {
  return bracket.rounds.flatMap((round) => round.matches);
}

function haveSameEntrants(left: TournamentMatch, right: TournamentMatch) {
  return (
    left.player1.trim() === right.player1.trim() &&
    left.player2.trim() === right.player2.trim()
  );
}

function preserveBracketResultsWhenEntrantsMatch(
  state: TournamentState,
  bracketKey: TournamentBracketKey,
  sourceBracket: TournamentBracket
) {
  let next = state;

  for (const targetMatch of getBracketMatchesInOrder(state[bracketKey])) {
    const sourceMatch = findMatch(sourceBracket, targetMatch.id);

    if (!sourceMatch || !haveSameEntrants(targetMatch, sourceMatch)) {
      continue;
    }

    if (sourceMatch.score) {
      next = updateTournamentMatch(next, bracketKey, targetMatch.id, {
        score: sourceMatch.score,
      });
    }

    if (sourceMatch.winner) {
      next = updateTournamentMatchWinner(
        next,
        bracketKey,
        targetMatch.id,
        sourceMatch.winner
      );
    }
  }

  return next;
}

export function applyOfficialTournamentStructure(state: TournamentState) {
  const current = normalizeTournamentState(state);
  const official = createEmptyTournamentState();
  const officialState: TournamentState = {
    version: 1,
    groups: official.groups.map((officialGroup) => {
      const currentGroup =
        current.groups.find((group) => group.id === officialGroup.id) ??
        officialGroup;

      return {
        ...officialGroup,
        players: officialGroup.players.map((officialPlayer) => {
          return (
            currentGroup.players.find((player) => player.id === officialPlayer.id) ??
            officialPlayer
          );
        }),
        matches: officialGroup.matches.map((officialMatch) => {
          const currentMatch = findGroupMatchByPair(
            currentGroup,
            officialMatch.pair1Id,
            officialMatch.pair2Id
          );

          return {
            ...officialMatch,
            score: currentMatch?.score ?? "",
          };
        }),
        standings: currentGroup.standings,
      };
    }),
    mainBracket: official.mainBracket,
    consolationBracket: official.consolationBracket,
  };
  let next = syncBracketEntrantsFromStandings(officialState);

  next = preserveBracketResultsWhenEntrantsMatch(
    next,
    "mainBracket",
    current.mainBracket
  );
  next = preserveBracketResultsWhenEntrantsMatch(
    next,
    "consolationBracket",
    current.consolationBracket
  );

  return next;
}

export function updateTournamentMatch(
  state: TournamentState,
  bracketKey: TournamentBracketKey,
  matchId: string,
  updates: Partial<
    Pick<
      TournamentMatch,
      "player1" | "player2" | "score" | "court" | "startTime" | "endTime"
    >
  >
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

  if (typeof updates.court === "string") {
    match.court = updates.court;
  }

  if (typeof updates.startTime === "string") {
    match.startTime = updates.startTime;
  }

  if (typeof updates.endTime === "string") {
    match.endTime = updates.endTime;
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
