// 寫進 sproutly_orders / sproutly_order_items 的那兩個物件，兩條結帳路徑共用這一份。
//
// 單品結帳（app/[slug]/checkout/actions.ts）與購物車結帳
// （app/[slug]/cart/checkout/submit/route.ts）各自 inline 一份逐字相同的 insert 物件：
// 十二個欄位、同樣的順序、同樣寫死的 status "pending" 與 payment_status "unpaid"，
// 只有金額、幣別跟商品來源不一樣。訂單明細那筆也是同一回事（單品直接建一筆、
// 購物車 map 一批，欄位組法一模一樣）。
//
// 問題不在現在對不對，在於下次改的時候。之後要加欄位（例如把配送方式從 note 裡拆出來
// 獨立成一欄）、或要改新單的初始狀態（例如貨到付款直接開 "confirmed"），得記得兩個檔
// 都改；漏一個的結果是「從商品頁買」跟「從購物車買」在後台長得不一樣，而且不會報錯，
// 要等商家發現某一批單少了欄位才知道。前幾輪的 checkout-fields、cart-payload、
// form-fields、product-stock 都是在收同一條線上的東西，這是最後一段還在兩邊各抄一份的。
//
// 這裡只負責「組出要寫進去的物件」，不碰資料庫、不做驗證——驗證在呼叫端更早的
// checkout-fields / cart-payload 就做完了。

export type OrderRowInput = {
  merchantId: string;
  /** 客人有登入才有，沒登入的單就是 null（匿名下單一直都允許） */
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: string | null;
  /** 已經把配送方式／門市編碼進去的那串（見 order-labels 的 encodeShippingIntoNote） */
  note: string | null;
  totalCents: number;
  currency: string;
  paymentMethod: string | null;
};

// 新單一律 pending + unpaid：站上還沒接金流，付款與出貨狀態都由商家在後台手動推進。
// 這兩個值寫在這裡而不是讓呼叫端傳，就是為了讓兩條路徑不可能開出不同狀態的單。
export function buildOrderRow(input: OrderRowInput) {
  return {
    merchant_id: input.merchantId,
    customer_id: input.customerId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_email: input.customerEmail,
    shipping_address: input.shippingAddress,
    note: input.note,
    total_cents: input.totalCents,
    currency: input.currency,
    status: "pending",
    payment_method: input.paymentMethod,
    payment_status: "unpaid",
  };
}

export type OrderItemRowInput = {
  orderId: string;
  /** 直接吃查商品那步撈回來的那一列，欄位名沿用資料庫的寫法 */
  product: { id: string; name: string; price_cents: number };
  quantity: number;
};

// 品名與單價存的是「下單當下的快照」：商家事後改名或調價，舊訂單要維持客人當時看到的樣子，
// 所以這兩欄從商品列複製過來，不是靠 product_id 去 join 現值。
export function buildOrderItemRow(input: OrderItemRowInput) {
  return {
    order_id: input.orderId,
    product_id: input.product.id,
    name_snapshot: input.product.name,
    price_cents_snapshot: input.product.price_cents,
    quantity: input.quantity,
  };
}
