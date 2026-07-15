// 客戶端收藏 helpers（localStorage based，per-store key）
//
// 收藏原本用「全站共用」一把 key（sproutly_favorites），跟購物車 / 最近看過的
// per-store 慣例不同：所有店的收藏 id 混在同一個陣列，但收藏頁與 API 都只回
// 「當前這家店」的商品。收藏頁的幽靈清理（把 API 沒回的 id 當下架商品清掉）
// 因此會把「別家店活得好好的收藏」整批誤刪——在 A 店開收藏頁，B 店收藏就沒了；
// 導覽列的愛心徽章也把別店收藏算進來，數字跟頁面內容永遠對不上。
// 改成 per-store key 後兩個症狀一起消失，清理邏輯回歸它原本的正當用途。

const KEY_PREFIX = "sproutly_favorites_";
// 換 key 前的全站共用舊 key。第一次讀某家店的收藏時，如果 per-store key 還不存在
// 就整份抄過來當起點（含別店 id 也無妨，收藏頁的清理會把不屬於這家店的修掉），
// 讓既有客人的收藏不會因為換 key 一夕消失。舊 key 不刪：其他店第一次讀時還要靠它播種。
const LEGACY_KEY = "sproutly_favorites";

export const FAVORITES_CHANGED_EVENT = "sproutly-favorites-changed";

export function getFavoriteIds(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const key = KEY_PREFIX + slug;
    let raw = localStorage.getItem(key);
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy === null) return [];
      localStorage.setItem(key, legacy);
      raw = legacy;
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function setFavoriteIds(slug: string, ids: string[]) {
  try {
    localStorage.setItem(KEY_PREFIX + slug, JSON.stringify(ids));
    // notify other tabs / same-tab listeners
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}
