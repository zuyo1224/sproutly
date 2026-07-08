import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findGameByToken } from "@/lib/avalon/store";
import { roleBriefing } from "@/lib/avalon/briefing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "你的阿瓦隆身分",
  robots: { index: false, follow: false },
};

export default async function AvalonRolePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const found = await findGameByToken(token);
  if (!found) notFound();

  const { game, userId } = found;
  const player = game.state.players.find((p) => p.userId === userId);
  if (!player?.role) notFound();

  const briefing = roleBriefing(game.state, userId);
  const [firstLine, ...rest] = briefing.split("\n");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center">
        <p className="text-[0.6875rem] uppercase tracking-[0.3em] text-amber-400/80">
          Avalon · {player.name}
        </p>
        <h1 className="mt-4 text-2xl font-medium text-white tracking-tight">
          {firstLine}
        </h1>
        <div className="mt-6 space-y-2 text-left text-white/80 text-sm leading-relaxed">
          {rest.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <p className="mt-8 text-xs text-white/40">
          看完請把螢幕收起來，別讓其他人看到。
        </p>
      </div>
    </div>
  );
}
