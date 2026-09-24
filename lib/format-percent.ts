// 「幾個裡有幾個」換成整數百分比（客人名單的回購率）。以前直接
// Math.round(part / total * 100)，問題在兩頭：200 位客人裡 199 位回購是 99.5%，
// 四捨五入成「100%」，看起來像全部都回購了；300 位裡只有 1 位是 0.33%，變成「0%」，
// 看起來像一個都沒有。改成只有真的全部才顯示 100%、真的一個都沒有才顯示 0%，
// 中間的一律夾在 1%～99%，其餘照一般四捨五入。total 不是正數時回 0。
export function formatPercent(part: number, total: number): string {
  if (!(total > 0)) return "0%";
  if (part <= 0) return "0%";
  if (part >= total) return "100%";
  const pct = Math.min(99, Math.max(1, Math.round((part / total) * 100)));
  return `${pct}%`;
}
