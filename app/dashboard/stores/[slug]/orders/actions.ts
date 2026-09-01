"use server";

import { requireUser } from "@/lib/require-user";
import { redirect } from "next/navigation";
import { nextOrderStatus } from "@/lib/order-labels";

// 訂單列表上的「往下一步推一格」。跟詳情頁那支 updateOrderStatus 是兩件事：那支是
// 五選一的下拉（能跳著改、能取消、能同時改付款），這支只做流程上的下一格，讓商家
// 早上開店掃一遍列表就能把該確認的確認、該出貨的出貨，不用一筆筆點進詳情頁再存檔。
// 因為只走 待確認→已確認→已出貨→已完成 這條線、碰不到「已取消」，所以不需要詳情頁
// 那段取消連動庫存的處理；付款狀態也完全不動（收到錢是另一件事，仍在詳情頁改）。
export async function advanceOrderStatus(
  slug: string,
  orderId: string,
  // 按鈕畫出來當下這筆單是什麼狀態。帶著它是為了兩個分頁同時開列表的情況：另一頁
  // 剛把單推到已出貨，這頁畫面還停在「確認」，若不比對就會照按照推，一下跳兩格。
  fromStatus: string,
  returnQs: string
) {
  const { supabase, user } = await requireUser();

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) redirect("/dashboard");

  const listUrl = `/dashboard/stores/${slug}/orders${returnQs ? `?${returnQs}` : ""}`;

  const { data: current } = await supabase
    .from("sproutly_orders")
    .select("id, status, shipped_at")
    .eq("id", orderId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  // 找不到這筆、畫面上的狀態已經過期、或這筆已經走到底：安靜跳回列表，不當成錯誤。
  if (!current || current.status !== fromStatus) {
    redirect(listUrl);
  }

  const next = nextOrderStatus(current.status);
  if (!next) {
    redirect(listUrl);
  }

  // 出貨時間章的規則跟詳情頁逐字一樣：只在真的切進「已出貨」而且還沒蓋過時蓋，
  // 免得同一筆單之後又被推一次，出貨時間被改寫成後來的時間。
  const updates: Record<string, unknown> = { status: next };
  if (next === "shipped" && !current.shipped_at) {
    updates.shipped_at = new Date().toISOString();
  }

  // 「原狀態還是剛剛讀到的那個才生效」：連按兩下、或別的分頁同時操作時，第二發
  // 會因為狀態已經不是舊值而整筆不中，不會一路把單推過頭。
  const { data: changed, error } = await supabase
    .from("sproutly_orders")
    .update(updates)
    .eq("id", orderId)
    .eq("merchant_id", store.id)
    .eq("status", current.status)
    .select("id");

  if (error) {
    redirect(
      `/dashboard/stores/${slug}/orders?error=` +
        encodeURIComponent(error.message)
    );
  }
  // 沒中就是被別處搶先改過了，跳回列表讓商家看到現在真正的狀態。
  if (!changed || changed.length === 0) {
    redirect(listUrl);
  }

  redirect(listUrl);
}
