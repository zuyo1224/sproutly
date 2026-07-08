import { NextRequest, NextResponse } from "next/server";
import {
  getGroupMemberDisplayName,
  pushMessage,
  replyMessage,
  textMessage,
  verifyLineSignature,
} from "@/lib/line/client";
import {
  addPlayer,
  castVote,
  currentLeader,
  proposeTeam,
  startGame,
  submitAssassinGuess,
  submitMissionCard,
} from "@/lib/avalon/engine";
import { roleBriefing } from "@/lib/avalon/briefing";
import {
  HELP_TEXT,
  formatAssassinResolved,
  formatMissionResolved,
  formatPlayerList,
  formatTeamPrompt,
  formatTeamProposed,
  formatVoteProgress,
  formatVoteResolved,
} from "@/lib/avalon/format";
import { OPTIONAL_ROLE_ALIASES } from "@/lib/avalon/roles";
import {
  findActionableGameForUser,
  getOrCreateGame,
  resetGame,
  saveGameState,
} from "@/lib/avalon/store";
import type { GameState } from "@/lib/avalon/types";

const PREFIX_PATTERN = /^(阿瓦隆|av)\s*/i;

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sproutly-drab.vercel.app";

type LineEvent = {
  type: string;
  replyToken?: string;
  source: { type: string; groupId?: string; roomId?: string; userId?: string };
  message?: { type: string; text?: string };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events: LineEvent[] };

  await Promise.all(
    (body.events ?? []).map((event) => handleEvent(event).catch((err) => {
      console.error("avalon webhook event error", err);
    }))
  );

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent) {
  if (event.type === "join") {
    const groupId = event.source.groupId ?? event.source.roomId;
    if (groupId && event.replyToken) {
      await replyMessage(event.replyToken, [textMessage(HELP_TEXT)]);
    }
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") return;
  const text = event.message.text?.trim() ?? "";
  const match = text.match(PREFIX_PATTERN);
  if (!match) return;
  const rest = text.slice(match[0].length).trim();
  const [sub, ...args] = rest.split(/\s+/).filter(Boolean);

  if (event.source.type === "group" || event.source.type === "room") {
    await handleGroupCommand(event, sub ?? "", args);
  } else if (event.source.type === "user") {
    await handlePrivateCommand(event, sub ?? "", args);
  }
}

async function handleGroupCommand(
  event: LineEvent,
  sub: string,
  args: string[]
) {
  const groupId = event.source.groupId ?? event.source.roomId;
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  if (!groupId || !replyToken) return;

  const reply = (text: string) => replyMessage(replyToken, [textMessage(text)]);

  switch (sub) {
    case "說明":
    case "help":
      return reply(HELP_TEXT);

    case "加入": {
      if (!userId) return reply("找不到你的 LINE 使用者資訊，請再試一次。");
      const game = await getOrCreateGame(groupId);
      const name = await getGroupMemberDisplayName(groupId, userId);
      const result = addPlayer(game.state, userId, name);
      if (result.error) return reply(result.error);
      await saveGameState(game.id, result.state);
      return reply(
        `${name} 已加入！目前 ${result.state.players.length} 人。\n\n${formatPlayerList(result.state)}`
      );
    }

    case "名單": {
      const game = await getOrCreateGame(groupId);
      return reply(formatPlayerList(game.state));
    }

    case "開始": {
      const game = await getOrCreateGame(groupId);
      const optionalRoles = args
        .map((a) => OPTIONAL_ROLE_ALIASES[a])
        .filter((r): r is NonNullable<typeof r> => Boolean(r));
      const result = startGame(game.state, optionalRoles);
      if (result.error) return reply(result.error);
      await saveGameState(game.id, result.state);
      await Promise.all(
        result.state.players.map((p) =>
          pushMessage(p.userId, [
            textMessage(
              `身分已發放！點連結查看（只有你看得到）：\n${siteUrl}/avalon/r/${p.token}`
            ),
            textMessage(roleBriefing(result.state, p.userId)),
          ])
        )
      );
      return reply(
        `🎮 遊戲開始！共 ${result.state.players.length} 人。\n身分已私訊發送，記得查看。\n\n${formatTeamPrompt(result.state)}`
      );
    }

    case "出隊": {
      const game = await getOrCreateGame(groupId);
      if (!userId) return reply("找不到你的 LINE 使用者資訊。");
      const numbers = args.map((a) => Number(a)).filter((n) => Number.isInteger(n));
      const result = proposeTeam(game.state, userId, numbers);
      if (result.error) return reply(result.error);
      await saveGameState(game.id, result.state);
      return reply(formatTeamProposed(result.state));
    }

    case "同意":
    case "反對": {
      const game = await getOrCreateGame(groupId);
      if (!userId) return reply("找不到你的 LINE 使用者資訊。");
      const result = castVote(game.state, userId, sub === "同意");
      if (result.error) return reply(result.error);
      await saveGameState(game.id, result.state);
      if (result.resolved) {
        const approved = result.state.phase === "mission";
        if (approved) {
          await pushMissionCards(result.state);
        }
        return reply(formatVoteResolved(result.state, approved));
      }
      return reply(formatVoteProgress(result.state));
    }

    case "重置":
    case "重新開始": {
      const game = await resetGame(groupId);
      return reply(
        `遊戲已重置。輸入「阿瓦隆 加入」開始下一局。\n\n${formatPlayerList(game.state)}`
      );
    }

    default:
      return;
  }
}

async function pushMissionCards(state: GameState) {
  const leaderName = currentLeader(state)?.name ?? "";
  await Promise.all(
    state.team.map((userId) => {
      const player = state.players.find((p) => p.userId === userId);
      const isGood = player?.role
        ? ["merlin", "percival", "loyal"].includes(player.role)
        : true;
      return pushMessage(userId, [
        textMessage(
          `隊長 ${leaderName} 派你出這次任務，請選擇任務結果：`,
          isGood
            ? [{ label: "任務成功", text: "阿瓦隆 任務 成功" }]
            : [
                { label: "任務成功", text: "阿瓦隆 任務 成功" },
                { label: "任務失敗", text: "阿瓦隆 任務 失敗" },
              ]
        ),
      ]);
    })
  );
}

async function handlePrivateCommand(
  event: LineEvent,
  sub: string,
  args: string[]
) {
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  if (!userId || !replyToken) return;
  const reply = (text: string) => replyMessage(replyToken, [textMessage(text)]);

  if (sub === "說明" || sub === "help") return reply(HELP_TEXT);

  const game = await findActionableGameForUser(userId);
  if (!game) return reply("目前沒有等待你回覆的任務。");

  if (sub === "任務") {
    const success = args[0] === "成功";
    const result = submitMissionCard(game.state, userId, success);
    if (result.error) return reply(result.error);
    await saveGameState(game.id, result.state);
    await reply("已送出，等待其他隊員。");
    if (result.resolved) {
      await pushMessage(game.lineGroupId, [
        textMessage(formatMissionResolved(result.state)),
      ]);
      if (result.state.phase === "assassin") {
        await pushAssassinPrompt(result.state);
      }
    }
    return;
  }

  if (sub === "指認") {
    const targetNumber = Number(args[0]);
    const result = submitAssassinGuess(game.state, userId, targetNumber);
    if (result.error) return reply(result.error);
    await saveGameState(game.id, result.state);
    await reply("已送出指認結果。");
    await pushMessage(game.lineGroupId, [
      textMessage(formatAssassinResolved(result.state)),
    ]);
    return;
  }
}

async function pushAssassinPrompt(state: GameState) {
  const assassin = state.players.find((p) => p.role === "assassin");
  if (!assassin) return;
  const knownEvilIds = new Set(
    state.players
      .filter((p) => p.role && p.role !== "oberon" && p.role !== "assassin")
      .filter((p) => ["morgana", "mordred", "minion"].includes(p.role!))
      .map((p) => p.userId)
  );
  const candidates = state.players.filter(
    (p) => p.userId !== assassin.userId && !knownEvilIds.has(p.userId)
  );
  await pushMessage(assassin.userId, [
    textMessage(
      "正義陣營完成 3 次任務了！身為刺客，指認出誰是梅林就能逆轉勝：",
      candidates.map((p) => ({
        label: p.name,
        text: `阿瓦隆 指認 ${state.players.indexOf(p) + 1}`,
      }))
    ),
  ]);
}
