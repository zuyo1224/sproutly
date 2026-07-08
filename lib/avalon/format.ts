import { ROLE_LABELS } from "./roles";
import { currentLeader } from "./engine";
import { missionSize } from "./roles";
import type { GameState } from "./types";

export function formatPlayerList(state: GameState): string {
  if (state.players.length === 0) return "目前還沒有人加入，輸入「阿瓦隆 加入」開始報名。";
  const lines = state.players.map((p, i) => {
    const isLeader = state.phase !== "lobby" && i === state.leaderIndex;
    return `${i + 1}. ${p.name}${isLeader ? "（隊長）" : ""}`;
  });
  return lines.join("\n");
}

export function formatMissionOverview(state: GameState): string {
  const size = missionSize(state.players.length, state.round);
  const passCount = state.missionResults.filter((m) => m.passed).length;
  const failCount = state.missionResults.filter((m) => !m.passed).length;
  return `第 ${state.round + 1} 輪任務（需要 ${size} 人）｜正義 ${passCount} 勝 / 邪惡 ${failCount} 勝｜連續否決 ${state.rejectStreak} 次`;
}

export function formatTeamPrompt(state: GameState): string {
  const leader = currentLeader(state);
  return [
    formatMissionOverview(state),
    `隊長 ${leader?.name ?? "?"} 請選人，例如「阿瓦隆 出隊 1 3 5」`,
    formatPlayerList(state),
  ].join("\n\n");
}

export function formatTeamProposed(state: GameState): string {
  const teamNames = state.team
    .map((id) => state.players.find((p) => p.userId === id)?.name ?? "?")
    .join("、");
  return [
    `隊長提議出隊：${teamNames}`,
    "請大家用「阿瓦隆 同意」或「阿瓦隆 反對」投票。",
  ].join("\n");
}

export function formatVoteProgress(state: GameState): string {
  return `已有 ${Object.keys(state.votes).length}/${state.players.length} 人投票。`;
}

export function formatVoteResolved(state: GameState, approved: boolean): string {
  if (approved) {
    return [
      "✅ 提案通過，任務出發！",
      "出隊的隊員請留意 LINE 私訊，選擇任務成功／失敗。",
    ].join("\n");
  }
  if (state.phase === "finished") {
    return `❌ 提案被否決。${state.winReason ?? ""}`;
  }
  return [
    "❌ 提案被否決，換下一位隊長重新提議。",
    formatTeamPrompt(state),
  ].join("\n");
}

export function formatMissionResolved(state: GameState): string {
  const last = state.missionResults[state.missionResults.length - 1];
  const summary = last.passed
    ? `✅ 任務成功（${last.fails} 張失敗票）`
    : `❌ 任務失敗（${last.fails} 張失敗票）`;

  if (state.phase === "assassin") {
    return [
      summary,
      "正義陣營已完成 3 次任務！最後一刻——刺客要指認誰是梅林。",
      "（等待刺客私訊回覆）",
    ].join("\n");
  }
  if (state.phase === "finished") {
    return [summary, `🏁 ${state.winReason ?? ""}`, formatFinalReveal(state)].join(
      "\n"
    );
  }
  return [summary, formatTeamPrompt(state)].join("\n\n");
}

export function formatFinalReveal(state: GameState): string {
  const lines = state.players.map(
    (p) => `${p.name}：${ROLE_LABELS[p.role ?? ""] ?? "?"}`
  );
  return ["各位的真實身分：", ...lines].join("\n");
}

export function formatAssassinResolved(state: GameState): string {
  return [
    state.winner === "evil" ? "🗡️ 刺客猜對了！" : "🛡️ 刺客猜錯了！",
    `🏁 ${state.winReason ?? ""}`,
    formatFinalReveal(state),
  ].join("\n");
}

export const HELP_TEXT = [
  "🗡️ 阿瓦隆機器人指令（在群組輸入）：",
  "「阿瓦隆 加入」— 報名加入這局",
  "「阿瓦隆 開始」— 開局（可加角色，例如「阿瓦隆 開始 派西維爾 莫甘娜」）",
  "「阿瓦隆 名單」— 查看目前玩家編號",
  "「阿瓦隆 出隊 1 3 5」— 隊長選出隊隊員（用編號）",
  "「阿瓦隆 同意」／「阿瓦隆 反對」— 對出隊提案投票",
  "「阿瓦隆 重置」— 重新開一局",
  "",
  "身分會用 LINE 私訊發給你一個專屬連結，記得先加機器人好友才收得到訊息。",
  "執行任務／刺客指認會在私訊用按鈕回覆，不會洩漏給其他人。",
].join("\n");
