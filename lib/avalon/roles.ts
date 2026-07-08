import type { OptionalRole } from "./types";

export const ROLE_LABELS: Record<string, string> = {
  merlin: "梅林",
  percival: "派西維爾",
  loyal: "亞瑟的忠誠騎士",
  morgana: "莫甘娜",
  mordred: "莫德雷德",
  oberon: "奧伯倫",
  assassin: "刺客",
  minion: "莫德雷德的爪牙",
};

// 中文別名 -> optional role key，讓開始遊戲時可以用中文指定角色
export const OPTIONAL_ROLE_ALIASES: Record<string, OptionalRole> = {
  派西維爾: "percival",
  莫甘娜: "morgana",
  莫德雷德: "mordred",
  奧伯倫: "oberon",
};

type PlayerCountConfig = {
  good: number;
  evil: number;
  missionSizes: [number, number, number, number, number];
  doubleFailRound: number | null; // 0-indexed round that needs 2 fails, or null
};

export const PLAYER_COUNT_CONFIG: Record<number, PlayerCountConfig> = {
  5: { good: 3, evil: 2, missionSizes: [2, 3, 2, 3, 3], doubleFailRound: null },
  6: { good: 4, evil: 2, missionSizes: [2, 3, 4, 3, 4], doubleFailRound: null },
  7: { good: 4, evil: 3, missionSizes: [2, 3, 3, 4, 4], doubleFailRound: 3 },
  8: { good: 5, evil: 3, missionSizes: [3, 4, 4, 5, 5], doubleFailRound: 3 },
  9: { good: 6, evil: 3, missionSizes: [3, 4, 4, 5, 5], doubleFailRound: 3 },
  10: { good: 6, evil: 4, missionSizes: [3, 4, 4, 5, 5], doubleFailRound: 3 },
};

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

export function missionSize(playerCount: number, round: number): number {
  return PLAYER_COUNT_CONFIG[playerCount].missionSizes[round];
}

export function failsNeeded(playerCount: number, round: number): number {
  return PLAYER_COUNT_CONFIG[playerCount].doubleFailRound === round ? 2 : 1;
}

export function goodEvilCount(playerCount: number): { good: number; evil: number } {
  const cfg = PLAYER_COUNT_CONFIG[playerCount];
  return { good: cfg.good, evil: cfg.evil };
}
