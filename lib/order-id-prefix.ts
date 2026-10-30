// 查訂單頁「訂單編號」這一欄能不能拿去比對。
//
// 訂單 id 是 UUID（小寫 16 進位＋dash，共 36 碼），查單比對用 startsWith。
// 以前只擋了「低於 8 碼不查」，超過 36 碼、或夾了 g-z、中文這類 UUID 不會出現的字，
// 照樣拿去撈這支電話的全部訂單；快路徑落空還會退回撈整家店的全部訂單逐筆比。
// 這種編號跟任何訂單都不可能 startsWith 相符，查了必定查無訂單，白白翻頁撈一整家店。
// 查單頁不用登入，誰都能一直打，所以先在這裡擋掉，結果一樣是查無訂單。
//
// 呼叫端要先做完正規化（全形轉半形、去空白、去 #、轉小寫），這裡只看字元與長度。

// 給客人看的訂單短碼是 UUID 第一段、固定 8 碼（success 頁、會員訂單、信裡都是這 8 碼）。
// 不設下限的話，帶 ?id=a&phone= 進來就會用「電話 + 1 碼」撈到開頭剛好是 a 的最近一筆訂單，
// 把雙因子查詢弱化成電話幾乎就能查到別人的姓名/地址/品項。
export const ORDER_ID_PREFIX_MIN = 8;
// UUID 完整長度；有人貼整串完整 UUID 也要查得到。
export const ORDER_ID_PREFIX_MAX = 36;

// UUID 的 dash 只出現在第 9、14、19、24 碼（8-4-4-4-12），其他位置一定是 16 進位。
// 以前只看「字元在 0-9a-f- 之內」，「--------」或「a1b2-c3d4」這種 dash 放錯位置的
// 照樣放行，跟任何 UUID 都不可能 startsWith 相符，卻一樣撈一輪電話、落空再撈整家店。
const UUID_DASH_POSITIONS = new Set([8, 13, 18, 23]);

export function isOrderIdPrefixQuery(shortId: string): boolean {
  if (
    shortId.length < ORDER_ID_PREFIX_MIN ||
    shortId.length > ORDER_ID_PREFIX_MAX
  ) {
    return false;
  }
  for (let i = 0; i < shortId.length; i++) {
    const ok = UUID_DASH_POSITIONS.has(i)
      ? shortId[i] === "-"
      : /[0-9a-f]/.test(shortId[i]);
    if (!ok) return false;
  }
  return true;
}
