"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ORDER_STATUSES } from "@/lib/order-labels";

// 收狀態更新時的合法值跟訂單列表 chip、詳情下拉、匯出白名單同一條 canonical 順序。
const ALLOWED_STATUS = new Set(ORDER_STATUSES);
const ALLOWED_PAYMENT = new Set(["unpaid", "paid", "refunded"]);

export async function updateOrderStatus(
  slug: string,
  orderId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) redirect("/dashboard");

  const status = String(formData.get("status") ?? "");
  const paymentStatus = String(formData.get("payment_status") ?? "");

  // 表單每次都同時送出兩個欄位，所以時間戳只能在「真的切換進該狀態」時蓋章，
  // 不然已出貨的單之後隨便存一次檔，出貨時間就被蓋成現在
  const { data: current } = await supabase
    .from("sproutly_orders")
    .select("status, payment_status, paid_at, shipped_at")
    .eq("id", orderId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  if (!current) redirect(`/dashboard/stores/${slug}/orders`);

  const updates: Record<string, unknown> = {};
  if (ALLOWED_STATUS.has(status) && status !== current.status) {
    updates.status = status;
    if (status === "shipped" && !current.shipped_at) {
      updates.shipped_at = new Date().toISOString();
    }
    // 誤按出貨後改回待確認/已確認 → 把錯蓋的出貨章清掉（已完成/已取消保留）
    if ((status === "pending" || status === "confirmed") && current.shipped_at) {
      updates.shipped_at = null;
    }
  }
  if (ALLOWED_PAYMENT.has(paymentStatus) && paymentStatus !== current.payment_status) {
    updates.payment_status = paymentStatus;
    if (paymentStatus === "paid" && !current.paid_at) {
      updates.paid_at = new Date().toISOString();
    }
    // 誤按已付款後改回未付款 → 清掉付款章；改成已退款保留（錢確實付過）
    if (paymentStatus === "unpaid" && current.paid_at) {
      updates.paid_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    redirect(`/dashboard/stores/${slug}/orders/${orderId}`);
  }

  const { error } = await supabase
    .from("sproutly_orders")
    .update(updates)
    .eq("id", orderId)
    .eq("merchant_id", store.id);

  if (error) {
    redirect(
      `/dashboard/stores/${slug}/orders/${orderId}?error=` +
        encodeURIComponent(error.message)
    );
  }

  redirect(`/dashboard/stores/${slug}/orders/${orderId}?saved=1`);
}
