// 從客人 localStorage 帶上來的商品 id（購物車、收藏、最近看過）裡，挑出「該清掉的幽靈」。
//
// 規則（購物車 5abaf89、收藏 2a21339、最近看過 957a260 三處原本各寫一份，抽到這裡共用）：
// - 不是 UUID 的 id 一律清：favorites/api 一開始就把它們濾掉不查，永遠不可能撈回來。
// - 正常 UUID：只有在「這次至少撈回一筆」時，沒被撈回來的才算下架清掉。整批回空可能是
//   店家暫時整間下架或一時抓不到（API 對未發布店面也回空陣列），那種情況寧可留著不動，
//   免得把一整批有效商品清光。
import { isUuid } from "./uuid.ts";

export function deadProductIds(
  ids: readonly string[],
  returnedIds: readonly string[]
): string[] {
  const live = new Set(returnedIds);
  const anyReturned = returnedIds.length > 0;
  return ids.filter((id) => !isUuid(id) || (anyReturned && !live.has(id)));
}
