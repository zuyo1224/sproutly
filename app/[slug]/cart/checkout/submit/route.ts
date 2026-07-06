import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  encodeShippingIntoNote,
  isSelectablePaymentMethod,
  SHIPPING_LABELS,
  shippingDetailError,
} from "@/lib/order-labels";
import { isValidQty } from "@/lib/product-quantity";
import { decrementStock, restoreStock } from "@/lib/stock-restore";

type Params = Promise<{ slug: string }>;

export async function POST(
  request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const fd = await request.formData();

  const customerName = String(fd.get("customer_name") ?? "").trim();
  const customerPhone = String(fd.get("customer_phone") ?? "").trim();
  const customerEmail =
    String(fd.get("customer_email") ?? "").trim() || null;
  const shippingMethod =
    String(fd.get("shipping_method") ?? "").trim() || null;
  const shippingStoreName =
    String(fd.get("shipping_store_name") ?? "").trim() || null;
  const shippingAddress =
    String(fd.get("shipping_address") ?? "").trim() || null;
  const paymentMethod =
    String(fd.get("payment_method") ?? "").trim() || null;
  const userNote = String(fd.get("note") ?? "").trim() || null;
  const cartItemsRaw = String(fd.get("cart_items") ?? "").trim();

  if (!customerName) return NextResponse.json({ error: "請填收件人姓名" }, { status: 400 });
  if (!customerPhone) return NextResponse.json({ error: "請填電話" }, { status: 400 });
  // 合法性看 isSelectablePaymentMethod（名單上且未停用），不吃顯示用的 PAYMENT_LABELS——
  // 那份含停用中的信用卡，拿來當白名單會把「即將推出」的金流放行（緣由見該檔說明）。
  if (!isSelectablePaymentMethod(paymentMethod))
    return NextResponse.json({ error: "請選擇付款方式" }, { status: 400 });
  if (!shippingMethod || !SHIPPING_LABELS[shippingMethod])
    return NextResponse.json({ error: "請選擇配送方式" }, { status: 400 });

  let parsedCart: unknown;
  try {
    parsedCart = JSON.parse(cartItemsRaw);
    if (!Array.isArray(parsedCart) || parsedCart.length === 0) throw new Error();
  } catch {
    return NextResponse.json({ error: "購物車是空的" }, { status: 400 });
  }

  // 不信任 client 傳來的數量：必須是 1-99 的整數，否則拒絕。
  // （沒這層的話，前端被改成 qty: -5 會讓總額算成負數、庫存反而被加回去）
  const cartItems: { productId: string; qty: number }[] = [];
  const seenIds = new Set<string>();
  for (const raw of parsedCart) {
    const productId = typeof raw?.productId === "string" ? raw.productId : "";
    const qty = Number(raw?.qty);
    if (
      !productId ||
      !isValidQty(qty) ||
      seenIds.has(productId)
    ) {
      return NextResponse.json({ error: "購物車內容有誤，請重新確認" }, { status: 400 });
    }
    seenIds.add(productId);
    cartItems.push({ productId, qty });
  }

  const shippingErr = shippingDetailError(
    shippingMethod,
    shippingStoreName,
    shippingAddress
  );
  if (shippingErr) {
    return NextResponse.json({ error: shippingErr }, { status: 400 });
  }

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
            error: `「${product.name}」庫存不足，剩 ${dec.stock}`,
          }, { status: 400 });
        }
        return NextResponse.json({
          error: `「${product.name}」庫存剛被搶光，請重試`,
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

  const { data: order, error: orderError } = await admin
    .from("sproutly_orders")
    .insert({
      merchant_id: store.id,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      shipping_address: shippingAddress,
      note: finalNote,
      total_cents: totalCents,
      currency,
      status: "pending",
      payment_method: paymentMethod,
      payment_status: "unpaid",
    })
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
    return {
      order_id: order.id,
      product_id: p.id,
      name_snapshot: p.name,
      price_cents_snapshot: p.price_cents,
      quantity: item.qty,
    };
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
