import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  paymentMethodLabel,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  decodeShippingFromNote,
  shortOrderId,
} from "@/lib/order-labels";
// 檔名日期的台灣時區日期 key、篩選區間起點都跟訂單列表共用同一份（見檔內說明）。
import {
  taipeiDateKey,
  taipeiRangeSince,
  taipeiStampNumeric,
} from "@/lib/format-date";
// CSV 欄位轉義跟客人匯出共用同一份（見檔內說明）。
import { csvEscape } from "@/lib/csv-escape";
// 分轉整數元的 CSV 金額欄跟客人匯出共用同一份（見檔內說明）。
import { centsToYuan } from "@/lib/format-price";

type Params = Promise<{ slug: string }>;

// 匯出篩選的狀態白名單跟訂單列表 chip、詳情下拉同一條 canonical 順序（見 order-labels）。
// 付款白名單同理收成 PAYMENT_STATUSES，跟列表 chip 的 PAYMENT_FILTERS、詳情徽章、改狀態
// action 的 ALLOWED_PAYMENT 同一條來源——日後增刪一個付款狀態不會「列表能篩但匯出悄悄擋掉」。
const VALID_STATUS = ORDER_STATUSES;
const VALID_PAY = PAYMENT_STATUSES;
const VALID_RANGE = ["today", "week", "month"];

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
  const status = VALID_STATUS.includes(sp.get("status") ?? "")
    ? sp.get("status")!
    : "all";
  const pay = VALID_PAY.includes(sp.get("pay") ?? "") ? sp.get("pay")! : "all";
  const range = VALID_RANGE.includes(sp.get("range") ?? "")
    ? sp.get("range")!
    : "all";
  const q = (sp.get("q") ?? "").trim();
  const since = taipeiRangeSince(range);
  const filterActive = status !== "all" || pay !== "all" || range !== "all" || q !== "";

  let ordersQuery = supabase
    .from("sproutly_orders")
    .select("*")
    .eq("merchant_id", store.id);
  if (status !== "all") ordersQuery = ordersQuery.eq("status", status);
  if (pay !== "all") ordersQuery = ordersQuery.eq("payment_status", pay);
  if (q) {
    const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
    ordersQuery = ordersQuery.or(
      `customer_name.ilike.%${escaped}%,customer_phone.ilike.%${escaped}%,customer_email.ilike.%${escaped}%`
    );
  }
  if (since) ordersQuery = ordersQuery.gte("created_at", since.toISOString());
  const { data: orders } = await ordersQuery.order("created_at", {
    ascending: false,
  });

  const { data: allItems } = await supabase
    .from("sproutly_order_items")
    .select(
      "order_id, name_snapshot, quantity, price_cents_snapshot, sproutly_orders!inner(merchant_id)"
    )
    .eq("sproutly_orders.merchant_id", store.id);

  // group items by order_id
  const itemsByOrder = new Map<
    string,
    { name: string; qty: number; price: number }[]
  >();
  type ItemRow = {
    order_id: string;
    name_snapshot: string;
    quantity: number;
    price_cents_snapshot: number;
  };
  (allItems as ItemRow[] | null)?.forEach((it) => {
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

  const rows: string[] = [headers.map(csvEscape).join(",")];

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
    rows.push(row.map(csvEscape).join(","));
  });

  // UTF-8 BOM 讓 Excel 開中文不亂碼
  const csv = "﻿" + rows.join("\r\n");
  const today = taipeiDateKey(new Date());
  // 篩選過的匯出檔名加註，避免商家把「只有未付款」那份誤當成全部訂單
  const filename = `${store.name}-orders-${today}${filterActive ? "-篩選" : ""}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
