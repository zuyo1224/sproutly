// 購物車結帳送上來的 cart_items 的解讀口徑（單一來源）。
//
// 購物車整份是存在客人瀏覽器的 localStorage，結帳時序列化成一個 JSON 字串塞進
// 表單的 cart_items 欄位送給後端。也就是說這份東西「完全由客人那端決定」——瀏覽器
// 主控台改一行、或舊版本留下的壞資料，都會原樣送到後端。後端不能信它。
//
// 這支就是那層不信任的檢查，從 app/[slug]/cart/checkout/submit 的 route 抽出來，
// 行為零變化。抽出來的理由是它是整條金流上最像「純算術」的一段（不碰 DB、不看
// 登入狀態），卻是最不能出錯的一段：
// - qty 放行負數 → 總額算成負數，庫存反而被加回去（等於送錢又送貨）
// - qty 放行小數或字串 → 金額算出小數分，訂單明細跟收據對不起來
// - 同一個商品重複列不擋 → 後面用商品筆數對 id 筆數的檢查會誤判成「有商品下架」，
//   客人看到的是一句跟實情無關的錯誤訊息
// - 空陣列不擋 → 建出一張沒有任何明細的空訂單
//
// 錯誤訊息也一起收進來：訊息長什麼樣是客人唯一看得到的東西，散在 route 裡改一句
// 就沒人知道另一處還有一句不一樣的。
import { isValidQty } from "./product-quantity.ts";

export type CartLine = { productId: string; qty: number };

export type CartPayloadResult =
  | { ok: true; items: CartLine[] }
  | { ok: false; error: string };

// 整份東西根本不成形（不是 JSON、不是陣列、或一件都沒有）時給的話。
// 對客人來說這三種情況看起來都一樣：他按了結帳但車是空的。
const EMPTY_ERROR = "購物車是空的";
// 成形了但某一列不合法。不細講是哪一列哪裡錯——客人改不了也看不懂，
// 而且那多半代表資料被動過或是壞掉的舊資料，請他重看一次購物車最實際。
const BAD_ITEM_ERROR = "購物車內容有誤，請重新確認";

export function parseCartPayload(raw: string | null | undefined): CartPayloadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? "").trim());
  } catch {
    return { ok: false, error: EMPTY_ERROR };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: EMPTY_ERROR };
  }

  const items: CartLine[] = [];
  const seenIds = new Set<string>();
  for (const line of parsed as { productId?: unknown; qty?: unknown }[]) {
    const productId = typeof line?.productId === "string" ? line.productId : "";
    // 刻意用 Number() 而不是只認 number：購物車寫進 localStorage 的值曾經是字串，
    // 舊資料還在客人瀏覽器裡，"2" 應該照收。真的算不出數字會變 NaN，被 isValidQty 擋掉。
    // 副作用是 true 與 [1] 這種東西也被算成 1 而收下（測試裡寫死了）。沒去堵是因為
    // 收下的值仍是 1-99 的整數，金額與庫存都不會因此算錯。
    const qty = Number(line?.qty);
    if (!productId || !isValidQty(qty) || seenIds.has(productId)) {
      return { ok: false, error: BAD_ITEM_ERROR };
    }
    seenIds.add(productId);
    items.push({ productId, qty });
  }
  return { ok: true, items };
}
