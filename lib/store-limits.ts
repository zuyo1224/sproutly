// 店家基本資料（店名／店介紹／電話／信箱／地址）的字數上限，開店頁與店面設定頁的表單
// （瀏覽器端 maxLength）跟兩支 Server Action（createStore / updateStore）共用同一份數字。
//
// 以前 new-store 只擋了 slug 3–32 字、settings 只擋空店名，這五欄長度哪裡都沒擋。DB
// 五欄都是 text，塞多長都不會爆，問題在顯示端：店名會進 <title>、店面 header、OG 圖、
// sitemap、後台店家列表；描述整段印在店面「關於」區；電話／地址印在聯絡區跟 footer。
// 一串幾百字的店名會把 header 撐爆、讓螢幕閱讀器一口氣唸一整段。
//
// 數字跟視覺編輯器那邊的 sanitize 對齊：店名 60 字（editor 各 section 小標同數字）、
// 描述 2000 字（跟 promise / 常見問題答案同數字）。電話給 40 字（「02-2345-6789 分機
// 123」這種帶分機的寫法還放得下）、信箱 254 字（RFC 5321 的信箱長度上限）、地址 200 字
// （跟 gallery caption 同數字，台灣含樓層的完整地址不到 60 字）。兩邊都用 JS 的 .length
// （UTF-16 code unit）算，跟瀏覽器 maxLength 的算法一致，不會出現「瀏覽器放行、伺服器
// 退回」或反過來的對不上。
//
// "use server" 的模組只准 export async function，常數放不進 actions.ts 給頁面 import，
// 所以才另開這支純資料檔（跟 product-limits 同一種做法）。
export const MAX_STORE_NAME_LEN = 60;
export const MAX_STORE_DESC_LEN = 2000;
export const MAX_STORE_PHONE_LEN = 40;
export const MAX_STORE_EMAIL_LEN = 254;
export const MAX_STORE_ADDRESS_LEN = 200;

type StoreTextFields = {
  name: string;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
};

/**
 * 伺服器端真正擋下「太長」的那一層（瀏覽器端 maxLength 能被停用 JS 或改 DOM 繞過）。
 * 回傳第一個超限欄位的中文錯誤訊息，全部合格回 null；由呼叫端決定怎麼 redirect
 * （createStore 跟 updateStore 的錯誤頁不同）。空店名的檢查留在呼叫端（那句訊息跟其他
 * 必填欄位同一組），這裡只管「太長」。
 */
export function storeTextLimitError(fields: StoreTextFields): string | null {
  if (fields.name.length > MAX_STORE_NAME_LEN) {
    return `店名最多 ${MAX_STORE_NAME_LEN} 個字，長一點的介紹放到店介紹欄`;
  }
  if (fields.description && fields.description.length > MAX_STORE_DESC_LEN) {
    return `店介紹最多 ${MAX_STORE_DESC_LEN.toLocaleString("zh-TW")} 個字`;
  }
  if (fields.contact_phone && fields.contact_phone.length > MAX_STORE_PHONE_LEN) {
    return `聯絡電話最多 ${MAX_STORE_PHONE_LEN} 個字`;
  }
  if (fields.contact_email && fields.contact_email.length > MAX_STORE_EMAIL_LEN) {
    return `聯絡信箱最多 ${MAX_STORE_EMAIL_LEN} 個字`;
  }
  if (fields.address && fields.address.length > MAX_STORE_ADDRESS_LEN) {
    return `地址最多 ${MAX_STORE_ADDRESS_LEN} 個字`;
  }
  return null;
}
