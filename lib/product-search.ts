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
type ProductSearchFields = { name: string; description: string | null };

// 比對前把兩邊都轉成同一種寫法：全形英數與符號（！-～）轉半形、全形空白轉
// 半形空白，再轉小寫。客人用中文輸入法很容易打出全形（ｍｏｎｓｔｅｒａ、
// ５號盆），商品名存的多半是半形，原本只 toLowerCase 逐字比，全形對半形
// 一律不中——查訂單頁的編號輸入（fbe7460）、電話比對（lib/phone-match）
// 修過同一種病，這裡是商品搜尋的同款破口。兩邊都轉，商品名反過來存成
// 全形、客人打半形也照樣中。中文字不在轉換範圍，純中文搜尋行為不變。
function normalizeSearchText(text: string): string {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .toLowerCase();
}

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
