# Sproutly 開發 Loop 狀態

最後更新：2026-05-21（初始化）

## 當前版本
**v2.5**（含購物車、Cmd+K 搜尋、客人收藏、業績儀表板、4 preset + 自訂、Gemini 生圖、訂單追蹤、列印、CSV 匯出、Hero parallax、View Transitions、confetti、scroll-shrink nav）

## Production
- `https://sproutly-drab.vercel.app`
- 第一個示範店家：`/plantaemarket`（Plantae Market 盆栽，editorial preset + Noto Serif TC + 6 lifestyle 情境照 + 41 商品）

## 最後一輪完成
初始化：尚無 loop 紀錄

## 累計已做事項（high-level）
- 整套會員 / 多租戶平台架構
- 商家 CRUD（商品、訂單、設定、業績）
- 客人下單流程（單品立即購、多品購物車、訂單追蹤）
- 視覺自訂（5 preset、color picker、字體、Logo、Hero、section toggle）
- 微互動（hover scale、CTA underline、stagger 入場、parallax、3D tilt 元件）
- Cmd+K 搜尋
- Confetti 訂單成功
- View Transitions 跨頁過場
- SEO + OG metadata + favicon

## 下一輪建議任務（rotate 領域）

優先順序 1（功能補完）：
- **客人會員系統**：客人能用 LINE 登入 / 註冊（不只 LINE Login，加 magic link email），存放客人 profile / 訂單歷史
- **優惠碼系統**：商家在後台建 promo code，結帳輸入折扣
- **第二間 demo 店面**：建「太和工房」（user 自己的水壺品牌），不同 preset 試 visual variety

優先順序 2（視覺打磨）：
- **商品詳情頁 typography 全面升級**：標題 / 段落 / 價格 hierarchical
- **公開頁 dark mode 切換**（user 端 toggle）
- **手機 viewport 全頁巡查**：找 mobile-only 排版破綻

優先順序 3（內容）：
- **每個商品 lifestyle 攝影替換**（目前是棚拍商品照 + Gemini 圖）
- **店面歡迎信 / Welcome email** copy
- **加 demo 客戶評論**（如果做了會員 + reviews schema）

優先順序 4（QA）：
- **跑 Lighthouse**：找 CLS / LCP / TBT 弱點
- **mobile breakpoint 全頁 screenshot 比對**
- **訂單 race condition 壓測**

## 待修 bug（none currently）

## 規則
- 每輪只挑 1-2 個 agent
- rotate 領域避免 visual / builder / content / qa 失衡
- 不寫 emoji、繁體中文、不電商口吻

## State 外部化（context 累積太長時的處理）
這個檔案 + `sproutly-loop-log.md` + `~/Obsidian-Vault/04-Projects/sproutly.md` 三處都存進度。
對話太長時 user 可以：
1. 打 `/clear` 清空對話
2. 再貼一次 `/loop 讀 sproutly-loop-state.md，用 sproutly-orchestrator 繼續推進`
3. 我從這個檔案讀進度，無縫接續，不會丟任何已做的事
