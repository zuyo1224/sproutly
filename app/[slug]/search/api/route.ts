import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchesProductName, matchesProductDescription } from "@/lib/product-search";
import { bySoldOutLast } from "@/lib/product-stock";

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
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const named: typeof rows = [];
  const described: typeof rows = [];
  for (const p of rows) {
    if (matchesProductName(p, q)) named.push(p);
    else if (matchesProductDescription(p, q)) described.push(p);
  }
  // 名稱命中的排前面，描述命中的接後面，各群內售完的沉底，再取前 10 筆。
  // 名稱優先確保原本就搜得到的不會被新加入的描述命中擠掉；售完沉底跟首頁精選、
  // shop 逛街頁、收藏頁、商品詳情「這些也在店裡」同一套——快搜面板明明標了
  // 售完角標，沒沉底的話售完的照樣佔住前排，還可能把第 11 筆之後有貨的命中
  // 擠出前 10。Array.sort 穩定（ES2019+），各群內有貨與售完兩批各自維持
  // created_at 新到舊（上面的 .order 同時把原本沒指定、順序不保證的查詢釘住）。
  named.sort(bySoldOutLast);
  described.sort(bySoldOutLast);
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
