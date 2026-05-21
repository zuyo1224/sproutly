export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center px-8">
      <div className="text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.4em] text-emerald-700/55">
          Dashboard
        </p>
        <div className="mt-6 relative h-[2px] w-32 mx-auto overflow-hidden rounded-full bg-emerald-900/8">
          <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-emerald-500 to-lime-500 sproutly-dashboard-bar" />
        </div>
        <p className="mt-6 text-sm text-emerald-900/55 tracking-tight">
          整理你的店⋯
        </p>
      </div>
      <style>{`
        @keyframes sproutly-dashboard-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .sproutly-dashboard-bar {
          animation: sproutly-dashboard-bar 1.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .sproutly-dashboard-bar { animation: none; opacity: 0.6; width: 100%; }
        }
      `}</style>
    </div>
  );
}
