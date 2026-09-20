// 編輯器存檔端「可清除的文字欄位」三態守門，一支管三種欄位：
//   undefined → 這次 payload 沒帶這格，回 undefined，呼叫端跳過不動 DB
//   null 或 ""  → 商家按了清除／把輸入框清空，回 null，存進去把舊值蓋掉
//   其他字串   → 丟給該欄位自己的 clean（displayableImageUrl／cleanMapEmbedUrl／
//                normalizeHexColor），判過回乾淨值、判不過回 undefined（不動 DB，
//                店面繼續用上一次存好的值）
//
// 以前 actions.ts 這條「沒帶跳過、空值存 null、有值走 helper、判不過不存」寫了三段：
// Hero 大圖／logo 兩格、Google 地圖嵌入網址一格、Hero 各段文字色與頁尾底色 14 格，
// 三段判法逐字同構只差 helper 跟欄位名；日後想改「空白字串算不算清除」得三段一起改。
// 收成這支，各段只剩「哪格、走哪支 helper」。
//
// 型別以外的東西（手打請求塞數字、物件）一律當判不過、跳過：三段原本兩段就是這樣
// （typeof string 才進 helper／normalizeHexColor 自己擋非字串），只有 Hero 大圖那段是
// `!v` 判清除，0／false 這種假值以前會被當清除存 null，現在跳過——那只有繞過編輯器手打
// 的請求才碰得到，且「看不懂的值不動 DB」跟另兩段一致。
export function sanitizeClearable(
  v: unknown,
  clean: (s: string) => string | null,
): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  return clean(v) ?? undefined;
}
