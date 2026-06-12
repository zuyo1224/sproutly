import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) return NextResponse.json([]);

  // 帶上 stock：購物車頁靠它擋「數量超過庫存／缺貨」在結帳前，
  // 但這支 API 原本沒回 stock，害那層保護整個沒作用（p.stock 永遠 undefined
  // → 加號不卡上限、缺貨不提示、去結帳鈕不擋，客人填完整張結帳表才被退回）。
  // 收藏頁不讀 stock、checkout 頁也沒宣告，多回一欄對它們無害。
  const { data } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, stock, image_urls")
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .in("id", ids);

  return NextResponse.json(data ?? []);
}
