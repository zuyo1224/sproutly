import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchesProductName, matchesProductDescription } from "@/lib/product-search";

type Params = Promise<{ slug: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([]);

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) return NextResponse.json([]);

  // 連商品描述一起比對（跟後台商品列表、逛街頁同一套口徑）：客人搜「耐陰」
  // 「適合新手」這種寫在描述、名稱沒有的字，原本只 ilike 名稱會查不到。
  // 一間店商品量不大，撈回來在 JS 篩比 PostgREST .or() 串接安全（免煩惱
  // 關鍵字含逗號／括號破壞 or 過濾語法，也免 %/_ 跳脫）。description 只拿來
  // 比對、不回傳，保持回應欄位跟原本一致。
  const { data } = await supabase
    .from("sproutly_products")
    .select("id, name, description, price_cents, currency, image_urls, stock")
    .eq("merchant_id", store.id)
    .eq("is_active", true);

  const rows = data ?? [];
  const named: typeof rows = [];
  const described: typeof rows = [];
  for (const p of rows) {
    if (matchesProductName(p, q)) named.push(p);
    else if (matchesProductDescription(p, q)) described.push(p);
  }
  // 名稱命中的排前面，描述命中的接後面，再取前 10 筆——確保原本就搜得到的
  // （名稱命中）不會被新加入的描述命中擠掉。
  const matched = [...named, ...described].slice(0, 10).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    currency: p.currency,
    image_urls: p.image_urls,
    stock: p.stock,
  }));

  return NextResponse.json(matched);
}
