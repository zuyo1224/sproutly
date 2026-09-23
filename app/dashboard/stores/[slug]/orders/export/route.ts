import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  paymentMethodLabel,
  PAYMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  decodeShippingFromNote,
  shortOrderId,
} from "@/lib/order-labels";
// 檔名日期的台灣時區日期 key 跟訂單列表共用同一份（見檔內說明）。
import { taipeiDateKey, taipeiStampNumeric } from "@/lib/format-date";
// CSV 欄位轉義跟客人匯出共用同一份（見檔內說明）。
import { csvDocument, csvDownloadHeaders, csvExportFilename, csvRow } from "@/lib/csv-escape";
// 分轉整數元的 CSV 金額欄跟客人匯出共用同一份（見檔內說明）。
import { centsToYuan } from "@/lib/format-price";
// 照篩選撈訂單跟訂單列表頁共用同一條查詢（見檔內說明）。
import { fetchFilteredOrders } from "@/lib/fetch-filtered-orders";
import { fetchOrderItems } from "@/lib/fetch-order-items";
// 篩選參數白名單與「有沒有篩選」跟訂單列表頁共用同一份（見檔內說明）。
import { isOrderFilterActive, parseOrderFilters } from "@/lib/order-filters";

type Params = Promise<{ slug: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return new NextResponse("Not found", { status: 404 });

  // 訂單列表頁帶著當下的篩選（狀態 / 付款 / 時間 / 搜尋）跳來這支匯出，
  // 商家篩到「本月 · 已出貨 · 未付款」按匯出，期待拿到的就是那批 —— 原本不管篩選
  // 一律匯出全部，跟畫面對不上。這裡用跟列表頁一模一樣的條件，匯出 = 眼前所見。
  const sp = new URL(request.url).searchParams;
  const filters = parseOrderFilters({
    status: sp.get("status"),
    pay: sp.get("pay"),
    range: sp.get("range"),
    q: sp.get("q"),
  });
  const filterActive = isOrderFilterActive(filters);

  // 訂單本體照篩選撈齊（超過 1000 筆不漏、新到舊、搜尋分流 DB ilike／記憶體比對），
  // 跟列表頁吃 lib/fetch-filtered-orders 同一條查詢，「列表看到哪批、匯出就是哪批」。
  const orders = await fetchFilteredOrders(supabase, store.id, filters);

  // 品項只查「這次要匯出的訂單」的，不是全店歷史全部——原本用 merchant_id join
  // 撈整家店的品項，Supabase 一次最多回約 1000 列，店累積品項超過之後，落在
  // 上限外的訂單在 CSV 裡「商品」欄空白、「件數」變 0，畫面上明明看得到品項。
  // 撈法（分批 in() 顧網址長度、每批再翻頁顧 1000 列上限）收在 lib/fetch-order-items，
  // 跟客人的訂單紀錄共用同一份——同一件事兩處各抄一份的時候，1000 列那半也兩處一起漏。
  const itemsByOrder = new Map<
    string,
    { name: string; qty: number; price: number }[]
  >();
  const orderIds = (orders ?? []).map((o) => o.id as string);
  (await fetchOrderItems(supabase, orderIds)).forEach((it) => {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({
      name: it.name_snapshot,
      qty: it.quantity,
      price: it.price_cents_snapshot,
    });
    itemsByOrder.set(it.order_id, arr);
  });

  const headers = [
    "訂單編號",
    "下單時間",
    "顧客姓名",
    "顧客電話",
    "顧客 Email",
    "訂單狀態",
    "付款狀態",
    "付款方式",
    "配送方式",
    "取貨門市",
    "收件地址",
    "商品",
    "件數",
    "備註",
    "金額",
    "幣別",
    "下單時間 (ISO)",
    "付款時間",
    "出貨時間",
  ];

  const rows: string[] = [csvRow(headers)];

  orders?.forEach((o) => {
    const items = itemsByOrder.get(o.id) ?? [];
    const itemsText = items
      .map((it) => `${it.name} × ${it.qty}`)
      .join("；");
    const totalQty = items.reduce((s, it) => s + it.qty, 0);
    const decoded = decodeShippingFromNote(o.note);
    const paymentLabel = paymentMethodLabel(o.payment_method) ?? "";

    const row = [
      "#" + shortOrderId(o.id),
      taipeiStampNumeric(o.created_at),
      o.customer_name,
      o.customer_phone,
      o.customer_email ?? "",
      ORDER_STATUS_LABELS[o.status] ?? o.status,
      PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status,
      paymentLabel,
      decoded.shippingLabel ?? "",
      decoded.storeName ?? "",
      o.shipping_address ?? "",
      itemsText,
      totalQty,
      decoded.userNote ?? "",
      centsToYuan(o.total_cents),
      o.currency,
      o.created_at,
      o.paid_at ?? "",
      o.shipped_at ?? "",
    ];
    rows.push(csvRow(row));
  });

  const csv = csvDocument(rows);
  const today = taipeiDateKey(new Date());
  // 篩選過的匯出檔名加註，避免商家把「只有未付款」那份誤當成全部訂單
  const filename = csvExportFilename(store.name, "orders", today, filterActive);

  return new NextResponse(csv, {
    headers: csvDownloadHeaders(filename),
  });
}
