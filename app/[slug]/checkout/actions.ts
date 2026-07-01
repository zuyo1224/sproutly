"use server";
import { formString, formStringOrNull } from "@/lib/form-fields";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { encodeShippingIntoNote, SHIPPING_LABELS, PAYMENT_LABELS, shippingDetailError } from "@/lib/order-labels";
import { QTY_MIN, QTY_MAX, isValidQty } from "@/lib/product-quantity";

export async function placeOrder(slug: string, formData: FormData) {
  const productId = formString(formData, "product_id");
  const qtyRaw = String(formData.get("quantity") ?? "1").trim();
  const customerName = formString(formData, "customer_name");
  const customerPhone = formString(formData, "customer_phone");
  const customerEmail =
    formStringOrNull(formData, "customer_email");
  const shippingAddress =
    formStringOrNull(formData, "shipping_address");
  const userNote = formStringOrNull(formData, "note");
  const paymentMethod =
    formStringOrNull(formData, "payment_method");
  const shippingMethod =
    formStringOrNull(formData, "shipping_method");
  const shippingStoreName =
    formStringOrNull(formData, "shipping_store_name");

  const baseRedirect = `/${slug}/checkout?product_id=${productId}&qty=${qtyRaw}`;

  if (!productId) redirect(`/${slug}`);

  const quantity = Number(qtyRaw);
  if (!isValidQty(quantity)) {
    redirect(baseRedirect + "&error=" + encodeURIComponent(`數量必須是 ${QTY_MIN}-${QTY_MAX}`));
  }
  if (!customerName) {
    redirect(baseRedirect + "&error=" + encodeURIComponent("請填收件人姓名"));
  }
  if (!customerPhone) {
    redirect(baseRedirect + "&error=" + encodeURIComponent("請填聯絡電話"));
  }
  if (!paymentMethod || !PAYMENT_LABELS[paymentMethod]) {
    redirect(baseRedirect + "&error=" + encodeURIComponent("請選擇付款方式"));
  }
  if (!shippingMethod || !SHIPPING_LABELS[shippingMethod]) {
    redirect(baseRedirect + "&error=" + encodeURIComponent("請選擇配送方式"));
  }
  // 超商取貨必須填門市、宅配必須填地址（規則與訊息收在 shippingDetailError 單一來源）
  const shippingErr = shippingDetailError(
    shippingMethod,
    shippingStoreName,
    shippingAddress
  );
  if (shippingErr) {
    redirect(baseRedirect + "&error=" + encodeURIComponent(shippingErr));
  }

  const supabase = await createClient();

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, slug, is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) redirect(`/${slug}`);

  const { data: product } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, stock, is_active, merchant_id")
    .eq("id", productId)
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!product) {
    redirect(baseRedirect + "&error=" + encodeURIComponent("商品已下架"));
  }

  if (product.stock !== null && product.stock < quantity) {
    redirect(
      baseRedirect +
        "&error=" +
        encodeURIComponent(
          product.stock === 0
            ? "商品已售完"
            : `庫存只剩 ${product.stock} 件`
        )
    );
  }

  // Atomic 庫存扣減（optimistic locking 防超賣）
  const admin = createAdminClient();
  if (product.stock !== null) {
    const { data: updated, error: updateError } = await admin
      .from("sproutly_products")
      .update({ stock: product.stock - quantity })
      .eq("id", productId)
      .eq("stock", product.stock)
      .select("id");
    if (updateError) {
      redirect(
        baseRedirect + "&error=" + encodeURIComponent(updateError.message)
      );
    }
    if (!updated || updated.length === 0) {
      redirect(
        baseRedirect +
          "&error=" +
          encodeURIComponent("剛剛有其他客人下單，庫存已變動，請重新確認")
      );
    }
  }

  // 把物流資訊編碼進 note 欄位（避免需要 schema migration）
  const finalNote = encodeShippingIntoNote(
    shippingMethod,
    shippingStoreName,
    userNote
  );

  // 如果客人已登入，把訂單 link 到客人 account
  const supabaseUser = await createClient();
  const { data: userData } = await supabaseUser.auth.getUser();
  const customerId = userData.user?.id ?? null;

  const totalCents = product.price_cents * quantity;
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
      currency: product.currency,
      status: "pending",
      payment_method: paymentMethod,
      payment_status: "unpaid",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    if (product.stock !== null) {
      await admin
        .from("sproutly_products")
        .update({ stock: product.stock })
        .eq("id", productId);
    }
    redirect(
      baseRedirect +
        "&error=" +
        encodeURIComponent("訂單建立失敗：" + (orderError?.message ?? ""))
    );
  }

  const { error: itemError } = await admin
    .from("sproutly_order_items")
    .insert({
      order_id: order.id,
      product_id: product.id,
      name_snapshot: product.name,
      price_cents_snapshot: product.price_cents,
      quantity,
    });

  if (itemError) {
    await admin.from("sproutly_orders").delete().eq("id", order.id);
    if (product.stock !== null) {
      await admin
        .from("sproutly_products")
        .update({ stock: product.stock })
        .eq("id", productId);
    }
    redirect(
      baseRedirect +
        "&error=" +
        encodeURIComponent("訂單明細建立失敗：" + itemError.message)
    );
  }

  redirect(`/${slug}/checkout/success/${order.id}`);
}
