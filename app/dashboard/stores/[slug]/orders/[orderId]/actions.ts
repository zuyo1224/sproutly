"use server";

import { requireUser } from "@/lib/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/order-labels";
import { adjustStock } from "@/lib/stock-restore";

// 收狀態更新時的合法值跟訂單列表 chip、詳情下拉、匯出白名單同一條 canonical 順序。
const ALLOWED_STATUS = new Set(ORDER_STATUSES);
const ALLOWED_PAYMENT = new Set(PAYMENT_STATUSES);

export async function updateOrderStatus(
  slug: string,
  orderId: string,
  formData: FormData
) {
  const { supabase, user } = await requireUser();

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

  // 取消／取消復原要連動庫存（下面那段），所以狀態有變時把更新做成「原狀態還是
  // 剛剛讀到的那個才生效」：連點兩下取消、或兩個分頁同時操作，第二發會因為狀態
  // 已經不是舊值而整筆不中，庫存就不會被補兩次。沒動狀態（只改付款）不加這條件，
  // 免得別人剛好改了狀態害付款更新無聲失效。
  let query = supabase
    .from("sproutly_orders")
    .update(updates)
    .eq("id", orderId)
    .eq("merchant_id", store.id);
  if (typeof updates.status === "string") {
    query = query.eq("status", current.status);
  }
  const { data: changed, error } = await query.select("id");

  if (error) {
    redirect(
      `/dashboard/stores/${slug}/orders/${orderId}?error=` +
        encodeURIComponent(error.message)
    );
  }
  if (!changed || changed.length === 0) {
    redirect(
      `/dashboard/stores/${slug}/orders/${orderId}?error=` +
        encodeURIComponent("訂單剛被更新過（可能在別的視窗），請重新確認再操作")
    );
  }

  // 結帳當下就扣庫存（兩條結帳路徑都是），但取消訂單原本不會加回去：店家取消
  // 一筆單之後，那件商品在店面上還是顯示售完，得自己去商品頁改數字才賣得動。
  // 這裡補上：切進「已取消」把每個品項的數量加回去、從「已取消」改回別的狀態
  // 再扣回來（東西又要出了）。上面的比對更新保證同一次切換只會連動一次。
  // 商品已刪（product_id 被設 null）或庫存設不限量的品項，adjustStock 會自己跳過；
  // 調庫存失敗不擋狀態更新（訂單狀態才是主角，庫存少補一次店家看得到能手動修）。
  const becameCancelled =
    updates.status === "cancelled" && current.status !== "cancelled";
  const leftCancelled =
    typeof updates.status === "string" && current.status === "cancelled";
  if (becameCancelled || leftCancelled) {
    const admin = createAdminClient();
    const { data: items } = await admin
      .from("sproutly_order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId);
    for (const item of items ?? []) {
      if (!item.product_id) continue;
      await adjustStock(
        admin,
        item.product_id,
        becameCancelled ? item.quantity : -item.quantity
      );
    }
  }

  redirect(`/dashboard/stores/${slug}/orders/${orderId}?saved=1`);
}
