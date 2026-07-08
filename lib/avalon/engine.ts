import { randomBytes, randomInt } from "crypto";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  failsNeeded,
  goodEvilCount,
  missionSize,
} from "./roles";
import type { GameState, OptionalRole, Player, Role } from "./types";

export function newToken(): string {
  return randomBytes(16).toString("base64url");
}

export function createLobbyState(): GameState {
  return {
    phase: "lobby",
    players: [],
    optionalRoles: [],
    leaderIndex: 0,
    round: 0,
    proposalCount: 0,
    team: [],
    votes: {},
    missionCards: {},
    missionResults: [],
    rejectStreak: 0,
  };
}

export function alignment(role: Role): "good" | "evil" {
  return role === "merlin" || role === "percival" || role === "loyal"
    ? "good"
    : "evil";
}

export function addPlayer(
  state: GameState,
  userId: string,
  name: string
): { state: GameState; error?: string } {
  if (state.phase !== "lobby") {
    return { state, error: "遊戲已經開始了，等這局結束再加入吧。" };
  }
  if (state.players.some((p) => p.userId === userId)) {
    return { state, error: `${name} 已經在名單裡了。` };
  }
  if (state.players.length >= MAX_PLAYERS) {
    return { state, error: `人數已達上限（${MAX_PLAYERS} 人）。` };
  }
  const player: Player = { userId, name, token: newToken(), joinedAt: Date.now() };
  return { state: { ...state, players: [...state.players, player] } };
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function startGame(
  state: GameState,
  optionalRoles: OptionalRole[]
): { state: GameState; error?: string } {
  if (state.phase !== "lobby") {
    return { state, error: "遊戲已經在進行中了。" };
  }
  const count = state.players.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    return {
      state,
      error: `阿瓦隆需要 ${MIN_PLAYERS}-${MAX_PLAYERS} 人，目前只有 ${count} 人加入。`,
    };
  }

  const { good, evil } = goodEvilCount(count);
  const evilRoles: Role[] = [];
  if (optionalRoles.includes("mordred")) evilRoles.push("mordred");
  if (optionalRoles.includes("morgana")) evilRoles.push("morgana");
  if (optionalRoles.includes("oberon")) evilRoles.push("oberon");
  evilRoles.push("assassin");
  while (evilRoles.length < evil) evilRoles.push("minion");

  const goodRoles: Role[] = ["merlin"];
  if (optionalRoles.includes("percival")) goodRoles.push("percival");
  while (goodRoles.length < good) goodRoles.push("loyal");

  const shuffledPlayers = shuffle(state.players);
  const roles = shuffle([...goodRoles, ...evilRoles]);
  const players = shuffledPlayers.map((p, i) => ({ ...p, role: roles[i] }));
  // 保留原本加入順序，只是身分是隨機發的
  const orderedPlayers = state.players.map(
    (orig) => players.find((p) => p.userId === orig.userId)!
  );

  return {
    state: {
      ...state,
      phase: "team-building",
      players: orderedPlayers,
      optionalRoles,
      leaderIndex: 0,
      round: 0,
      team: [],
      votes: {},
      missionCards: {},
      missionResults: [],
      rejectStreak: 0,
      winner: undefined,
      winReason: undefined,
    },
  };
}

export function currentLeader(state: GameState): Player | undefined {
  return state.players[state.leaderIndex];
}

export function proposeTeam(
  state: GameState,
  leaderUserId: string,
  targetNumbers: number[]
): { state: GameState; error?: string } {
  if (state.phase !== "team-building") {
    return { state, error: "現在不是選隊員的時機。" };
  }
  const leader = currentLeader(state);
  if (!leader || leader.userId !== leaderUserId) {
    return { state, error: `現在的隊長是 ${leader?.name ?? "未知"}，只有隊長能出隊。` };
  }
  const size = missionSize(state.players.length, state.round);
  if (targetNumbers.length !== size) {
    return { state, error: `這輪任務需要 ${size} 人，你選了 ${targetNumbers.length} 人。` };
  }
  const uniqueNumbers = new Set(targetNumbers);
  if (uniqueNumbers.size !== targetNumbers.length) {
    return { state, error: "隊員不能重複。" };
  }
  const userIds: string[] = [];
  for (const n of targetNumbers) {
    const player = state.players[n - 1];
    if (!player) {
      return { state, error: `編號 ${n} 不存在，用「阿瓦隆 名單」查看編號。` };
    }
    userIds.push(player.userId);
  }
  return {
    state: { ...state, phase: "voting", team: userIds, votes: {} },
  };
}

