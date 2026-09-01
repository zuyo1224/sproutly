import { requireUser } from "@/lib/require-user";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/format-price";
import { isSoldOut, isLowStock } from "@/lib/product-stock";
import { matchesProductSearch } from "@/lib/product-search";
import {
  moveProductOrder,
  setProductStock,
  toggleProductActive,
} from "./actions";
import { SubmitButton } from "@/app/_components/submit-button";
// 商品撈整批要分頁撈齊，不然吃 Supabase 1000 列上限，見 fetch-all-rows。
import { fetchAllRows } from "@/lib/fetch-all-rows";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; filter?: string; error?: string }>;

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_urls: string[] | null;
  stock: number | null;
  is_active: boolean;
};

// 快沒貨判斷走 product-stock 的 isLowStock，跟卡片上的「剩 N 件」、後台首頁的
// 快沒貨清單、客人端全站同一份門檻（LOW_STOCK_THRESHOLD），不會各說各話。
// 以前這裡寫死 stock < 5（≤4），客人端卻是 ≤3，兩邊其實對不上才收成這一份。
const STATUS_FILTERS: {
  key: string;
  label: string;
  match: (p: ProductRow) => boolean;
}[] = [
  { key: "all", label: "全部", match: () => true },
  { key: "active", label: "上架中", match: (p) => p.is_active },
  { key: "inactive", label: "停售中", match: (p) => !p.is_active },
  {
    key: "low",
    label: "快沒貨",
    match: (p) => isLowStock(p.stock),
  },
  { key: "soldout", label: "已售完", match: (p) => isSoldOut(p.stock) },
];

