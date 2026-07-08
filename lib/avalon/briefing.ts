import { ROLE_LABELS } from "./roles";
import { alignment } from "./engine";
import type { GameState, Player } from "./types";

function names(players: Player[]): string {
  return players.map((p) => p.name).join("、");
}

// 每個玩家私人可見的身分說明，套用阿瓦隆標準的「誰看得到誰」規則
export function roleBriefing(state: GameState, userId: string): string {
  const player = state.players.find((p) => p.userId === userId);
  if (!player || !player.role) return "身分尚未指派。";

  const role = player.role;
  const label = ROLE_LABELS[role];
  const side = alignment(role) === "good" ? "正義陣營" : "邪惡陣營";
  const lines = [`你的身分：${label}（${side}）`];

  const evilPlayers = state.players.filter(
    (p) => p.role && alignment(p.role) === "evil"
  );

  switch (role) {
    case "merlin": {
      const visible = evilPlayers.filter((p) => p.role !== "mordred");
      lines.push(
        visible.length > 0
          ? `你看得到的邪惡陣營成員（莫德雷德會躲過你的視線）：${names(visible)}`
          : "沒有邪惡陣營成員在莫德雷德以外可見。"
      );
      lines.push("小心別表現得太明顯，刺客會在最後指認你。");
      break;
    }
    case "percival": {
      const merlin = state.players.find((p) => p.role === "merlin");
      const morgana = state.players.find((p) => p.role === "morgana");
      const candidates = [merlin, morgana].filter(Boolean) as Player[];
      if (candidates.length === 2) {
        lines.push(
          `梅林與莫甘娜其中兩人是：${names(candidates)}（你無法分辨誰是誰）。`
        );
      } else if (merlin) {
        lines.push(`梅林是：${merlin.name}`);
      } else {
        lines.push("這局沒有梅林。");
      }
      break;
    }
    case "loyal": {
      lines.push("你沒有額外資訊，靠觀察大家的投票與行為來判斷吧。");
      break;
    }
    case "oberon": {
      lines.push("你不知道其他邪惡陣營成員是誰，他們也不知道你是奧伯倫。");
      break;
    }
    case "morgana":
    case "mordred":
    case "assassin":
    case "minion": {
      const teammates = evilPlayers.filter(
        (p) => p.userId !== userId && p.role !== "oberon"
      );
      lines.push(
        teammates.length > 0
          ? `你的邪惡陣營夥伴（奧伯倫會躲過你的視線）：${names(teammates)}`
          : "沒有其他可見的邪惡陣營夥伴。"
      );
      if (role === "assassin") {
        lines.push("正義陣營完成 3 次任務後，你要負責指認誰是梅林。");
      }
      if (role === "morgana") {
        lines.push("派西維爾會把你誤認為梅林。");
      }
      break;
    }
  }

  return lines.join("\n");
}