export function castVote(
  state: GameState,
  userId: string,
  approve: boolean
): { state: GameState; error?: string; resolved?: boolean } {
  if (state.phase !== "voting") {
    return { state, error: "現在不是投票時機。" };
  }
  if (!state.players.some((p) => p.userId === userId)) {
    return { state, error: "你不在這局遊戲裡。" };
  }
  if (state.votes[userId] !== undefined) {
    return { state, error: "你已經投過票了。" };
  }
  const votes = { ...state.votes, [userId]: approve };
  let next: GameState = { ...state, votes };
  let resolved = false;
  if (Object.keys(votes).length === state.players.length) {
    next = resolveVote(next);
    resolved = true;
  }
  return { state: next, resolved };
}

function resolveVote(state: GameState): GameState {
  const approvals = Object.values(state.votes).filter(Boolean).length;
  const approved = approvals * 2 > state.players.length;

  if (approved) {
    return { ...state, phase: "mission", missionCards: {}, rejectStreak: 0 };
  }

  const rejectStreak = state.rejectStreak + 1;
  if (rejectStreak >= 5) {
    return {
      ...state,
      phase: "finished",
      winner: "evil",
      winReason: "連續 5 次出隊提案被否決，邪惡陣營獲勝。",
    };
  }
  return {
    ...state,
    phase: "team-building",
    team: [],
    votes: {},
    rejectStreak,
    leaderIndex: (state.leaderIndex + 1) % state.players.length,
  };
}

export function submitMissionCard(
  state: GameState,
  userId: string,
  success: boolean
): { state: GameState; error?: string; resolved?: boolean } {
  if (state.phase !== "mission") {
    return { state, error: "現在不是執行任務的時機。" };
  }
  if (!state.team.includes(userId)) {
    return { state, error: "你不在這次出隊的隊員裡。" };
  }
  if (state.missionCards[userId] !== undefined) {
    return { state, error: "你已經出過牌了。" };
  }
  const player = state.players.find((p) => p.userId === userId);
  const forcedSuccess = player ? alignment(player.role!) === "good" : true;
  const missionCards = {
    ...state.missionCards,
    [userId]: forcedSuccess ? true : success,
  };
  let next: GameState = { ...state, missionCards };
  let resolved = false;
  if (Object.keys(missionCards).length === state.team.length) {
    next = resolveMission(next);
    resolved = true;
  }
  return { state: next, resolved };
}

function resolveMission(state: GameState): GameState {
  const fails = Object.values(state.missionCards).filter((v) => !v).length;
  const needed = failsNeeded(state.players.length, state.round);
  const passed = fails < needed;
  const missionResults = [
    ...state.missionResults,
    { team: state.team, fails, passed },
  ];

  const passCount = missionResults.filter((m) => m.passed).length;
  const failCount = missionResults.filter((m) => !m.passed).length;

  if (failCount >= 3) {
    return {
      ...state,
      missionResults,
      phase: "finished",
      winner: "evil",
      winReason: "邪惡陣營破壞了 3 次任務，獲勝。",
    };
  }

  if (passCount >= 3) {
    const hasAssassin = state.players.some((p) => p.role === "assassin");
    if (!hasAssassin) {
      return {
        ...state,
        missionResults,
        phase: "finished",
        winner: "good",
        winReason: "正義陣營完成 3 次任務，獲勝。",
      };
    }
    return { ...state, missionResults, phase: "assassin" };
  }

  return {
    ...state,
    missionResults,
    phase: "team-building",
    round: state.round + 1,
    team: [],
    votes: {},
    missionCards: {},
    leaderIndex: (state.leaderIndex + 1) % state.players.length,
  };
}

export function submitAssassinGuess(
  state: GameState,
  assassinUserId: string,
  targetNumber: number
): { state: GameState; error?: string } {
  if (state.phase !== "assassin") {
    return { state, error: "現在不是刺客指認的時機。" };
  }
  const assassin = state.players.find((p) => p.userId === assassinUserId);
  if (!assassin || assassin.role !== "assassin") {
    return { state, error: "只有刺客能指認梅林。" };
  }
  const target = state.players[targetNumber - 1];
  if (!target) {
    return { state, error: `編號 ${targetNumber} 不存在，用「阿瓦隆 名單」查看編號。` };
  }
  const correct = target.role === "merlin";
  return {
    state: {
      ...state,
      phase: "finished",
      assassinTarget: target.userId,
      winner: correct ? "evil" : "good",
      winReason: correct
        ? `刺客正確指認 ${target.name} 是梅林，邪惡陣營逆轉獲勝。`
        : `刺客指認 ${target.name}，但猜錯了，正義陣營獲勝。`,
    },
  };
}
