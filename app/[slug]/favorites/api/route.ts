import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

type Params = Promise<{ slug: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  // ids 來自客人瀏覽器的 localStorage（購物車／收藏／最近看過）或任何人打的網址，
  // 不保證是正規 UUID。商品 id 欄位是 uuid：只要清單裡混進一個不是 UUID 的字串，
  // 下面 .in("id", ids) 整句查詢會被 Postgres 打回（22P02），data 變 null、這支回空
  // 陣列——購物車頁／收藏頁看起來像整批商品都下架了，而且三個呼叫端都設計成
  // 「API 至少回一筆才清幽靈 id」，那個壞 id 就永遠留在 localStorage，每次載入都
  // 把整車有效商品一起拖成空白，客人清不掉也不知道發生什麼事。先把不是 UUID 的
  // 濾掉（順便去重，同一個 id 重複帶進來查詢字串只是變長），只拿合法的去查；
  // 壞 id 查不到，呼叫端的幽靈清理這回終於能把它掃掉。
  const ids = Array.from(
    new Set(
      idsParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && isUuid(s))
    )
  );

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
