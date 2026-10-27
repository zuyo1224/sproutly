// 商品關鍵字比對（名稱 / 描述）單一來源。
//
// 同一套「名稱或描述含關鍵字就算命中」的搜尋口徑，原本在三處各抄一份逐字相同的
// filter 述詞：後台商品列表（dashboard products）、逛街頁（[slug]/shop）、以及
// Cmd+K 商品搜尋 API（[slug]/search/api）。三處都是把 q 轉小寫，再比名稱 /
// (description ?? "") 是否包含。日後要調整可搜尋欄位（例如也比對標籤），得三處
// 同步；漏一處就變成「在某個入口搜得到、換個入口搜不到」這種同一批商品不同出口
// 口徑對不上。收成這支後，三個入口吃同一條比對規則。
//
// 搜尋 API 需要把「名稱命中」與「只有描述命中」分成兩組（名稱命中排前面），所以
// 除了合併的 matchesProductSearch，另外拆出 matchesProductName /
// matchesProductDescription 兩支原子述詞給它做分流。description 可能為 null，比對前
// 補空字串（維持原本 (description ?? "") 行為）；query 由呼叫端自行決定空字串時是否
// 略過整個 filter，這支只負責「單一商品是否命中」。
import { normalizeSearchText } from "./search-normalize.ts";
import { MAX_PRODUCT_DESC_LEN } from "./product-limits.ts";

// 搜尋字的長度上限，跟商品描述上限同一個數字：關鍵字要「被包含」在名稱或描述裡
// 才算命中，比描述上限還長的字串不可能命中任何一件商品（名稱上限更短）。
// normalizeSearchText 是一字換一字，正規化前後長度不變，直接拿原字串比就好。
// Cmd+K 搜尋 API 是公開網址，誰都能塞一串幾十萬字的 q 一直打——每打一次就把整家店
// 的商品分頁撈齊、逐件比對一輪，結果必定是空的。超過這個長度就直接回空，不查 DB；
// 逛街頁與 Cmd+K 面板的輸入框也掛同一份 maxLength。
export const MAX_SEARCH_QUERY_LEN = MAX_PRODUCT_DESC_LEN;

export function isSearchQueryTooLong(query: string): boolean {
  return query.length > MAX_SEARCH_QUERY_LEN;
}

type ProductSearchFields = { name: string; description: string | null };

export function matchesProductName(
  product: ProductSearchFields,
  query: string,
): boolean {
  return normalizeSearchText(product.name).includes(normalizeSearchText(query));
}

export function matchesProductDescription(
  product: ProductSearchFields,
  query: string,
): boolean {
  return normalizeSearchText(product.description ?? "").includes(
    normalizeSearchText(query),
  );
}

export function matchesProductSearch(
  product: ProductSearchFields,
  query: string,
): boolean {
  return matchesProductName(product, query) || matchesProductDescription(product, query);
}
