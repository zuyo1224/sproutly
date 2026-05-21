// AI 助手 inline 編輯（對標 Wix Aria）
// POST：收 user 自然語言指令 + 現 theme JSON，回 theme patch JSON
// 串 OpenRouter（Claude 4.7 Sonnet / Haiku），需 OPENROUTER_API_KEY env var

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `你是 Sproutly 商家建站平台的 AI 助手，幫商家用自然語言調整店面設計。

商家會用中文告訴你他想改什麼（例如「把 hero 改成 split 樣式」、「把標語改成更詩意的版本」、「藍色 accent 改成綠色」、「加一句 promise」）。

你的任務：根據商家的指令，回傳一個 JSON object 描述要對 theme 做的變動。**只輸出 JSON、不寫任何說明文字**。

可以變動的 theme 欄位（patch 內出現才會 apply）：

\`\`\`ts
{
  primary?: string;       // hex 顏色 e.g. "#2C2C2C"
  accent?: string;        // hex 顏色
  tagline?: string;       // hero 主標語
  layout?: {
    heroStyle?: "full-image" | "split" | "minimal" | "magazine";
    heroEyebrow?: string;
    heroSubtitle?: string;
    heroImageSide?: "left" | "right";
    sectionOrder?: ("hero" | "collections" | "featured" | "journal" | "promise" | "visit")[];
  };
  homepage?: {
    promise?: string;            // Promise section 文字（可多行用 \\n 分隔）
    collectionsIntro?: string;   // 選物提案 intro
    visitTitle?: string;         // Visit section 標題
  };
}
\`\`\`

規則：
- 中文用繁體（台灣用法）
- 不電商口吻、不用感嘆號、不寫 emoji
- editorial / 文藝 / 慢生活風（不戳痛點）
- color 用 hex 6 碼
- 不確定就少改、留空欄位
- 不亂猜 sectionOrder 順序，沒明示就保留現狀

回傳格式範例：
\`\`\`json
{"layout":{"heroStyle":"split","heroEyebrow":"Est. 2019"},"accent":"#5F6F52"}
\`\`\`

只輸出 JSON，no markdown wrapping、no commentary。`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY 沒設。去 Vercel env vars 加上" },
      { status: 500 }
    );
  }

  let body: { prompt?: string; theme?: unknown; storeSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad JSON" }, { status: 400 });
  }

  const userPrompt = String(body.prompt ?? "").trim();
  if (!userPrompt) {
    return NextResponse.json({ error: "請寫指令" }, { status: 400 });
  }
  if (userPrompt.length > 2000) {
    return NextResponse.json({ error: "指令太長（max 2000 字）" }, { status: 400 });
  }

  // 驗證 user 是商家 owner（不讓陌生人用 API 燒 token）
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "需登入" }, { status: 401 });
  }
  const { count: storeCount } = await supabase
    .from("sproutly_merchants")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userData.user.id);
  if (!storeCount || storeCount === 0) {
    return NextResponse.json({ error: "你不是商家" }, { status: 403 });
  }

  const themeContext =
    body.theme && typeof body.theme === "object"
      ? `\n\n當前 theme：\n\`\`\`json\n${JSON.stringify(body.theme, null, 2)}\n\`\`\``
      : "";

  const messages = [
    {
      role: "system" as const,
      content: SYSTEM_PROMPT,
    },
    {
      role: "user" as const,
      content: `${userPrompt}${themeContext}`,
    },
  ];

  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sproutly-drab.vercel.app",
        "X-Title": "Sproutly AI Edit",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages,
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!orRes.ok) {
      const errText = await orRes.text();
      return NextResponse.json(
        { error: `OpenRouter ${orRes.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const orData = await orRes.json();
    const raw = orData.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "AI 沒回內容" }, { status: 502 });
    }

    // 試著 parse JSON（AI 可能 wrap 在 ```json 內）
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
    let patch: unknown;
    try {
      patch = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI 回的不是合法 JSON", raw: cleaned.slice(0, 300) },
        { status: 502 }
      );
    }

    return NextResponse.json({
      patch,
      usage: orData.usage ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `fetch error: ${msg}` }, { status: 500 });
  }
}
