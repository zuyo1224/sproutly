import { createHmac, timingSafeEqual } from "crypto";

const LINE_API = "https://api.line.me/v2/bot/message";

export type QuickReplyItem = { label: string; text: string };

export type LineMessage = {
  type: "text";
  text: string;
  quickReply?: {
    items: {
      type: "action";
      action: { type: "message"; label: string; text: string };
    }[];
  };
};

export function textMessage(
  text: string,
  quickReplies?: QuickReplyItem[]
): LineMessage {
  return {
    type: "text",
    text,
    quickReply: quickReplies
      ? {
          items: quickReplies.map((q) => ({
            type: "action",
            action: { type: "message", label: q.label, text: q.text },
          })),
        }
      : undefined,
  };
}

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authHeaders() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("缺少 LINE_CHANNEL_ACCESS_TOKEN 環境變數");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  await fetch(`${LINE_API}/reply`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ replyToken, messages }),
  });
}

export async function pushMessage(to: string, messages: LineMessage[]) {
  const res = await fetch(`${LINE_API}/push`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ to, messages }),
  });
  return res.ok;
}

export async function getGroupMemberDisplayName(
  groupId: string,
  userId: string
): Promise<string> {
  try {
    const res = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`,
      { headers: authHeaders() }
    );
    if (!res.ok) return "玩家";
    const data = await res.json();
    return data.displayName ?? "玩家";
  } catch {
    return "玩家";
  }
}
