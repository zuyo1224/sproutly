import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeShippingIntoNote } from "@/lib/order-labels";
import { checkoutFieldsError } from "@/lib/checkout-fields";
import { parseCartPayload } from "@/lib/cart-payload";
import { normalizeEmail } from "@/lib/email-normalize";
import { formString, formStringOrNull } from "@/lib/form-fields";
import { decrementStock, restoreStock } from "@/lib/stock-restore";
import { insufficientStockError, stockConflictError } from "@/lib/product-stock";
import { buildOrderRow, buildOrderItemRow } from "@/lib/order-rows";

type Params = Promise<{ slug: string }>;

export async function POST(
  request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const fd = await request.formData();

  // 取值走 lib/form-fields 的同一份 helper，跟單品結帳（[slug]/checkout/actions）一致。
  const customerName = formString(fd, "customer_name");
  const customerPhone = formString(fd, "customer_phone");
  const customerEmail =
    normalizeEmail(formStringOrNull(fd, "customer_email")) || null;
  const shippingMethod = formStringOrNull(fd, "shipping_method");
  const shippingStoreName = formStringOrNull(fd, "shipping_store_name");
  const shippingAddress = formStringOrNull(fd, "shipping_address");
  const paymentMethod = formStringOrNull(fd, "payment_method");
  const userNote = formStringOrNull(fd, "note");
  const cartItemsRaw = formString(fd, "cart_items");

  // 收件人那幾格（姓名、電話、付款、配送、門市／地址）的條件與訊息跟單品結帳同一份，
  // 收在 lib/checkout-fields（為什麼要收成一份，見該檔說明）。門市／地址那條原本排在
  // 購物車內容檢查後面，現在跟其他表單欄位一起排在前面：兩種都不合格時客人先看到的
  // 會從「購物車內容有誤」變成「請填地址」，先講他改得動的那格。
  const fieldsErr = checkoutFieldsError({
    customerName,
    customerPhone,
    paymentMethod,
    shippingMethod,
    shippingStoreName,
    shippingAddress,
  });
  if (fieldsErr) {
    return NextResponse.json({ error: fieldsErr }, { status: 400 });
  }

  // 不信任 client 傳來的購物車：解讀與檢查的口徑全收在 lib/cart-payload
  // （為什麼每一條都不能放行，見該檔說明）。
  const cart = parseCartPayload(cartItemsRaw);
  if (!cart.ok) {
    return NextResponse.json({ error: cart.error }, { status: 400 });
  }
  const cartItems = cart.items;

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, slug, is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: "店面不存在" }, { status: 404 });

  // 查所有商品
  const ids = cartItems.map((c) => c.productId);
  const { data: products } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, stock, is_active")
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .in("id", ids);
  if (!products || products.length !== ids.length) {
    return NextResponse.json({ error: "部分商品已下架，請重新確認購物車" }, { status: 400 });
  }

  // 庫存檢查 + atomic 扣減（用 service_role）
  const admin = createAdminClient();
  // 記「這張單扣了誰幾件」，失敗時逐筆加回去（不能記舊值整欄蓋回，
  // 會把 rollback 空檔中別的客人買走的庫存變回來，原因見 restoreStock）
  const decremented: { id: string; qty: number }[] = [];
  let totalCents = 0;
  let currency = "TWD";

  for (const item of cartItems) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return NextResponse.json({ error: "商品錯誤" }, { status: 400 });
    if (product.stock !== null) {
      // 扣減走 decrementStock 的重讀重試：頁面早前讀到的 stock 只當「有限量」
      // 的判斷，實際夠不夠以扣減當下重讀的為準——跟別的客人前後腳下單，
      // 只要庫存真的夠就不再整單退回。
      const dec = await decrementStock(admin, product.id, item.qty);
      if (!dec.ok) {
        // rollback already decremented
        for (const b of decremented) {
          await restoreStock(admin, b.id, b.qty);
        }
        if (dec.reason === "insufficient") {
          return NextResponse.json({
            error: insufficientStockError(dec.stock, product.name),
          }, { status: 400 });
        }
        // 撞單那句跟單品結帳同一份（收在 lib/product-stock，為什麼統一成這句見該檔
        // 說明）：說法從「庫存剛被搶光，請重試」改成「剛剛有其他客人下單，庫存已變動，
        // 請重新確認」。回應碼維持 409。
        return NextResponse.json({
          error: stockConflictError(product.name),
        }, { status: 409 });
      }
      if (dec.decremented) {
        decremented.push({ id: product.id, qty: item.qty });
      }
    }
    totalCents += product.price_cents * item.qty;
    currency = product.currency;
  }

  // 建訂單
  const finalNote = encodeShippingIntoNote(
    shippingMethod,
    shippingStoreName,
    userNote
  );

  // 如果客人已登入，把訂單 link 到客人 account
  const supabaseUser = await createClient();
  const { data: userData } = await supabaseUser.auth.getUser();
  const customerId = userData.user?.id ?? null;

  // 訂單那一列的欄位與初始狀態跟單品結帳同一份，收在 lib/order-rows（原因見該檔說明）。
  const { data: order, error: orderError } = await admin
    .from("sproutly_orders")
    .insert(
      buildOrderRow({
        merchantId: store.id,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        shippingAddress,
        note: finalNote,
        totalCents,
        currency,
        paymentMethod,
      })
    )
    .select("id")
    .single();

  if (orderError || !order) {
    // rollback
    for (const b of decremented) {
      await restoreStock(admin, b.id, b.qty);
    }
    return NextResponse.json({ error: "訂單建立失敗" }, { status: 500 });
  }

  // 建 order_items
  const orderItemsData = cartItems.map((item) => {
    const p = products.find((x) => x.id === item.productId)!;
    return buildOrderItemRow({ orderId: order.id, product: p, quantity: item.qty });
  });
  const { error: itemsErr } = await admin
    .from("sproutly_order_items")
    .insert(orderItemsData);
  if (itemsErr) {
    await admin.from("sproutly_orders").delete().eq("id", order.id);
    for (const b of decremented) {
      await restoreStock(admin, b.id, b.qty);
    }
    return NextResponse.json({ error: "訂單明細失敗" }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id });
}
