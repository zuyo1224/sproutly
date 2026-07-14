// 搜尋文字的正規化單一來源。
//
// 比對前把兩邊都轉成同一種寫法：全形英數與符號（！-～）轉半形、全形空白轉
// 半形空白，再轉小寫。中文輸入法很容易打出全形英數（ｄａｎｎｙ、５號盆、
// ｍｏｎｓｔｅｒａ），資料存的多半是半形，只 toLowerCase 逐字比的話全形對
// 半形一律不中。原本這支只住在 lib/product-search（c923c04）裡，商品搜尋修好了，
// 後台客人列表、訂單搜尋的姓名／Email 比對還是各自裸 toLowerCase——同一種病
// 在不同入口重複發作，所以抽出來讓所有搜尋入口吃同一套。
// 中文字不在轉換範圍，純中文搜尋行為不變。
export function normalizeSearchText(text: string): string {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .toLowerCase();
}
