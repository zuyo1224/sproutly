// 編輯器那幾條「縮放 / 數量」slider 的上下限，全站只認這一份。
//
// 以前每組範圍各抄了三份、還散在不同檔：
//   1. 編輯器 slider 的 min／max（editor-workspace.tsx）——使用者「選得到」的範圍。
//   2. 存檔 sanitize 的夾值（editor/actions.ts）——真正「存進去」的範圍。
//   3. 公開頁 resolve 的夾值（[slug]/_theme.ts）——最後「畫出來」的範圍。
// 三處的 Math.max(min, Math.min(max, v)) 逐字相同。日後想放寬（例如 zoom 開到 3.0），
// 得三處一起改，漏一處就會「slider 拉得到的值、存檔或 render 端又把它夾回去」——
// 跟商品數量 1-99 當初散在六七處是同一種坑（見 product-quantity.ts）。
//
// 收進這份：每組一對 MIN／MAX 常數 + 一支 clamp helper。slider 的 min／max 改吃常數，
// 兩處夾值改呼叫對應 helper，範圍真正只剩這一處。

// Hero 圖片縮放（修米色 strip 用的 per-viewport zoom）
export const HERO_ZOOM_MIN = 1.0;
export const HERO_ZOOM_MAX = 2.5;

// Hero 主標 / 副標字體大小倍率
export const HERO_FONT_SCALE_MIN = 0.6;
export const HERO_FONT_SCALE_MAX = 1.8;

// 全網站字體大小倍率
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.3;

// 首頁精選區顯示幾個商品
export const FEATURED_COUNT_MIN = 3;
export const FEATURED_COUNT_MAX = 12;

// 以下 helper 都假設呼叫端已先確認過 v 是有限數（typeof === "number" && Number.isFinite）；
// 只負責把它夾進範圍，輸出與原本各處手寫的 Math.max/min 逐字相同。
export function clampHeroZoom(v: number): number {
  return Math.max(HERO_ZOOM_MIN, Math.min(HERO_ZOOM_MAX, v));
}

export function clampHeroFontScale(v: number): number {
  return Math.max(HERO_FONT_SCALE_MIN, Math.min(HERO_FONT_SCALE_MAX, v));
}

export function clampFontScale(v: number): number {
  return Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, v));
}

// featuredCount 是整數張數，夾值前先 Math.floor 去掉小數（原本各處也都這樣寫）。
export function clampFeaturedCount(v: number): number {
  return Math.max(FEATURED_COUNT_MIN, Math.min(FEATURED_COUNT_MAX, Math.floor(v)));
}
