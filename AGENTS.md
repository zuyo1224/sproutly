<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Sproutly 專案筆記（四 AI 共讀主檔）

> 工作區規則在 `~/Downloads/Zuyo-agent/AGENTS.md`（此專案在 ~/Downloads/sproutly，不在 Zuyo-agent 底下）。本檔是 Sproutly 自己的知識。

台灣小商家建站平台（Next.js 16 + Supabase，B 路線多租戶平台）。

## 啟動
- `npm run dev`（埠見 `package.json`）。
- `.env.local` + 與 avalon-bot 共用 Supabase。

## 現況 / 慣例
- 第一批用戶：朋友盆栽店 + 太和工房。6-10 週藍圖。
- 網域 `sproutly.com.tw` 待買（PChome 個人註冊；DNS：A @ → 76.76.21.21，CNAME www → cname.vercel-dns.com）。
- **每輪進度看 `sproutly-loop-state.md`**（在 ~/Downloads/Zuyo-agent/），知道下一步該做什麼。
- 專屬 agent：sproutly-orchestrator / builder / visual-designer / qa-tester / content-curator。
