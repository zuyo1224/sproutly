// 結帳表單「收件人那幾格」的驗證口徑（單一來源）。
//
// 站上有兩條結帳路徑，各自有一份長得幾乎一樣的表單：
// - 單品直接買：app/[slug]/checkout（server action，錯誤用 redirect 帶 error 參數回頁面）
// - 購物車結帳：app/[slug]/cart/checkout（POST route，錯誤回 400 JSON）
//
// 送出的欄位是同一組（姓名、電話、付款方式、配送方式、門市／地址），該擋的條件也
// 是同一組，但兩邊各抄了一份 if。抄兩份的下場已經發生過一次：同樣是電話沒填，單品
// 那條回「請填聯絡電話」、購物車那條回「請填電話」，同一間店的兩個入口講不同的話。
//
// 收成這一份之後，兩條路徑吃同一組條件、同一組句子，日後加一個必填欄位或改一句話
// 只有一個地方要動。
//
// 這支刻意只做「純看欄位就知道對不對」的檢查：不碰資料庫、不看登入狀態、不管商品
// 在不在、庫存夠不夠——那些各條路徑不一樣，留在各自的檔案裡。
import { isSelectablePaymentMethod, SHIPPING_LABELS, shippingDetailError } from "./order-labels.ts";

export type CheckoutFields = {
  customerName: string | null | undefined;
  customerPhone: string | null | undefined;
  paymentMethod: string | null | undefined;
  shippingMethod: string | null | undefined;
  shippingStoreName: string | null | undefined;
  shippingAddress: string | null | undefined;
};

// 兩邊統一用「請填電話」——兩張表單上那格的 label 就寫「電話」，訊息跟客人眼睛看到的
// 字對齊。原本單品那條寫「請填聯絡電話」，指的是同一格，改成跟購物車一致。
export const NAME_REQUIRED_ERROR = "請填收件人姓名";
export const PHONE_REQUIRED_ERROR = "請填電話";
export const PAYMENT_REQUIRED_ERROR = "請選擇付款方式";
export const SHIPPING_REQUIRED_ERROR = "請選擇配送方式";

/**
 * 檢查結帳表單的收件人欄位，回傳第一個該讓客人看到的錯誤訊息；全部合格回 null。
 *
 * 順序就是表單由上而下的順序（姓名 → 電話 → 付款 → 配送 → 門市／地址）：一次只講一句，
 * 講最上面那格，客人補完再送出才不會像在打地鼠。
 */
export function checkoutFieldsError(fields: CheckoutFields): string | null {
  if (!fields.customerName) return NAME_REQUIRED_ERROR;
  if (!fields.customerPhone) return PHONE_REQUIRED_ERROR;
  // 合法性看 isSelectablePaymentMethod（名單上且未停用），不吃顯示用的 PAYMENT_LABELS——
  // 那份含停用中的信用卡，拿來當白名單會把「即將推出」的金流放行（緣由見 order-labels）。
  if (!isSelectablePaymentMethod(fields.paymentMethod)) return PAYMENT_REQUIRED_ERROR;
  if (!fields.shippingMethod || !SHIPPING_LABELS[fields.shippingMethod]) {
    return SHIPPING_REQUIRED_ERROR;
  }
  // 超商取貨必須填門市、宅配必須填地址（這兩條的規則與句子收在 shippingDetailError）
  return shippingDetailError(
    fields.shippingMethod,
    fields.shippingStoreName,
    fields.shippingAddress
  );
}
