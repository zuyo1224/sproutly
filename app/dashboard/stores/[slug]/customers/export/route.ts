import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// CSV 檔名日期的台灣時區日期 key 跟訂單匯出共用同一份（見檔內說明）。
import { taipeiDateKey, taipeiDateNumeric } from "@/lib/format-date";
// 金額欄表頭的貨幣符號跟商品編輯頁共用同一份（TWD→NT$，其他幣別顯示代碼）。
import { currencySymbol, centsToYuan } from "@/lib/format-price";
// VIP / 回購標籤門檻跟客人列表頁共用同一份，避免列表標了 VIP 但 CSV 沒標。
import { customerTier } from "@/lib/customer-tags";
// CSV 欄位轉義跟訂單匯出共用同一份（見檔內說明）。
import { csvDocument, csvDownloadHeaders, csvExportFilename, csvRow } from "@/lib/csv-escape";
import { matchesCustomerSearch } from "@/lib/customer-search";
// 每位客人一列的彙總、排序白名單與排序跟客人列表頁共用同一份（見 lib/customer-rows 說明）。
import {
  buildCustomerRows,
  isCustomerFilterActive,
  parseCustomerFilters,
  sortCustomerRows,
} from "@/lib/customer-rows";
// 撈整家店未取消訂單的查詢跟客人列表頁共用同一份（分頁撈齊，不吃 1000 列上限，
// 見 lib/fetch-customer-orders 說明）。
import { fetchCustomerOrders } from "@/lib/fetch-customer-orders";

type Params = Promise<{ slug: string }>;

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
  const filters = parseCustomerFilters({ q: sp.get("q"), sort: sp.get("sort") });
  const { q, sort } = filters;
  const filterActive = isCustomerFilterActive(filters);

  // 取消的單不算。分群本身跟客人列表頁共用同一份口徑
  // （見 lib/group-orders-by-customer 說明），兩邊不再各抄一套。
  const orderList = await fetchCustomerOrders(supabase, store.id);

  // 這份名單的金額欄一律跟著這間店出單的幣別走，跟客人列表頁同一套：
  // 拿任一筆訂單的 currency 當基準，非台幣的店家不再硬寫 NT$。
  const currencyLabel = currencySymbol(orderList[0]?.currency);

  const rows = buildCustomerRows(orderList);
  const filtered = q ? rows.filter((r) => matchesCustomerSearch(r, q)) : rows;
  sortCustomerRows(filtered, sort);

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

  const csvRows: string[] = [csvRow(headers)];

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
    csvRows.push(csvRow(row));
  });

  const csv = csvDocument(csvRows);
  const today = taipeiDateKey(new Date());
  // 篩選過的匯出檔名加註，避免商家把「只搜到的那幾位」誤當成全部客人
  const filename = csvExportFilename(store.name, "customers", today, filterActive);

  return new NextResponse(csv, {
    headers: csvDownloadHeaders(filename),
  });
}
