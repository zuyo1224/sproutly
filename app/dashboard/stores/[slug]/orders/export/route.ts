import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  PAYMENT_LABELS,
  ORDER_STATUS_LABELS,
  decodeShippingFromNote,
  shortOrderId,
} from "@/lib/order-labels";
// 時間界線/檔名日期的台灣時區日期 key 跟訂單列表共用同一份（見檔內說明）。
import { taipeiDateKey } from "@/lib/format-date";

type Params = Promise<{ slug: string }>;

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  refunded: "已退款",
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // 含逗號、雙引號、換行 → 包雙引號 + escape 雙引號
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function computeSince(key: string): Date | null {
  const todayKey = taipeiDateKey(new Date());
  const midnight = new Date(`${todayKey}T00:00:00+08:00`);
  if (key === "today") return midnight;
  if (key === "week") {
    const day = new Date(`${todayKey}T00:00:00Z`).getUTCDay(); // 0 = 週日
    const back = day === 0 ? 6 : day - 1;
    return new Date(midnight.getTime() - back * 86_400_000);
  }
  if (key === "month") {
    return new Date(`${todayKey.slice(0, 8)}01T00:00:00+08:00`);
  }
  return null;
}

const VALID_STATUS = ["pending", "confirmed", "shipped", "completed", "cancelled"];
const VALID_PAY = ["unpaid", "paid", "refunded"];
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
  const since = computeSince(range);
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
    const paymentLabel = o.payment_method
      ? (PAYMENT_LABELS[o.payment_method] ?? o.payment_method)
      : "";

    const row = [
      "#" + shortOrderId(o.id),
      new Date(o.created_at).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      o.customer_name,
      o.customer_phone,
      o.customer_email ?? "",
      ORDER_STATUS_LABELS[o.status] ?? o.status,
      PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status,
      paymentLabel,
      decoded.shippingLabel ?? "",
      decoded.storeName ?? "",
      o.shipping_address ?? "",
      itemsText,
      totalQty,
      decoded.userNote ?? "",
      Math.round(o.total_cents / 100),
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
