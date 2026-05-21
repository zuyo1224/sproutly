import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_LABELS, decodeShippingFromNote } from "@/lib/order-labels";

type Params = Promise<{ slug: string }>;

const STATUS_LABEL: Record<string, string> = {
  pending: "待確認",
  confirmed: "已確認",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
};

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

export async function GET(
  _request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", _request.url));
  }

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return new NextResponse("Not found", { status: 404 });

  const { data: orders } = await supabase
    .from("sproutly_orders")
    .select("*")
    .eq("merchant_id", store.id)
    .order("created_at", { ascending: false });

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
    "金額（NT$）",
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
      "#" + o.id.split("-")[0].toUpperCase(),
      new Date(o.created_at).toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      o.customer_name,
      o.customer_phone,
      o.customer_email ?? "",
      STATUS_LABEL[o.status] ?? o.status,
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
  const today = new Date().toISOString().split("T")[0];
  const filename = `${store.name}-orders-${today}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
