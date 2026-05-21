export default function StoreLoading() {
  return (
    <div className="px-6 py-20 max-w-6xl mx-auto">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <div className="mx-auto h-3 w-40 rounded-full bg-current opacity-[0.06] sproutly-loading-pulse" />
          <div className="mx-auto h-8 w-72 rounded-full bg-current opacity-[0.08] sproutly-loading-pulse" />
          <div className="mx-auto h-3 w-56 rounded-full bg-current opacity-[0.05] sproutly-loading-pulse" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sproutly-stagger-fade">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[4/5] w-full rounded-lg bg-current opacity-[0.05] sproutly-loading-pulse" />
              <div className="h-3 w-3/4 rounded-full bg-current opacity-[0.07] sproutly-loading-pulse" />
              <div className="h-3 w-1/3 rounded-full bg-current opacity-[0.05] sproutly-loading-pulse" />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes sproutly-loading-pulse {
          0%, 100% { opacity: var(--sproutly-pulse-min, 0.04); }
          50% { opacity: var(--sproutly-pulse-max, 0.12); }
        }
        .sproutly-loading-pulse {
          animation: sproutly-loading-pulse 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .sproutly-stagger-fade > *:nth-child(1) { animation-delay: 0s; }
        .sproutly-stagger-fade > *:nth-child(2) { animation-delay: 0.08s; }
        .sproutly-stagger-fade > *:nth-child(3) { animation-delay: 0.16s; }
        .sproutly-stagger-fade > *:nth-child(4) { animation-delay: 0.24s; }
        .sproutly-stagger-fade > *:nth-child(5) { animation-delay: 0.32s; }
        .sproutly-stagger-fade > *:nth-child(6) { animation-delay: 0.40s; }
        @media (prefers-reduced-motion: reduce) {
          .sproutly-loading-pulse { animation: none; opacity: 0.08; }
        }
      `}</style>
    </div>
  );
}
