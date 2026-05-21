export default function RootLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col items-center justify-center px-8">
      <div className="text-center">
        <div className="mb-6 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-700/55">
          Sproutly
        </div>
        <div className="relative h-[2px] w-40 mx-auto overflow-hidden rounded-full bg-emerald-900/8">
          <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-emerald-500 to-lime-500 sproutly-loading-bar" />
        </div>
        <p className="mt-8 text-sm text-emerald-900/55 tracking-tight">
          正在發芽⋯
        </p>
      </div>
      <style>{`
        @keyframes sproutly-loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .sproutly-loading-bar {
          animation: sproutly-loading-bar 1.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .sproutly-loading-bar { animation: none; opacity: 0.6; width: 100%; }
        }
      `}</style>
    </div>
  );
}
