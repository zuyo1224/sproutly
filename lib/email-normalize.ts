// 「使用者填的 email」的清洗口徑（單一來源）。
//
// email 會從五個入口進來：商家註冊、商家登入（app/auth/actions）、客人
// magic link 登入（[slug]/account/actions）、單品結帳與購物車結帳
// （customer_email 欄位）。五處原本都只 trim 頭尾就原樣拿去用，但中文
// 輸入法很容易打出全形英數與符號（ｄａｎｎｙ＠ｇｍａｉｌ．ｃｏｍ）、從
// LINE/IG 複製又常夾到中段空白——這種 email 寄信一定寄不到、登入永遠
// 對不上帳號，跟電話（lib/phone-match）、訂單編號（fbe7460）、商品搜尋
// （lib/product-search）修過的是同一種病。
//
// 清洗規則：全形英數與符號（！-～，含＠．）轉半形 → 去掉所有空白
// （email 本來就不含空白，砍中段空白不會誤傷）→ 轉小寫（email 實務上
// 不分大小寫，Supabase auth 也是小寫存；統一小寫讓「註冊打大寫、登入
// 打小寫」對得上，訂單上的 email 也不會同一人兩種寫法）。
// 清完是空字串就回空字串，選填欄位由呼叫端自行收成 null。
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s|　/g, "")
    .toLowerCase();
}
