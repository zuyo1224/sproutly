This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Avalon LINE 機器人（`/avalon`）

免卡牌版阿瓦隆，玩家面對面坐在一起，各自用手機在 LINE 群組跟機器人互動。玩法說明見 `/avalon`，指令定義在 `lib/avalon/format.ts`（`HELP_TEXT`）。

設定步驟：

1. 先跑 `supabase/migrations/0004_avalon_bot.sql`（Supabase SQL Editor 整段貼上）。
2. 到 [LINE Developers Console](https://developers.line.biz/) 建立一個 Provider，底下建一個 **Messaging API** 頻道。
3. 在頻道設定頁拿到：
   - Channel secret
   - Channel access token（長期）
4. 把這兩個值設成環境變數：
   ```
   LINE_CHANNEL_SECRET=xxx
   LINE_CHANNEL_ACCESS_TOKEN=xxx
   ```
5. Webhook URL 設成 `https://<你的網域>/api/line/webhook`，並在頻道設定打開「Use webhook」。
6. 把機器人加為好友，並邀請進要玩的 LINE 群組。**每位玩家都要先把機器人加成 1:1 好友**，機器人才能私訊發身分卡與任務結果（LINE 平台限制：機器人無法私訊不是好友的使用者）。
7. 在群組輸入「阿瓦隆 加入」開始報名，5-10 人到齊後輸入「阿瓦隆 開始」開局。

身分只會透過私訊（1:1 聊天）或私人連結（`/avalon/r/[token]`）傳送給本人，群組裡看不到任何人的身分。
