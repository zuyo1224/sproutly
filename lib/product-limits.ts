// 商品價格與庫存的上限，後台表單（瀏覽器端 max 屬性）與 Server Action（parsePrice /
// parseStock）共用同一份數字。
//
// 以前這兩個常數是 products/actions.ts 私有的，表單那邊的 <input type="number"> 只有
// min="0"，沒有 max：商家多打幾個 0 要等按下「儲存」、整份表單送到伺服器被退回，才看到
// 「價格最多 … 元」那句。把上限抽到這裡，新增／編輯頁與列表那格「直接改庫存」的輸入框
// 都能掛同一個 max，瀏覽器先用內建提示擋一層；真正的關卡仍在伺服器端的 parse 函式
// （瀏覽器端驗證能被停用 JS 或改 DOM 繞過），這裡只是讓兩層永遠對到同一個數字，
// 不會出現「瀏覽器放行、伺服器退回」或反過來的對不上。
//
// "use server" 的模組只准 export async function，常數放不進 actions.ts 給頁面 import，
// 所以才另開這支純資料檔（跟 product-stock 的 LOW_STOCK_THRESHOLD 同一種做法）。
//
// 價格上限（元）：DB 的 price_cents 是 integer，上限 21 億多「分」、換成元只有兩千
// 一百多萬。一千萬元離 DB 上限還有一倍空間，台灣小店也不會有單件破千萬的商品。
export const MAX_PRICE_YUAN = 10_000_000;

// 庫存上限：同一個 integer 欄位、同一種打爆法。
export const MAX_STOCK = 1_000_000;

// 商品名稱與描述的字數上限。DB 兩欄都是 text，塞多長都不會爆，問題在顯示端：品名會
// 進店面卡片、購物車、結帳明細、aria-label、<title>，一串幾百字的品名會把卡片撐爆、
// 讓螢幕閱讀器一口氣唸一整段；描述會整段印在商品頁。以前這兩欄哪裡都沒擋，表單也
// 沒掛 maxLength。數字跟編輯器那邊的 sanitize 對齊：description 跟常見問題的「答案」
// 同樣 2000 字；name 給 100 字，比店名／小標的 60 字寬一點，「龜背芋 6 吋盆（附自動
// 澆水器・限量）」這種長品名還放得下。兩邊都用 JS 的 .length（UTF-16 code unit）算，
// 跟瀏覽器 maxLength 的算法一致，不會出現「瀏覽器放行、伺服器退回」。
export const MAX_PRODUCT_NAME_LEN = 100;
export const MAX_PRODUCT_DESC_LEN = 2000;
