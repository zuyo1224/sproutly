"use server";

import { requireUser } from "@/lib/require-user";
import { redirect } from "next/navigation";
import { nextOrderStatus, isUnpaidOrder } from "@/lib/order-labels";

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

// 訂單列表上的「收款」——把還沒收到錢的單一鍵標記成已付款。跟上面那支 advanceOrderStatus
// 是同一個痛點的另一半：轉帳與貨到付款的店，錢進來的時機跟出貨流程各走各的（客人昨天匯款、
// 單子還停在待確認；貨到付款是出貨完才收到錢），所以商家一天裡要做的第二件常事就是把
// 對到帳的單標一標。以前一樣得點進詳情頁、拉付款下拉、按存檔、退回列表。
// 這支只做 未付款→已付款 這一格：已退款不能用它回頭（那是把退掉的錢當成又收到，語意不對），
// 要改回未付款或標退款仍在詳情頁做。訂單狀態完全不動（收到錢跟走到哪一步是兩件事）。
export async function markOrderPaid(
  slug: string,
  orderId: string,
  // 按鈕畫出來當下這筆單的付款狀態，比對用途跟 advanceOrderStatus 的 fromStatus 一樣：
  // 兩個分頁同時開列表時，另一頁剛標過的單這頁不會再標一次。
  fromPaymentStatus: string,
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
    .select("id, status, payment_status, paid_at")
    .eq("id", orderId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  // 找不到這筆、或畫面上的付款狀態已經過期：安靜跳回列表，不當成錯誤。
  if (!current || current.payment_status !== fromPaymentStatus) {
    redirect(listUrl);
  }
  // 只認未付款這一格；已取消的單也不給列表一鍵收款（要把取消的單記成收到錢是特殊情況，
  // 留在詳情頁讓商家看著整筆單決定）。畫面上本來就不會畫這顆按鈕，這裡是第二道。
  if (!isUnpaidOrder(current.payment_status) || current.status === "cancelled") {
    redirect(listUrl);
  }

  // 付款時間章的規則跟詳情頁逐字一樣：只在還沒蓋過時蓋，免得之前付過又退款、現在再標
  // 一次已付款時把原本的付款時間改寫成今天。
  const updates: Record<string, unknown> = { payment_status: "paid" };
  if (!current.paid_at) {
    updates.paid_at = new Date().toISOString();
  }

  // 「原付款狀態還是剛剛讀到的那個才生效」：連按兩下、或別的分頁同時操作時，第二發
  // 會因為值已經不是舊的而整筆不中。
  const { data: changed, error } = await supabase
    .from("sproutly_orders")
    .update(updates)
    .eq("id", orderId)
    .eq("merchant_id", store.id)
    .eq("payment_status", current.payment_status)
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
