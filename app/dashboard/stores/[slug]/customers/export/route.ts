import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// CSV 檔名日期的台灣時區日期 key 跟訂單匯出共用同一份（見檔內說明）。
import { taipeiDateKey, taipeiDateNumeric } from "@/lib/format-date";
// 金額欄表頭的貨幣符號跟商品編輯頁共用同一份（TWD→NT$，其他幣別顯示代碼）。
import { currencySymbol, centsToYuan } from "@/lib/format-price";
// VIP / 回購標籤門檻跟客人列表頁共用同一份，避免列表標了 VIP 但 CSV 沒標。
import { customerTier } from "@/lib/customer-tags";
// CSV 欄位轉義跟訂單匯出共用同一份（見檔內說明）。
import { csvEscape } from "@/lib/csv-escape";
import { matchesCustomerSearch } from "@/lib/customer-search";
import { compareIsoAsc, compareIsoDesc } from "@/lib/date-compare";
import { isPaidOrder } from "@/lib/order-labels";

type Params = Promise<{ slug: string }>;

// 客人頁的排序選項白名單，跟列表頁一致
const VALID_SORT = ["recent", "spend", "orders", "first"];

type OrderRow = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  total_cents: number;
  currency: string;
  payment_status: string;
  status: string;
  created_at: string;
};

export async function GET(request: Request, { params }: { params: Params }) {
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

  // 客人列表頁帶著當下的搜尋／排序跳來這支匯出，商家搜「VIP 那位」或排「總消費高→低」
  // 按匯出，期待拿到的就是眼前那份排序好的名單 —— 跟訂單匯出同一套「匯出 = 眼前所見」。
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const sort = VALID_SORT.includes(sp.get("sort") ?? "")
    ? sp.get("sort")!
    : "recent";
  const filterActive = q !== "" || sort !== "recent";

  // 分群邏輯與客人列表頁一字不差：取消的單不算，有 customer_id 用會員 ID 分群、
  // 否則 fallback 用電話。兩邊各算各的就會對不上，所以刻意複製同一套。
  const { data: orders } = await supabase
    .from("sproutly_orders")
    .select(
      "id, customer_id, customer_name, customer_email, customer_phone, total_cents, currency, payment_status, status, created_at"
    )
    .eq("merchant_id", store.id)
    .neq("status", "cancelled");

  const orderList = (orders as OrderRow[] | null) ?? [];

  // 這份名單的金額欄一律跟著這間店出單的幣別走，跟客人列表頁同一套：
  // 拿任一筆訂單的 currency 當基準，非台幣的店家不再硬寫 NT$。
  const currencyLabel = currencySymbol(orderList[0]?.currency);

  type CustomerRow = {
    identityType: "account" | "guest";
    name: string;
    email: string | null;
    phone: string;
    orderCount: number;
    paidCount: number;
    totalCents: number;
    paidCents: number;
    firstOrderAt: string;
    lastOrderAt: string;
  };

  const groups = new Map<string, OrderRow[]>();
  for (const order of orderList) {
    const key = order.customer_id
      ? `account:${order.customer_id}`
      : `guest:${order.customer_phone || "unknown"}`;
    const arr = groups.get(key) ?? [];
    arr.push(order);
    groups.set(key, arr);
  }

  const rows: CustomerRow[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) =>
      compareIsoAsc(a.created_at, b.created_at)
    );
    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];
    const total = group.reduce((sum, o) => sum + o.total_cents, 0);
    const paidOrders = group.filter((o) => isPaidOrder(o.payment_status));
    const paidCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);
    rows.push({
      identityType: key.startsWith("account:") ? "account" : "guest",
      name: latest.customer_name || "—",
      email: latest.customer_email,
      phone: latest.customer_phone,
      orderCount: group.length,
      paidCount: paidOrders.length,
      totalCents: total,
      paidCents,
      firstOrderAt: earliest.created_at,
      lastOrderAt: latest.created_at,
    });
  }

  const filtered = q ? rows.filter((r) => matchesCustomerSearch(r, q)) : rows;

  switch (sort) {
    case "spend":
      filtered.sort((a, b) => b.totalCents - a.totalCents);
      break;
    case "orders":
      filtered.sort((a, b) => b.orderCount - a.orderCount);
      break;
    case "first":
      filtered.sort((a, b) =>
        compareIsoAsc(a.firstOrderAt, b.firstOrderAt)
      );
      break;
    default:
      filtered.sort((a, b) =>
        compareIsoDesc(a.lastOrderAt, b.lastOrderAt)
      );
  }

  const headers = [
    "客人姓名",
    "身分",
    "電話",
    "Email",
    "標籤",
    "訂單筆數",
    "已付款筆數",
    `累計消費（${currencyLabel}）`,
    `已收金額（${currencyLabel}）`,
    "首次下單",
    "最近下單",
  ];

  const csvRows: string[] = [headers.map(csvEscape).join(",")];

  filtered.forEach((r) => {
    // 標籤判定跟列表頁同門檻：VIP = 累計 NT$ 2,000+，回購 = 2 筆以上
    const tags: string[] = [];
    if (r.identityType === "account") tags.push("會員");
    const tier = customerTier(r.totalCents, r.orderCount);
    if (tier === "vip") tags.push("VIP");
    else if (tier === "returning") tags.push("回購");

    const row = [
      r.name,
      r.identityType === "account" ? "會員" : "匿名",
      r.phone,
      r.email ?? "",
      tags.join("、"),
      r.orderCount,
      r.paidCount,
      centsToYuan(r.totalCents),
      centsToYuan(r.paidCents),
      taipeiDateNumeric(r.firstOrderAt),
      taipeiDateNumeric(r.lastOrderAt),
    ];
    csvRows.push(row.map(csvEscape).join(","));
  });

  // UTF-8 BOM 讓 Excel 開中文不亂碼
  const csv = "﻿" + csvRows.join("\r\n");
  const today = taipeiDateKey(new Date());
  // 篩選過的匯出檔名加註，避免商家把「只搜到的那幾位」誤當成全部客人
  const filename = `${store.name}-customers-${today}${filterActive ? "-篩選" : ""}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
