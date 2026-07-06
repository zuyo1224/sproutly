import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { jsonLdHtml } from "@/lib/json-ld";
import { siteBaseUrl, buildBreadcrumbJsonLd } from "@/lib/store-schema";
import { absoluteImageUrls } from "@/lib/image-url";
import { resolveTheme, HOMEPAGE_DEFAULTS } from "../_theme";
import { RecentlyViewed } from "@/app/_components/recently-viewed";
import { AutoSubmitOnChange } from "@/app/_components/auto-submit-on-change";
import { isSoldOut, isLowStock, bySoldOutLast, stockAriaSuffix } from "@/lib/product-stock";
import { matchesProductSearch } from "@/lib/product-search";
// 商品撈整批要分頁撈齊，不然吃 Supabase 1000 列上限，見 fetch-all-rows。
import { fetchAllRows } from "@/lib/fetch-all-rows";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; sort?: string; stock?: string }>;

// canonical 指回不帶查詢字串的商品頁網址——搜尋／排序／篩庫存會生出 ?q= ?sort= ?stock=
// 一堆變體網址，全部當成同一頁，排名才不會被切散。
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = "全部商品";
  const description = "瀏覽完整商品與庫存，看上眼直接線上下單。";

  // 店家常把這頁連結貼到 IG 限動 / LINE 群裡接客，分享卡片要顯示「全部商品 · 店名」
  // 加上店面主視覺，而不是退回 layout 那層千篇一律的店名。沒撈到店面就只留純文字 meta。
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("name, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  const base: Metadata = {
    title,
    description,
    alternates: { canonical: `/${slug}/shop` },
  };
  if (!store) return base;

  const theme = resolveTheme(store.theme);
  const ogTitle = `${title} · ${store.name}`;
  const ogImage = theme.heroUrl || theme.logoUrl || null;
  return {
    ...base,
    openGraph: {
      title: ogTitle,
      description,
      siteName: store.name,
      type: "website",
      locale: "zh_TW",
      images: ogImage ? [{ url: ogImage, alt: store.name }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "最新上架" },
  { value: "price-asc", label: "價格 低 → 高" },
  { value: "price-desc", label: "價格 高 → 低" },
  { value: "name", label: "名稱 A-Z" },
];

import { formatPrice, productOfferFieldsForSchema } from "@/lib/format-price";
import { availabilityForSchema } from "@/lib/availability-schema";

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { q: rawQ, sort: rawSort, stock: rawStock } = await searchParams;
  const q = (rawQ ?? "").trim();
  const sort = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? rawSort!
    : "newest";
  const inStock = rawStock === "1";

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  // 關鍵字比對搬到 JS 做（見下方 fetched 之後）：原本只 ilike 商品名稱，
  // 客人搜「耐陰」「適合新手」這種寫在描述裡、名稱沒有的字會一場空，
  // 但商家後台商品列表早就連描述一起搜。逛街頁本來就把整批商品撈回來再排序，
  // 多比一個欄位零額外查詢，也順手免掉 ilike 的 %/_ 跳脫。
  //
  // 撈法走共用 fetchAllRows 分頁撈齊（Supabase 一次最多回約 1000 列，
  // 商品破千後超出的會默默從逛街頁消失）；每種排序最後都補 id tiebreaker
  // 釘住同值列的順序，翻頁切點才不會浮動漏列或重複。
  const fetched = await fetchAllRows(async (from, to) => {
    let query = supabase
      .from("sproutly_products")
      .select("*")
      .eq("merchant_id", store.id)
      .eq("is_active", true);

    if (inStock) {
      query = query.or("stock.is.null,stock.gt.0");
    }

    switch (sort) {
      case "price-asc":
        query = query.order("price_cents", { ascending: true });
        break;
      case "price-desc":
        query = query.order("price_cents", { ascending: false });
        break;
      case "name":
        query = query.order("name", { ascending: true });
        break;
      default:
        query = query
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
    }

    return query.order("id", { ascending: true }).range(from, to);
  });
  // 名稱或描述任一含關鍵字就算命中（跟後台商品列表、Cmd+K 搜尋同一套口徑）。
  const products = q
    ? fetched.filter((p) => matchesProductSearch(p, q))
    : fetched;
  // 售完的商品一律沉到列表最底。選定的排序（最新／價格／名稱）原本把已售完
  // 跟有貨的混在一起，逛街頁第一排常卡著幾株沒貨的，客人得略過才看到買得到的——
  // 跟最近替每個商品卡片補上售完標示同一個出發點：別讓人花眼力在買不到的東西上。
  // 在原排序之上再把 stock===0 的整批推到最後（JS sort 穩定，各自維持原順序），
  // 跟「只看有貨」勾選互補：不勾也是先看到買得到的，售完的仍排在下方可瀏覽。
  products.sort(bySoldOutLast);
  const totalCount = products.length;
  const hasFilter = q || sort !== "newest" || inStock;

  const shopEyebrow = theme.homepage.shopEyebrow ?? HOMEPAGE_DEFAULTS.shopEyebrow;
  const shopTitle = theme.homepage.shopTitle ?? HOMEPAGE_DEFAULTS.shopTitle;

  const BASE_URL = siteBaseUrl();

  // 麵包屑結構化資料 — 跟首頁的 Store、商品詳情頁的 Product/BreadcrumbList 一套，
  // 讓 Google 搜尋結果用「店名 › 所有商品」標出這頁在店裡的位置。
  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    baseUrl: BASE_URL,
    slug,
    storeName: store.name,
    trail: [{ name: "所有商品", path: "shop" }],
  });

  // 商品列表結構化資料 — 首頁有 Store、商品詳情頁有 Product，唯獨這頁
  // （客人逛街的主入口）沒有，Google 看不出這是一份商品清單。補上 ItemList
  // 讓搜尋結果有機會直接列出商品縮圖＋價格。只在沒套用搜尋／篩選的正規網址
  // （canonical 指向的乾淨頁）才放，避免結構化資料跟正規頁實際內容對不上；
  // 數量設上限避免清單過長拖慢頁面。
  // numberOfItems 必須等於 itemListElement 真正列出的筆數——超過上限時拿全部
  // 商品數去填，會讓 Google 判定宣稱的數量跟實際清單對不上，所以先把要列的
  // 清單切好，數量直接吃這份的長度。
  const listedProducts = !hasFilter ? products.slice(0, 30) : [];
  const itemListJsonLd =
    listedProducts.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: shopTitle,
          numberOfItems: listedProducts.length,
          itemListElement: listedProducts.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Product",
              name: p.name,
              url: `${BASE_URL}/${slug}/products/${p.id}`,
              // 跟商品詳情頁、首頁同一條防呆線：image_urls 第一張可能是空白或相對路徑，
              // 直接放會讓這筆 Product 在 ItemList 裡失效。走 absoluteImageUrls 清過，
              // 清不出乾淨絕對網址就省略此欄（頁面卡片渲染照舊吃原始 image_urls）。
              image: absoluteImageUrls(p.image_urls)[0] ?? undefined,
              offers: {
                "@type": "Offer",
                // 幣別／價格／價格有效期／全新狀態走共用 helper，跟商品詳情頁同一份
                // （以前這裡漏了 priceValidUntil 與 itemCondition，Search Console 會報缺欄）。
                ...productOfferFieldsForSchema(p.price_cents, p.currency),
                // 跟商品詳情頁同一套：賣完 OutOfStock、剩 3 件以下 LimitedAvailability
                // （對應卡片上的「剩 N」琥珀提示）、其餘 InStock，整站庫存標示一致。
                availability: availabilityForSchema(p.stock),
              },
            },
          })),
        }
      : null;

  return (
    <main className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(itemListJsonLd) }}
        />
      )}
      <header className="mb-16 sm:mb-20">
        <p
          data-edit-text="true"
          data-edit-field="shopEyebrow"
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: theme.accent, letterSpacing: "0.4em" }}
        >
          {shopEyebrow}
        </p>
        <h1
          data-edit-text="true"
          data-edit-field="shopTitle"
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {shopTitle}
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{ color: theme.textMuted, lineHeight: 1.7 }}
        >
          {q
            ? `搜尋「${q}」· 找到 ${totalCount} 件${inStock ? "有貨" : ""}商品`
            : totalCount === 0
              ? inStock
                ? "目前沒有有貨的商品"
                : "還沒有商品上架"
              : inStock
                ? `${totalCount} 件有貨商品 · 立刻可以下單`
                : `${totalCount} 件商品在等你慢慢挑`}
        </p>
      </header>

      <form
        method="GET"
        className="mb-12 flex flex-col sm:flex-row gap-3"
      >
        {/* 排序下拉、「只看有貨」一變動就自動送出，免得客人改完還要去點「套用」。
            沒 JavaScript 時不生效，「套用」按鈕照常運作。 */}
        <AutoSubmitOnChange />
        <div className="flex-1 relative">
          <input
            name="q"
            type="search"
            defaultValue={q}
            // 這頁的搜尋早就連商品描述一起比對（commit 51d845b），客人可以搜
            // 「耐陰」「適合新手」這種寫在描述、名稱沒有的字。但 placeholder 還寫
            // 「商品名稱」等於把這能力藏起來——看到「名稱」的人不會想到去打特性。
            // 跟頂部 Cmd+K 面板的「商品名或關鍵字」對齊口徑，讓人知道可以搜特性。
            placeholder="搜尋商品名稱、特性⋯"
            className="sproutly-input pl-12"
            aria-label="搜尋商品名稱或特性"
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: theme.textMuted }}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <label
          className="flex items-center gap-2.5 px-4 sm:px-5 rounded-full cursor-pointer select-none"
          style={{
            border: `1px solid ${theme.border}`,
            background: "var(--store-surface, transparent)",
            color: theme.text,
            minHeight: "2.75rem",
          }}
        >
          <input
            type="checkbox"
            name="stock"
            value="1"
            defaultChecked={inStock}
            data-autosubmit
            className="w-4 h-4 cursor-pointer"
            style={{ accentColor: theme.accent }}
            aria-label="只看有庫存"
          />
          <span
            className="text-[0.6875rem] uppercase font-medium whitespace-nowrap"
            style={{ letterSpacing: "0.3em" }}
          >
            In Stock · 只看有貨
          </span>
        </label>
        <select
          name="sort"
          defaultValue={sort}
          data-autosubmit
          aria-label="排序方式"
          className="sproutly-input appearance-none cursor-pointer pr-10 sm:w-48"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.75rem center",
            backgroundSize: "1rem",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="sproutly-btn sproutly-btn-primary"
        >
          套用
        </button>
        {hasFilter && (
          <Link
            href={`/${slug}/shop`}
            className="sproutly-btn sproutly-btn-secondary text-center"
          >
            清除
          </Link>
        )}
      </form>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 sm:gap-x-10 gap-y-16">
          {products.map((p) => {
            const soldOut = isSoldOut(p.stock);
            return (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="sproutly-card"
              aria-label={`${p.name}，${formatPrice(p.price_cents, p.currency)}${stockAriaSuffix(p.stock)}`}
            >
              <div className="sproutly-card-image aspect-square relative">
                {/* 售完的圖片去彩、壓暗，再蓋一枚角落標記。逛列表時一眼就看得出
                    哪幾株沒了，不必先讀卡片下方的小字才知道。 */}
                {soldOut && (
                  <span
                    className="absolute left-3 top-3 z-10 px-2.5 py-1 rounded-full text-[0.625rem] uppercase font-medium backdrop-blur-sm"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      letterSpacing: "0.2em",
                    }}
                  >
                    售完
                  </span>
                )}
                {p.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className={`w-full h-full object-cover transition ${
                      soldOut ? "opacity-55 grayscale" : ""
                    }`}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background:
                        "var(--store-surface, rgba(0,0,0,0.04))",
                    }}
                  >
                    <span
                      className="text-[0.6875rem] uppercase"
                      style={{
                        color: theme.textMuted,
                        opacity: 0.5,
                        letterSpacing: "0.4em",
                      }}
                    >
                      No Image
                    </span>
                  </div>
                )}
              </div>
              <h3
                className="sproutly-card-title mt-5 text-base line-clamp-1"
                style={{ fontFamily: "var(--store-font)", fontWeight: 400 }}
              >
                {p.name}
              </h3>
              <p
                className="sproutly-card-meta mt-1 text-sm tabular-nums"
                style={{ color: theme.accent }}
              >
                {formatPrice(p.price_cents, p.currency)}
              </p>
              {/* 售完已由圖片上的角落標記表達，這裡只留「剩 N」的琥珀色提示，
                  跟商品詳情頁同一套語言，讓客人逛列表就分得出哪幾株快沒了。 */}
              {isLowStock(p.stock) ? (
                <p
                  className="mt-1 text-[0.6875rem] uppercase font-medium"
                  style={{
                    color: "#92400E",
                    letterSpacing: "0.3em",
                  }}
                >
                  Low Stock · 剩 {p.stock}
                </p>
              ) : null}
            </Link>
            );
          })}
        </div>
      ) : (
        <>
        <div className="py-16 max-w-md">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{ color: theme.accent, letterSpacing: "0.4em" }}
          >
            {hasFilter ? "Not Found" : "Empty"}
          </p>
          <div
            className="mt-5 h-px w-10"
            style={{ background: theme.accent, opacity: 0.4 }}
          />
          <p
            className="mt-6 text-2xl sm:text-3xl font-medium"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            {q ? (
              <>
                沒有商品
                <br />
                符合「{q}」
              </>
            ) : inStock ? (
              <>
                目前所有商品
                <br />
                都暫時缺貨
              </>
            ) : (
              <>
                這間店
                <br />
                還在準備
              </>
            )}
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            {q
              ? inStock
                ? "也許有符合的商品暫時缺貨。保留搜尋、取消「只看有貨」再看一次，或換個關鍵字。"
                : "試試植物特性，像「耐陰」「適合新手」，或先看看全部商品。"
              : inStock
                ? "取消「只看有貨」可以瀏覽預購商品。"
                : "店主還沒上架商品，過幾天再回來看看吧。"}
          </p>
          {hasFilter && (
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
              {/* 搜尋有字又勾了「只看有貨」卻一場空時，符合的商品可能只是暫時缺貨。
                  先給一條「保留這次搜尋、把缺貨的也納進來」的捷徑（同 q、拿掉 stock），
                  別讓客人為了看缺貨結果連搜尋字一起清掉、再從頭打一次。 */}
              {q && inStock && (
                <Link
                  href={`/${slug}/shop?q=${encodeURIComponent(q)}`}
                  className="sproutly-link inline-block text-[0.75rem] uppercase font-medium"
                  style={{ letterSpacing: "0.3em" }}
                  data-default-line="true"
                >
                  保留搜尋、含缺貨一起看 →
                </Link>
              )}
              <Link
                href={`/${slug}/shop`}
                className="sproutly-link inline-block text-[0.75rem] uppercase font-medium"
                style={{ letterSpacing: "0.3em" }}
                data-default-line="true"
              >
                看全部商品 →
              </Link>
            </div>
          )}
        </div>
        {/* 搜尋／篩選一場空時別讓客人卡在死路——把他在這台裝置剛看過的幾株接回來，
            跟購物車空狀態同一套處理。純 client localStorage、沒看過紀錄就整段不出現
            （剛開店沒商品的店面客人本來也沒逛過，自然不會冒出來）。放在 max-w-md 文字塊
            外面，讓 4 欄商品網格用整個容器寬度。 */}
        <RecentlyViewed slug={slug} className="mt-8" />
        </>
      )}
    </main>
  );
}