export default async function ProductsListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { q: rawQuery, filter: rawFilter, error: rawError } = await searchParams;
  const q = (rawQuery ?? "").trim();
  // 列表上的快速動作（上下架、調順序、改庫存）出錯時會把訊息帶在網址上跳回來。
  // 以前沒人讀這個值，商家按了沒反應也不知道為什麼，只能一直重按。
  const errorMsg = (rawError ?? "").trim().slice(0, 200);
  const filter = STATUS_FILTERS.some((f) => f.key === rawFilter)
    ? rawFilter!
    : "all";
  const { supabase, user } = await requireUser();

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  // 整批撈回來在這裡篩，chips 的 count 也順便從同一份資料算，不用多打一次 DB。
  // 撈法走共用 fetchAllRows 分頁撈齊（Supabase 一次最多回約 1000 列，商品破千後
  // 超出的會默默從列表消失、chips 數字也算少）；排序尾端補 id tiebreaker
  // 釘住同值列的順序，翻頁切點才不會浮動漏列或重複。
  const allProducts = await fetchAllRows<ProductRow>(async (from, to) =>
    supabase
      .from("sproutly_products")
      .select("*")
      .eq("merchant_id", store.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
  const filterCounts: Record<string, number> = {};
  for (const f of STATUS_FILTERS) {
    filterCounts[f.key] = allProducts.filter(f.match).length;
  }

  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filter) ?? STATUS_FILTERS[0];
  const visible = allProducts.filter(
    (p) => activeFilter.match(p) && (!q || matchesProductSearch(p, q))
  );

  // 快速上下架按完要跳回「同一個篩選、同一個搜尋」的列表，不然商家在「停售中」
  // 分頁按了上架，會被丟回全部列表、剛剛看到一半的清單整個不見。
  const listQsParams = new URLSearchParams();
  if (filter !== "all") listQsParams.set("filter", filter);
  if (q) listQsParams.set("q", q);
  const listQs = listQsParams.toString();

  function chipHref(key: string) {
    const sp = new URLSearchParams();
    if (key !== "all") sp.set("filter", key);
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return `/dashboard/stores/${slug}/products${qs ? `?${qs}` : ""}`;
  }

  const filterActive = q !== "" || filter !== "all";
  const count = allProducts.length;
  const caption = filterActive
    ? `符合條件 ${visible.length} 件 · 全部 ${count} 件`
    : count > 1
      ? `${count} 件商品 · 點任一件編輯 · 右側箭頭調客人看到的先後`
      : count > 0
        ? `${count} 件商品 · 點任一件編輯`
        : "新增第一件商品讓店面活起來";

  // 上下箭頭只在「沒篩選、沒搜尋」的完整列表出現。篩過的列表上，畫面相鄰的兩件
  // 在整家店的順序裡通常隔著好幾件，按「往上」會移到看不見的地方去，商家會以為
  // 沒反應。與其做一套「跳過被篩掉的」規則，不如請商家先把條件清掉再調。
  const canReorder = !filterActive && visible.length > 1;

  return (
    <div>
      <div className="flex items-end justify-between mb-10 gap-3 flex-wrap">
        <div>
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            Products · 商品
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.15 }}
          >
            管理你的商品
          </h2>
          <span
            aria-hidden
            className="mt-4 block h-px w-12 bg-emerald-600/60"
          />
          <p
            className="mt-4 text-emerald-900/65"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {caption}
          </p>
        </div>
        {count > 0 && (
          <Link
            href={`/dashboard/stores/${slug}/products/new`}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-white text-sm font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
          >
            ＋ 新增商品
          </Link>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 mb-4 text-sm text-red-800"
          style={{ lineHeight: 1.7 }}
        >
          {errorMsg}
        </div>
      )}

      {/* 狀態 chips + 搜尋 bar：跟訂單列表同一套操作語言，商品多了照樣一秒找到 */}
      {count > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-lg shadow-emerald-700/5 mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="sr-only">依商品狀態篩選：</span>
            {STATUS_FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Link
                  key={f.key}
                  href={chipHref(f.key)}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                    active
                      ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/20"
                      : "bg-emerald-50 text-emerald-900/80 hover:bg-emerald-100"
                  }`}
                >
                  {f.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      active ? "bg-white/20" : "bg-white"
                    }`}
                  >
                    {filterCounts[f.key]}
                    <span className="sr-only"> 件</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <form
            action={`/dashboard/stores/${slug}/products`}
            method="GET"
            className="flex gap-2"
          >
            {filter !== "all" && (
              <input type="hidden" name="filter" value={filter} />
            )}
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="搜尋商品名稱 / 描述..."
              className="flex-1 rounded-full border border-emerald-100 px-4 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition text-sm"
            />
            <button
              type="submit"
              className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 transition"
            >
              搜尋
            </button>
            {filterActive && (
              <Link
                href={`/dashboard/stores/${slug}/products`}
                className="rounded-full border border-emerald-100 px-4 py-2 text-sm text-emerald-900/70 hover:bg-emerald-50 transition"
              >
                清除
              </Link>
            )}
          </form>

          {filterActive && visible.length > 1 && (
            <p className="text-xs text-emerald-900/50" style={{ lineHeight: 1.7 }}>
              調整商品先後順序的箭頭要在完整列表才會出現，先按「清除」再調。
            </p>
          )}
        </div>
      )}

      {visible.length > 0 ? (
        <div className="space-y-3">
          {/* row 從整張 <Link> 改成 div + 蓋滿的 overlay link：快速上下架的表單
              按鈕不能包在 <a> 裡（HTML 不允許、點按鈕也會觸發跳頁），改成連結
              absolute 蓋滿整列、按鈕自己 z-10 疊在上面，點卡片任一處照樣進編輯頁 */}
          {visible.map((p, i) => (
            <div
              key={p.id}
              className="relative bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5 hover:shadow-xl hover:shadow-emerald-700/10 hover:-translate-y-0.5 transition flex items-center gap-4"
            >
              <Link
                href={`/dashboard/stores/${slug}/products/${p.id}/edit`}
                className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <span className="sr-only">編輯 {p.name}</span>
              </Link>
              <div className="w-16 h-16 rounded-xl bg-emerald-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {p.image_urls && p.image_urls.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="uppercase text-emerald-900/40"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.3em" }}
                  >
                    No Image
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-emerald-950 truncate">
                    {p.name}
                  </h3>
                  {!p.is_active && (
                    <>
                      <span
                        aria-hidden
                        className="uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600"
                        style={{
                          fontSize: "0.625rem",
                          letterSpacing: "0.3em",
                        }}
                      >
                        Inactive · 停售
                      </span>
                      <span className="sr-only">，狀態：停售中</span>
                    </>
                  )}
                </div>
                {p.description && (
                  <p className="text-sm text-emerald-900/60 truncate mt-0.5">
                    {p.description}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p
                  className="text-emerald-950 font-medium tabular-nums"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {formatPrice(p.price_cents, p.currency)}
                </p>
                {/* 售完／快沒貨改用色塊標出來，商家掃列表時一眼看到該補哪幾件——
                    門檻走 isLowStock 與用字跟後台首頁、客人端一致，不會各說各話 */}
                {isSoldOut(p.stock) ? (
                  <span
                    className="mt-1.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-red-700 font-medium"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.15em" }}
                  >
                    已售完
                  </span>
                ) : isLowStock(p.stock) ? (
                  <span
                    className="mt-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 font-medium"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.15em" }}
                  >
                    剩 {p.stock} 件
                  </span>
                ) : p.stock !== null ? (
                  <p
                    className="mt-1 uppercase text-emerald-900/50"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.3em" }}
                  >
                    <span aria-hidden>Stock {p.stock}</span>
                    <span className="sr-only">庫存 {p.stock} 件</span>
                  </p>
                ) : null}
                {/* 快速上下架：以前要點進編輯頁、捲到勾選框、存檔才能停售一件，
                    臨時缺貨或補到貨時繞太遠。停售走低調外框、上架走實心綠，
                    跟這件商品「接下來會發生什麼」的重量一致 */}
                {/* 快速改庫存：補到貨、線下賣掉幾件，以前一樣得點進編輯頁改數字再退回來。
                    只有本來就有在管庫存的商品才畫這一格（沒在管的留空欄位沒有意義，
                    要開始管請進編輯頁填）。存完跳回同一個篩選＋搜尋，所以在「快沒貨」
                    分頁把某件補滿，那件會從眼前的列表消失——跟上下架同一個行為。 */}
                <div className="relative z-10 mt-2 flex flex-wrap items-center justify-end gap-1.5">
                  {p.stock !== null && (
                    <form
                      action={setProductStock.bind(null, slug, p.id, listQs)}
                      className="flex items-center gap-1"
                    >
                      <label className="sr-only" htmlFor={`stock-${p.id}`}>
                        {p.name} 的庫存件數
                      </label>
                      <input
                        id={`stock-${p.id}`}
                        name="stock"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={p.stock}
                        className="w-14 rounded-full border border-emerald-100 px-2 py-1 text-xs text-right tabular-nums outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
                      />
                      <SubmitButton
                        pendingText="…"
                        className="rounded-full border border-emerald-100 px-2.5 py-1 text-xs text-emerald-900/70 hover:bg-emerald-50"
                      >
                        存
                        <span className="sr-only">{p.name} 的庫存</span>
                      </SubmitButton>
                    </form>
                  )}
                  <form action={toggleProductActive.bind(null, slug, p.id, listQs)}>
                    <SubmitButton
                      pendingText="切換中..."
                      className={
                        p.is_active
                          ? "rounded-full border border-emerald-100 px-3 py-1 text-xs text-emerald-900/70 hover:bg-emerald-50"
                          : "rounded-full bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                      }
                    >
                      {p.is_active ? "停售" : "上架"}
                      <span className="sr-only">：{p.name}</span>
                    </SubmitButton>
                  </form>
                </div>
              </div>
              {/* 調順序：以前商品在店裡的先後只能照建立時間，想把當季的那株推到
                  第一排完全沒辦法。這裡兩顆箭頭直接換位置，客人逛街頁的預設順序
                  跟這裡看到的是同一份，按完就是客人會看到的樣子。最上面那件沒有
                  「往上」、最下面那件沒有「往下」，位置留著讓每列的寬度一樣 */}
              {canReorder && (
                <div className="relative z-10 flex-shrink-0 flex flex-col gap-1">
                  {(
                    [
                      { dir: "up", glyph: "↑", word: "上", off: i === 0 },
                      {
                        dir: "down",
                        glyph: "↓",
                        word: "下",
                        off: i === visible.length - 1,
                      },
                    ] as const
                  ).map((b) =>
                    b.off ? (
                      <span
                        key={b.dir}
                        aria-hidden
                        className="block w-7 h-7 rounded-lg border border-emerald-50 text-emerald-900/20 text-xs leading-[1.6rem] text-center"
                      >
                        {b.glyph}
                      </span>
                    ) : (
                      <form
                        key={b.dir}
                        action={moveProductOrder.bind(
                          null,
                          slug,
                          p.id,
                          b.dir,
                          listQs
                        )}
                      >
                        <SubmitButton
                          pendingText="…"
                          className="block w-7 h-7 rounded-lg border border-emerald-100 text-emerald-900/70 text-xs hover:bg-emerald-50"
                        >
                          <span aria-hidden>{b.glyph}</span>
                          <span className="sr-only">
                            把 {p.name} 往{b.word}移一格
                          </span>
                        </SubmitButton>
                      </form>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 sm:p-16 text-center shadow-xl shadow-emerald-700/5">
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            {filterActive ? "No Match · 沒有符合" : "Empty · 還沒開張"}
          </p>
          <span
            aria-hidden
            className="mt-4 block h-px w-10 bg-emerald-600/60 mx-auto"
          />
          <h3
            className="mt-6 text-2xl sm:text-3xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.2 }}
          >
            {filterActive ? (
              <>
                沒有符合
                <br />
                條件的商品
              </>
            ) : (
              <>
                還沒有
                <br />
                上架的商品
              </>
            )}
          </h3>
          <p
            className="mt-5 text-emerald-900/65 max-w-md mx-auto"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {filterActive
              ? "換個篩選條件或清除搜尋試試"
              : "新增第一件，客人就能開始逛你的店"}
          </p>
          {!filterActive && (
            <Link
              href={`/dashboard/stores/${slug}/products/new`}
              className="mt-10 inline-block rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
            >
              ＋ 新增第一件商品
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
