import { createAdminClient } from "@/lib/supabase/admin";
import { createLobbyState } from "./engine";
import type { GameRow, GameState } from "./types";

function statusFromPhase(state: GameState): GameRow["status"] {
  if (state.phase === "lobby") return "lobby";
  if (state.phase === "finished") return "finished";
  return "in_progress";
}

function fromRow(row: {
  id: string;
  line_group_id: string;
  status: GameRow["status"];
  state: GameState;
}): GameRow {
  return {
    id: row.id,
    lineGroupId: row.line_group_id,
    status: row.status,
    state: row.state,
  };
}

export async function getOrCreateGame(lineGroupId: string): Promise<GameRow> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("avalon_games")
    .select("*")
    .eq("line_group_id", lineGroupId)
    .maybeSingle();

  if (existing) return fromRow(existing);

  const state = createLobbyState();
  const { data, error } = await db
    .from("avalon_games")
    .insert({ line_group_id: lineGroupId, status: "lobby", state })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "無法建立遊戲房間");
  return fromRow(data);
}

export async function saveGameState(
  id: string,
  state: GameState
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("avalon_games")
    .update({ state, status: statusFromPhase(state) })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function resetGame(lineGroupId: string): Promise<GameRow> {
  const db = createAdminClient();
  const state = createLobbyState();
  const { data, error } = await db
    .from("avalon_games")
    .update({ state, status: "lobby" })
    .eq("line_group_id", lineGroupId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "無法重置遊戲");
  return fromRow(data);
}

export async function findGameByToken(
  token: string
): Promise<{ game: GameRow; userId: string } | null> {
  const db = createAdminClient();
  // JSONB 陣列裡找 token 相對麻煩，資料量小（單一團桌遊）直接掃全表即可
  const { data, error } = await db.from("avalon_games").select("*");
  if (error || !data) return null;
  for (const row of data) {
    const game = fromRow(row);
    const player = game.state.players.find((p) => p.token === token);
    if (player) return { game, userId: player.userId };
  }
  return null;
}

// 找出這位 LINE 使用者目前「正在進行中、且需要他私下回覆」的遊戲
// （執行任務出牌 / 刺客指認），用來把 1:1 聊天訊息路由回正確的房間
export async function findActionableGameForUser(
  userId: string
): Promise<GameRow | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("avalon_games")
    .select("*")
    .eq("status", "in_progress")
    .order("updated_at", { ascending: false });
  if (error || !data) return null;
  for (const row of data) {
    const game = fromRow(row);
    const { state } = game;
    if (state.phase === "mission" && state.team.includes(userId)) return game;
    if (
      state.phase === "assassin" &&
      state.players.find((p) => p.userId === userId)?.role === "assassin"
    )
      return game;
  }
  return null;
}
