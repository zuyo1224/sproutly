import type { Metadata } from "next";
import { HELP_TEXT } from "@/lib/avalon/format";

export const metadata: Metadata = {
  title: "阿瓦隆機器人",
  description: "免卡牌的阿瓦隆，在 LINE 群組裡跟朋友一起玩。",
};

export default function AvalonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white px-6 py-16">
      <div className="max-w-xl mx-auto">
        <p className="text-[0.6875rem] uppercase tracking-[0.3em] text-amber-400/80">
          Sproutly · Avalon Bot
        </p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight">
          阿瓦隆機器人
        </h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          不用準備卡牌，5-10 人面對面坐在一起，各自用手機跟 LINE
          群組裡的機器人互動就能玩。身分會私訊給你一個專屬連結，只有你看得到。
        </p>
        <pre className="mt-8 whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-white/80">
          {HELP_TEXT}
        </pre>
      </div>
    </div>
  );
}
