import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { jsonLdHtml } from "@/lib/json-ld";
import { resolveTheme, HOMEPAGE_DEFAULTS, HOMEPAGE_DEFAULT_COLLECTIONS, JOURNAL_CARD_DEFAULTS } from "./_theme";
import { buildStoreJsonLd, buildFaqJsonLd, siteBaseUrl, storeSchemaId } from "@/lib/store-schema";
import { telHref, mailHref, telDigits, cleanEmail, mapsHref } from "@/lib/contact-href";
import { isSoldOut, isLowStock, bySoldOutLast, stockAriaSuffix } from "@/lib/product-stock";
import { FREE_POS_KEYS } from "@/lib/free-positions";
import { contrastRatio, NON_TEXT_CONTRAST_MIN } from "@/lib/color-contrast";
import HeroAdaptiveBanner from "./HeroAdaptiveBanner";

type Params = Promise<{ slug: string }>;

// 首頁標準網址：店面同時掛在短網址（sproutly-drab）與 Vercel 部署長網址底下，
// 不指定正規網址的話 Google 會當成兩個重複頁面，搜尋排名被一頁分成兩半。
// 標題/描述/分享圖沿用 layout 的 generateMetadata，這裡只補 canonical。
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  return { alternates: { canonical: `/${slug}` } };
}

import { formatPrice } from "@/lib/format-price";

export default async function StoreHomePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  const { data: featuredProducts } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, image_urls, stock")
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(theme.layout.featuredCount);

  // 售完的沉到精選列表最後，跟 shop 逛街頁、商品詳情「店裡其他」、收藏頁同一套——
  // 本月選物原本只照 created_at 排，沒貨的株可能正好卡在第一排，客人滑到精選先看到
  // 買不到的。在已排好的清單上再把售完那批整批往下挪（JS sort 穩定，有貨的維持原順序）。
  featuredProducts?.sort(bySoldOutLast);

  const businessHoursText =
    typeof store.business_hours === "object" && store.business_hours !== null
      ? ((store.business_hours as { text?: string }).text ?? "")
      : "";

  // ===== 首頁文案：商家自訂優先，沒設用 default =====
  const heroTagline =
    theme.tagline || "為你的角落，找一株剛剛好的植物。";
  const collectionsIntro =
    theme.homepage.collectionsIntro || HOMEPAGE_DEFAULTS.collectionsIntro;
  const collectionsEyebrow =
    theme.homepage.collectionsEyebrow ?? HOMEPAGE_DEFAULTS.collectionsEyebrow;
  const promiseText = theme.homepage.promise || HOMEPAGE_DEFAULTS.promise;
  const promiseEyebrow =
    theme.homepage.promiseEyebrow || HOMEPAGE_DEFAULTS.promiseEyebrow;
  const featuredTitle =
    theme.homepage.featuredTitle || HOMEPAGE_DEFAULTS.featuredTitle;
  const featuredEyebrow =
    theme.homepage.featuredEyebrow ?? HOMEPAGE_DEFAULTS.featuredEyebrow;
  const featuredCta =
    theme.homepage.featuredCta || HOMEPAGE_DEFAULTS.featuredCta;
  const visitTitle =
    theme.homepage.visitTitle || HOMEPAGE_DEFAULTS.visitTitle;
  const visitEyebrow =
    theme.homepage.visitEyebrow ?? HOMEPAGE_DEFAULTS.visitEyebrow;
  const collectionsConfig =
    theme.homepage.collectionItems.length > 0
      ? theme.homepage.collectionItems
      : HOMEPAGE_DEFAULT_COLLECTIONS;

  // 篩出有情境照的提案。index 在濾掉沒圖的卡「之前」先記下來，
  // 雙擊改卡片標題時編輯器才對得回原始 collectionItems 的第幾筆
  const visibleCollections = collectionsConfig
    .map((c, i) => ({ ...c, image: theme.collections[c.key], index: i }))
    .filter((c) => c.image);

  // 中文按全形標點自然分行
  const splitByPunc = (s: string) =>
    s
      .split(/(?<=[，、。！？])/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const taglineLines = splitByPunc(heroTagline);
  const introLines = splitByPunc(collectionsIntro);
  const promiseLines = promiseText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const animClass = theme.homepage.enableAnimation ? "sproutly-subtle-fade" : "";

  // 區段裡用全站主色畫的東西（小標 eyebrow、標題底下那截短線、常見問題的＋、數字底下
  // 的短線）一律走這個值，不再直接寫 theme.accent。--store-accent 只有在該段的自訂底色
  // 把主色吃掉時才由 mergeSectionStyle 設（見那裡），沒設就退回全站主色、畫面完全不變。
  // 有自己底色的容器（提案卡、好評卡）不在此列，它們的底色不跟區段換，主色照舊。
  const accentColor = `var(--store-accent, ${theme.accent})`;

  // 段落最上面那行小標的顏色。原本每一行各自寫死（十四段直接用主色、合作那兩行用次要文字
  // 色），改成統一讀 --store-eyebrow-color、fallback 回它原本那個值——沒設變數時算出來
  // 一模一樣，設了才換色（見 section-style-schema 的 eyebrowTone）。顏色是 inline style，
  // 規則蓋不過去，只能繞變數，跟標題用色同一招。
  const eyebrowColor = `var(--store-eyebrow-color, ${accentColor})`;
  const eyebrowMutedColor = "var(--store-eyebrow-color, var(--store-text-muted))";

  // 卡片上那幾行全大寫小字的顏色（選物的「看更多」、慢讀的分類與標籤、精選的「剩 N」）。
  // 原本四行各自寫死三種值：兩行主色、一行次要文字色、一行琥珀色的庫存警示。改成統一讀
  // --card-micro-color、fallback 回它原本那個值——沒設變數時算出來一模一樣，設了才換色
  //（見 section-style-schema 的 cardMicroTone）。跟小標、品名、價錢那三格同一招：顏色寫在
  // inline style 上，CSS 規則蓋不過去，只能繞變數。
  const cardMicroColor = `var(--card-micro-color, ${accentColor})`;
  const cardMicroMutedColor = "var(--card-micro-color, var(--store-text-muted))";
  const cardMicroStockColor = "var(--card-micro-color, #92400E)";

  // 各 section 樣式 helper：背景色 + 標題對齊 + 上下空白覆寫（北極星：超越 Wix 元素級控制覆蓋率）
  // padOverride 用 CSS variable 覆寫該 section 的 --store-section-pad，
  // 沒設定 = 跟著全網站 sectionPaddingScale（透過 layout.tsx 的 attribute selector 套用）
  const padScaleToVar = (s: "compact" | "default" | "spacious" | undefined) =>
    s === "compact" ? 0.6 : s === "spacious" ? 1.4 : s === "default" ? 1 : undefined;
  // 標題字級：只回 "small" / "large" 給 wrapper 設 data-heading-scale，倍率在 layout.tsx 算。
  // 本來是回一個倍率、走 inline --store-heading-scale，配一條「所有 section h2 一律
  // font-size: calc(1em * var(--store-heading-scale, 1))」的 CSS。那條規則沒設也一直在，
  // 而它寫在 layout.tsx 的 <style>（不在 @layer 裡）、Tailwind v4 的工具類全在 @layer utilities
  // ——沒分層的贏有分層的，所以它把每一段 h2 的 text-3xl / text-4xl 全部蓋掉，標題一律縮成
  // 上層繼承的內文大小（實測 30px 的標題渲染出來 16px），而且倍率乘的是內文而不是標題本身。
  // 改成跟標題粗細、標題底線同一招 data attribute：沒設就整條規則不存在，Tailwind 的字級原封
  // 不動；有設才套 layout.tsx 那份基準字級 × 倍率。
  // 最小高度：auto 不設定 / tall 80vh / fullscreen 100vh
  const minHeightToVal = (s: "auto" | "tall" | "fullscreen" | undefined) =>
    s === "tall" ? "80vh" : s === "fullscreen" ? "100vh" : undefined;
  // 外框：用 outline 不用 border 避免跟 divider borderTop/Bottom 衝突；outline-offset 設 negative 內凹
  // 只回粗細，顏色交給 mergeSectionStyle 算（見下面 lineColorFor：自訂文字色的段落線要跟著換）
  const outlineToVal = (s: "none" | "subtle" | "strong" | undefined) => {
    if (s === "subtle") return { width: "1px", offset: "-1px" };
    if (s === "strong") return { width: "2px", offset: "-2px" };
    return undefined;
  };
  // 陰影：soft 淺浮起 / deep 深浮起，雙層 box-shadow 模擬 elev 系統
  const shadowToVal = (s: "none" | "soft" | "deep" | undefined) => {
    if (s === "soft") return "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)";
    if (s === "deep") return "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.1)";
    return undefined;
  };
  // 圓角：soft 16px / strong 32px，搭配 bgColor + outline + shadow 三件套讓 section 像卡片
  const radiusToVal = (s: "none" | "soft" | "strong" | undefined) => {
    if (s === "soft") return "16px";
    if (s === "strong") return "32px";
    return undefined;
  };
  // 字體：serif 思源宋體（雜誌風）/ sans 思源黑體（現代），對齊 _theme.ts FONT_LABELS 的 noto-serif / noto
  const fontFamilyToVal = (s: "default" | "serif" | "sans" | undefined) => {
    if (s === "serif") return "var(--font-noto-serif), 'Times New Roman', serif";
    if (s === "sans") return "var(--font-noto), system-ui, sans-serif";
    return undefined;
  };
  // 字距：tight 緊（-0.02em，現代感）/ wide 寬（0.12em，雜誌大標）/ normal 預設不套
  const letterSpacingToVal = (s: "tight" | "normal" | "wide" | undefined) => {
    if (s === "tight") return "-0.02em";
    if (s === "wide") return "0.12em";
    return undefined;
  };
  // 行高：tight 緊湊（1.4，標題密集感）/ relaxed 舒展（2.0，長段落呼吸感）/ normal 預設不套
  // line-height 是 CSS inherited 屬性，套到 section 後沒有自己行高的文字會自動繼承；
  // 大標自己 inline 設的 lineHeight 1.2 不受影響（直接 override 繼承值）。
  // 但真正的內文（描述、卡片說明、常見問題答案）幾乎每一段都掛著 Tailwind 的
  // leading-[1.9] 之類 class，元素自己的 class 一樣蓋掉繼承值 —— 那些才是商家調行高
  // 想調的字，所以另外走 data-line-height attribute 由 layout.tsx 補一條規則（見那裡）。
  const lineHeightToVal = (s: "tight" | "normal" | "relaxed" | undefined) => {
    if (s === "tight") return 1.4;
    if (s === "relaxed") return 2.0;
    return undefined;
  };
  // 內文一行字數：normal 約 34 字 / narrow 約 24 字 / auto 不限制（不套）
  // 用 em 而不是 ch：ch 是「0」的寬度，中文字大約是它的兩倍，34ch 排出來只有 17 個中文字，
  // 跟商家在按鈕上看到的字數對不上。em 等於元素自己的字級 = 一個中文字的寬度，所以段落
  // 小一級的字也會按自己的大小收窄，而不是全部收成同一個絕對寬度。
  // 實際畫寬度的是 layout.tsx 那條針對段落的規則（見那裡），這裡只餵值。
  const measureToVal = (s: "auto" | "normal" | "narrow" | undefined) => {
    if (s === "normal") return "34em";
    if (s === "narrow") return "24em";
    return undefined;
  };
  // 淡化：muted 0.85 / faint 0.7 / default 不套
  // 純 inline opacity，整段 section 都變淡（含 children）
  // 適合 partners / stats / faq 這種次要 section 變灰階感，襯托 hero / featured 跳出
  const opacityToVal = (s: "default" | "muted" | "faint" | undefined) => {
    if (s === "muted") return 0.85;
    if (s === "faint") return 0.7;
    return undefined;
  };
  // 濾鏡：grayscale 黑白（partners / gallery 雜誌感）/ sepia 復古褐（journal 懷舊感）/ none 不套
  // 只套這一段裡的照片，不套整段 section。本來是直接把 filter 設在 section 上，所有 children
  // 一起被洗——那會把商家在同一個面板裡剛挑好的顏色全部作廢：這一段的自訂底色、文字色、
  // 還有用主色畫的小標與短線，選了黑白就全變灰、選了復古就一起染成褐調（連底色的色相都
  // 位移）。而 filter 是把整個子樹先畫成一張圖再處理，子元素再寫 filter: none 也救不回來，
  // 商家沒有任何辦法只讓照片變黑白而留住自己配的色。兩個控制湊在一起互相毀掉，跟淡化
  // ×進場動畫（a2428d8）、主色×自訂底色（29140d6）是同一類毛病。
  // 這控制要做的本來就是照片的事——編輯器的說明寫的是「合作 / 相簿黑白做雜誌感、journal
  // 復古做懷舊感」，那幾段畫面上的重量全在照片；文字跟著洗只是副作用。所以值改成餵
  // --store-media-filter，由 layout.tsx 對這一段裡的 img / video 套（見那份 <style>）。
  // sepia 加 brightness(1.02) 補回變暗的亮度，避免照片沉下去
  const filterToVal = (s: "none" | "grayscale" | "sepia" | undefined) => {
    if (s === "grayscale") return "grayscale(1)";
    if (s === "sepia") return "sepia(0.6) brightness(1.02)";
    return undefined;
  };
  // 區段寬度：boxed 置中 1100px / narrow 窄欄 760px / full 滿版（預設不套，section 維持滿版原狀）
  // 套在 section wrapper 上（maxWidth + margin auto），配 bgColor + 陰影 + 圓角就成「置中卡片式區段」
  const widthToVal = (s: "full" | "boxed" | "narrow" | undefined) => {
    if (s === "boxed") return "1100px";
    if (s === "narrow") return "760px";
    return undefined;
  };
  // 區段上下外距：normal 64px / large 112px / none 不套（section 維持貼緊相鄰區段）
  // 套在 section wrapper 的 marginTop+marginBottom，跟 sectionWidth 的 marginLeft/Right auto 不衝突；
  // 配 sectionWidth 置中卡片時，外距把卡片從上下區段拉開、真正浮出來
  const gapToVal = (s: "none" | "normal" | "large" | undefined) => {
    if (s === "normal") return "64px";
    if (s === "large") return "112px";
    return undefined;
  };
  // 底紋：純 CSS gradient 疊在底色上（不吃圖檔、不多一次請求）。線的顏色一律用 currentColor
  // 算，所以深底淺字的 section 自動變成淺色紋，商家不用再另外挑一次紋路顏色。
  // 回 backgroundImage + backgroundSize 一組，跟 backgroundColor 是不同屬性、不互相蓋掉。
  const textureToVal = (s: "none" | "grid" | "dots" | "lines" | undefined) => {
    const line = "color-mix(in srgb, currentColor 7%, transparent)";
    if (s === "grid")
      return {
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
      };
    if (s === "dots")
      return {
        backgroundImage: `radial-gradient(color-mix(in srgb, currentColor 14%, transparent) 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      };
    if (s === "lines")
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${line} 0, ${line} 1px, transparent 1px, transparent 10px)`,
        backgroundSize: "auto",
      };
    return undefined;
  };
  // 底色明暗變化：跟底紋同樣是疊在底色上的一層 gradient，顏色一樣走 currentColor——
  // 淺底深字的段落疊出來是往暗走、深底淺字的段落疊出來是提亮，商家不用再挑一次顏色，
  // 也不會挑出一個在自己底色上看不見（或整段變髒）的值。
  // 回傳跟 textureToVal 同一個形狀（backgroundImage + backgroundSize），下面合併時當成
  // 一層 layer 疊上去，跟底紋可以同時存在。
  const gradientToVal = (s: "none" | "top" | "bottom" | "vignette" | undefined) => {
    const heavy = "color-mix(in srgb, currentColor 12%, transparent)";
    if (s === "top")
      return {
        backgroundImage: `linear-gradient(to bottom, ${heavy} 0%, transparent 55%)`,
        backgroundSize: "auto",
      };
    if (s === "bottom")
      return {
        backgroundImage: `linear-gradient(to top, ${heavy} 0%, transparent 55%)`,
        backgroundSize: "auto",
      };
    if (s === "vignette")
      return {
        backgroundImage: `radial-gradient(ellipse at center, transparent 45%, ${heavy} 100%)`,
        backgroundSize: "auto",
      };
    return undefined;
  };
  const sectionStyleFor = (key: string) => {
    const s = theme.layout.sectionStyles[key];
    const padVar = padScaleToVar(s?.paddingScale);
    const headingScaleVal: "small" | "large" | undefined =
      s?.headingScale === "small" || s?.headingScale === "large" ? s.headingScale : undefined;
    const minH = minHeightToVal(s?.minHeight);
    const outline = outlineToVal(s?.outline);
    // 外框深淺：只回選了哪一檔，實際的顏色在 mergeSectionStyle 算——strong 要用該段的
    // 文字色、accent 要走那裡算好的 sectionAccent，兩個值都是那裡才有的。跟分隔線深淺
    // 同一個口徑：沒畫框就不回（框不存在，深淺沒有東西可套），沒設就 undefined、框照舊
    // 用原本的淡色，既有店家一圈框都不會變。
    const outlineToneVal: "strong" | "accent" | undefined =
      outline && (s?.outlineTone === "strong" || s?.outlineTone === "accent")
        ? s.outlineTone
        : undefined;
    // 外框線型：跟分隔線、色條的線型同一個口徑——沒畫框就不回（框不存在，線型沒有東西
    // 可套），沒設或選實線就 undefined、outline 字串照舊寫 solid，既有店家一圈框都不會變。
    const outlineStyleVal: "dashed" | "dotted" | undefined =
      outline && (s?.outlineStyle === "dashed" || s?.outlineStyle === "dotted")
        ? s.outlineStyle
        : undefined;
    const shadow = shadowToVal(s?.shadow);
    const radius = radiusToVal(s?.borderRadius);
    const font = fontFamilyToVal(s?.fontFamily);
    const letterSpacing = letterSpacingToVal(s?.letterSpacing);
    const lineHeight = lineHeightToVal(s?.lineHeight);
    const opacity = opacityToVal(s?.opacity);
    const filter = filterToVal(s?.filter);
    const width = widthToVal(s?.sectionWidth);
    const gap = gapToVal(s?.sectionGap);
    const texture = textureToVal(s?.texture);
    const bgGradient = gradientToVal(s?.bgGradient);
    // 進場動畫：只回 "fade" / "slide-up" 給 wrapper 設 data-anim attr；
    // 實際 CSS keyframes + scroll-timeline 在 layout.tsx 注入；edit mode 內 disable
    const entranceVal: "fade" | "slide-up" | undefined =
      s?.entrance === "fade" || s?.entrance === "slide-up" ? s.entrance : undefined;
    // 標題粗細：跟進場動畫同一招走 data attribute（data-heading-weight），不走 inline
    // CSS variable。font-weight 沒有「這個 var 沒設就別管我」的寫法——var() 的 fallback
    // 只能是另一個值，填什麼就等於把各 section 原本 Tailwind class 的粗細一律蓋成那個值。
    // 用 attribute selector 才能做到「沒設就整條規則不存在」，原本的粗細原封不動。
    const headingWeightVal: "light" | "bold" | undefined =
      s?.headingWeight === "light" || s?.headingWeight === "bold"
        ? s.headingWeight
        : undefined;
    // 標題大標行距：跟粗細同一招 data attribute。行距要蓋掉的是 h2 自己的 text-* class
    // 附帶的那個值（元素自己的 class 一律蓋掉 section 上的繼承值），inline style 只能設在
    // section 上、進不到 h2，得靠一條落在 h2 的規則。沒設就沒 attribute、整條規則不存在。
    const headingLeadingVal: "tight" | "loose" | undefined =
      s?.headingLeading === "tight" || s?.headingLeading === "loose"
        ? s.headingLeading
        : undefined;
    // 標題大標字距：不走 data attribute，走 CSS variable（--store-heading-track）。
    // 行距那格能靠一條落在 h2 的規則蓋掉 class 附帶的值，字距蓋不掉——各段 h2 的字距是寫在
    // 自己的 inline style 裡的（letterSpacing: var(--store-track, -0.01em)），inline 的優先度
    // 連 CSS 規則都壓不過，補幾條 attribute selector 都不會生效。整段字距（--store-track）
    // 當初就是為了同一個毛病改成讀變數的，大標這格接在它前面多一層：大標專屬 → 整段字距 →
    // 各段原本的值，商家只調大標時內文不動，只調整段時大標照舊跟著整段走。
    const headingTrackingVal: string | undefined =
      s?.headingTracking === "tight"
        ? "-0.05em"
        : s?.headingTracking === "wide"
          ? "0.08em"
          : undefined;
    // 標題底線：同樣走 data attribute（線畫在 h2::after，只有 CSS 生得出偽元素）。
    const headingRuleVal: "short" | "full" | undefined =
      s?.headingRule === "short" || s?.headingRule === "full" ? s.headingRule : undefined;
    // 底線粗細：跟長度分成兩個 attribute，粗細那條規則才能只寫 height 一行、長度那兩條
    // 只寫 width，不用把「短線細 / 短線粗 / 整條細 / 整條粗」四種組合各寫一條。
    // 沒設線就不掛（線都不存在，掛了是死 attribute）。
    const headingRuleWeightVal: "thin" | "thick" | undefined =
      headingRuleVal && (s?.headingRuleWeight === "thin" || s?.headingRuleWeight === "thick")
        ? s.headingRuleWeight
        : undefined;
    // 底線深淺：跟分隔線深淺同一個口徑——只回選了哪一檔，實際顏色在 mergeSectionStyle 算
    //（strong 要該段文字色、accent 要那裡算好的 sectionAccent）。沒畫線就不回（線不存在，
    // 深淺沒有東西可套），沒設就 undefined、變數照舊餵淡色，既有店家一條線都不會變。
    const headingRuleToneVal: "strong" | "accent" | undefined =
      headingRuleVal &&
      (s?.headingRuleTone === "strong" || s?.headingRuleTone === "accent")
        ? s.headingRuleTone
        : undefined;
    // 底線線型：跟深淺同一個口徑——沒畫線就不回（線不存在，線型沒有東西可套），沒設或
    // 選實線就 undefined、線照舊走 background 那條實線規則，既有店家一條線都不會變。
    const headingRuleStyleVal: "dashed" | "dotted" | undefined =
      headingRuleVal &&
      (s?.headingRuleStyle === "dashed" || s?.headingRuleStyle === "dotted")
        ? s.headingRuleStyle
        : undefined;
    // 分隔線粗細：翻成實際的線寬直接餵給 inline style（線本身是 section 的 borderTop /
    // borderBottom，不是偽元素，所以不必像標題底線那樣繞 data attribute）。沒畫線的段落
    // 一律回預設值，算出來的 border 字串跟以前一模一樣，既有店家一條線都不會變。
    const dividerWidth =
      s?.divider && s.divider !== "none" && s?.dividerWeight === "medium"
        ? "2px"
        : s?.divider && s.divider !== "none" && s?.dividerWeight === "thick"
          ? "4px"
          : "1px";
    // 分隔線深淺：只回選了哪一檔，實際的顏色在 mergeSectionStyle 算——strong 要用該段的
    // 文字色、accent 要走那裡算好的 sectionAccent（主色壓在自訂底色上看不見時已經換成該段
    // 文字色），兩個值都是那裡才有的。跟粗細同一個口徑：沒畫線就不回（線不存在，深淺沒有
    // 東西可套），沒設就 undefined、線照舊用原本的淡色，既有店家一條線都不會變。
    const dividerToneVal: "strong" | "accent" | undefined =
      s?.divider &&
      s.divider !== "none" &&
      (s?.dividerTone === "strong" || s?.dividerTone === "accent")
        ? s.dividerTone
        : undefined;
    // 分隔線線型：跟深淺同一個口徑——沒畫線就不回（線不存在，線型沒有東西可套），沒設或
    // 選實線就 undefined、border 字串照舊寫 solid，既有店家一條線都不會變。
    const dividerStyleVal: "dashed" | "dotted" | undefined =
      s?.divider &&
      s.divider !== "none" &&
      (s?.dividerStyle === "dashed" || s?.dividerStyle === "dotted")
        ? s.dividerStyle
        : undefined;
    // 側邊色條：只回哪一邊，粗細與顏色在 mergeSectionStyle 一起算（顏色要跟外框、
    // 分隔線同一份口徑，分開算就會出現同一段裡三種線各一個顏色）。
    const accentBarVal: "left" | "right" | undefined =
      s?.accentBar === "left" || s?.accentBar === "right" ? s.accentBar : undefined;
    // 色條粗細：翻成實際的線寬直接餵 inline style（色條本身是 section 的 borderLeft /
    // borderRight，不是偽元素，跟分隔線粗細同一個做法、不必繞 data attribute）。沒畫色條
    // 的段落一律回預設值，算出來的 border 字串跟以前一模一樣，既有店家一條色條都不會變。
    const accentBarWidth =
      accentBarVal && s?.accentBarWeight === "thin"
        ? "2px"
        : accentBarVal && s?.accentBarWeight === "thick"
          ? "8px"
          : "4px";
    // 色條深淺：只回選了哪一檔，實際的顏色在 mergeSectionStyle 算——strong 要用該段文字色、
    // accent 要走那裡算好的 sectionAccent、soft 要從「原本那個色」再淡，三個都是那裡才有的
    // 值。跟分隔線深淺同一個口徑：沒畫色條就不回（條不存在，深淺沒有東西可套），沒設就
    // undefined、顏色照舊走原本那兩種寫死值，既有店家一條色條都不會變。
    const accentBarToneVal: "soft" | "strong" | "accent" | undefined =
      accentBarVal &&
      (s?.accentBarTone === "soft" ||
        s?.accentBarTone === "strong" ||
        s?.accentBarTone === "accent")
        ? s.accentBarTone
        : undefined;
    // 色條線型：跟分隔線線型同一個口徑——沒畫色條就不回（條不存在，線型沒有東西可套），
    // 沒設或選實線就 undefined、border 字串照舊寫 solid，既有店家一條色條都不會變。
    const accentBarStyleVal: "dashed" | "dotted" | undefined =
      accentBarVal &&
      (s?.accentBarStyle === "dashed" || s?.accentBarStyle === "dotted")
        ? s.accentBarStyle
        : undefined;
    // 行高：section 上的 inline lineHeight 只管得到沒有自己行高的文字，內文段落都帶
    // leading-* class（元素自己的 class 蓋掉繼承值），所以同一個值也走一份 data attribute
    // 讓 layout.tsx 針對內文元素補規則。沒設就沒 attribute、整條規則不存在。
    const lineHeightVal: "tight" | "relaxed" | undefined =
      s?.lineHeight === "tight" || s?.lineHeight === "relaxed" ? s.lineHeight : undefined;
    // 內文對齊：同樣走 data attribute。headingAlign 設的是整段容器的 text-align，段落靠繼承
    // 拿到同一個值，所以標題與內文一直只能同進退——商家想做報紙那種「標題置中、內文靠左」
    // 只能整段改對齊，標題跟著跑掉。inline style 在這裡幫不上忙：要蓋掉的是段落自己的
    // text-* class（元素自己的 class 一律蓋掉繼承值），得靠一條落在段落上的規則。
    // 沒設（或選「跟標題一致」）就沒 attribute、整條規則不存在，既有店家一個字都不會動。
    const bodyAlignVal: "left" | "center" | "right" | undefined =
      s?.bodyAlign === "left" || s?.bodyAlign === "center" || s?.bodyAlign === "right"
        ? s.bodyAlign
        : undefined;
    // 內文一行字數：attribute 當開關（CSS 判斷不了變數有沒有設，用 var() fallback 那條
    // max-width 會落在每一段的每個段落上），寬度本身走 --store-measure-max。
    const bodyMeasureVal: "normal" | "narrow" | undefined =
      s?.bodyMeasure === "normal" || s?.bodyMeasure === "narrow" ? s.bodyMeasure : undefined;
    const bodyMeasureMax = measureToVal(s?.bodyMeasure);
    // 內文字級：同樣只回 attribute，實際縮放由 layout.tsx 那條規則做（不是 inline font-size
    // ——那會把同一段裡本來大小不同的內文壓成同一級，見那裡的說明）。
    const bodyScaleVal: "small" | "large" | undefined =
      s?.bodyScale === "small" || s?.bodyScale === "large" ? s.bodyScale : undefined;
    // 內文濃淡：這一欄不走 attribute 也不走 layout.tsx 的規則，改覆寫 --store-text-muted。
    // 描述、說明、圖說這類次要文字都是 inline style 寫 color: var(--store-text-muted)（見
    // mergeSectionStyle 上面那條約定），inline 的優先度連 CSS 規則都蓋不過——內文對齊、
    // 一行字數那組「補一條規則」的招在這裡沒用，只能比照區段字體（693459c）與字距
    // （55ca20c）：那些字既然都讀同一個變數，覆寫變數它們自然全部跟著換。
    // 值本身在 mergeSectionStyle 算（要用到該段的文字色，沒設才退回全站的）。
    const bodyToneVal: "muted" | "strong" | undefined =
      s?.bodyTone === "muted" || s?.bodyTone === "strong" ? s.bodyTone : undefined;
    // 內文粗細：跟內文大小、內文對齊同一個處境同一個解法——只回 attribute，實際的字重由
    // layout.tsx 那兩條規則落在段落那批元素上。不能走 inline：段落上設 font-weight 是繼承
    // 值，帶 font-* class 的那幾行（卡片、標籤）會攔掉，而該被蓋掉的偏偏是這些 class。
    // 濃淡那欄改的是顏色變數、這欄改的是字重，兩個各自獨立，疊起來也講得通。
    const bodyWeightVal: "medium" | "bold" | undefined =
      s?.bodyWeight === "medium" || s?.bodyWeight === "bold" ? s.bodyWeight : undefined;
    // 內文字距：跟內文粗細、內文大小、內文對齊同一個處境同一個解法——只回 attribute，實際
    // 的字距由 layout.tsx 那兩條規則落在段落那批元素上。不能走整段的 letterSpacing 或
    // --store-track：那兩個是上面「字距」那格在寫的，會連大標、引言、數字、問句一起動，
    // 而這格要動的就只有段落自己的內文（中文的大標與內文要的方向常常相反）。
    const bodyTrackingVal: "tight" | "wide" | undefined =
      s?.bodyTracking === "tight" || s?.bodyTracking === "wide" ? s.bodyTracking : undefined;
    // 標題用色：跟內文濃淡同一個處境同一個解法。標題的顏色是 inline style（規則蓋不過
    // inline），但每個 h2 讀的都是同一個變數——inline color 改讀 --store-heading-color、
    // fallback 回 --store-text，商家沒設就跟原本一模一樣，設了就只有標題換色。
    // 值在 mergeSectionStyle 算：accent 要走那裡算好的 sectionAccent（主色壓在自訂底色上
    // 看不見時已經換成該段文字色的那個），在這裡自己拿 theme.accent 會繞過那道防呆。
    const headingToneVal: "accent" | "muted" | undefined =
      s?.headingTone === "accent" || s?.headingTone === "muted" ? s.headingTone : undefined;
    // 內容垂直位置：同樣走 attribute（沒設就整條規則不存在，內容照舊從上緣排）。
    // 實際怎麼推由 layout.tsx 那條規則做，見那裡為什麼不是把 section 改成 flex。
    const contentAlignVal: "middle" | "bottom" | undefined =
      s?.contentAlign === "middle" || s?.contentAlign === "bottom" ? s.contentAlign : undefined;
    // 這一段在哪台裝置不顯示：同樣走 attribute，實際藏起來的是 layout.tsx 那兩條 media query。
    // 不在這裡用 inline display: none —— 那要在伺服器上就知道客人拿什麼裝置在看（讀不到，
    // 同一份 HTML 會被 CDN 快取給所有人），而且編輯器預覽是同一份頁面塞在不同寬度的 iframe
    // 裡，靠 CSS 判斷寬度才能做到「切到手機預覽就看得到會不會消失」。
    const hideOnVal: "mobile" | "desktop" | undefined =
      s?.hideOn === "mobile" || s?.hideOn === "desktop" ? s.hideOn : undefined;
    // 濾鏡：值走 --store-media-filter（見 mergeSectionStyle），但還要一個 attribute 當開關
    // ——CSS 沒有「這個變數有沒有設」的判斷式，只能靠 attribute selector 做到「沒設就整條
    // 規則不存在」，否則那條 img 規則會落在每一段的每張照片上，蓋掉圖片自己的 filter。
    const filterVal: "grayscale" | "sepia" | undefined =
      s?.filter === "grayscale" || s?.filter === "sepia" ? s.filter : undefined;
    // 照片圓角：跟濾鏡同一個處境（要落在這一段裡的照片上，不是段落自己），所以同樣走
    // attribute 讓 layout.tsx 補規則。不寫 inline style —— 段落上的 borderRadius 是段落
    // 自己的框，傳不下去給裡面的圖；商品卡的圖框還帶著全站寫死的 4px，要蓋掉它也得靠
    // 一條落在那個框上的規則。沒設就沒 attribute、整條規則不存在，照片維持原本的形狀。
    const mediaRadiusVal: "soft" | "round" | undefined =
      s?.mediaRadius === "soft" || s?.mediaRadius === "round" ? s.mediaRadius : undefined;
    // 照片比例：要動的是卡片格線裡那個圖框（.sproutly-card-image）的 aspect-ratio，各段
    // 寫死一個值（選物 3:4、精選 1:1、慢讀 5:3、照片牆 1:1）——跟照片圓角同一個處境同一個
    // 解法，attribute 讓 layout.tsx 補規則。只掛在有卡片圖框的那四段；hero 那張的比例是
    // 版型的一部分（split 左右分欄靠它撐高度），不歸這一欄管。
    const mediaAspectVal: "square" | "portrait" | "landscape" | undefined =
      s?.mediaAspect === "square" || s?.mediaAspect === "portrait" || s?.mediaAspect === "landscape"
        ? s.mediaAspect
        : undefined;
    // 照片取景：照片鋪滿框再裁時預設從正中間取，直式商品照被裁掉的上緣（葉冠、瓶口）
    // 剛好是重點——這一欄選被裁時保留哪一端。要動的是圖框裡那張 img 的 object-position，
    // 跟照片比例同一個處境同一個解法：attribute 讓 layout.tsx 補規則，只掛在有卡片圖框
    // 的四段。沒設就沒 attribute、整條規則不存在，照片維持置中裁。
    const mediaFocusVal: "top" | "bottom" | undefined =
      s?.mediaFocus === "top" || s?.mediaFocus === "bottom" ? s.mediaFocus : undefined;
    // 照片放不放得下整張：上面兩欄都還在「一定會裁」的前提裡（框的比例固定、每張照片的
    // 比例不同，鋪滿就一定切掉一邊），這一欄是那個前提本身。同樣走 attribute 讓 layout.tsx
    // 補規則——要蓋掉的是圖自己帶的 object-cover class，段落上的 inline style 傳不下去。
    const mediaFitVal: "contain" | undefined =
      s?.mediaFit === "contain" ? "contain" : undefined;
    // 合作 logo 大小：上面那四欄的規則都落在卡片格線裡的圖框（.sproutly-card-image）上，
    // 合作那段的 logo 不在圖框裡——它是直接排在 flex 容器裡的 img，高度寫死 h-8 / sm:h-10 /
    // md:h-12。方形的商圈標章、上圖下字的兩層式 logo 在 48px 高裡只剩一小塊是字，客人認不
    // 出是誰。同樣走 attribute 讓 layout.tsx 補規則：段落上的 inline style 到不了那張 img，
    // 而且要跟著手機 / 平板 / 桌機各給一個高度，只有規則做得到。只掛合作那一段。
    const partnerLogoScaleVal: "small" | "large" | undefined =
      s?.partnerLogoScale === "small" || s?.partnerLogoScale === "large"
        ? s.partnerLogoScale
        : undefined;
    // 合作 logo 濃淡：那排 logo 一律印在 50% 透明度上（滑鼠移上去才回到 100%，手機沒有這個
    // 動作），淺灰底上再乘 0.5 的細字標幾乎只剩一團形狀。段落層的「淡化」透明的是整段連小標
    // 一起、「濾鏡」換的是黑白或復古，都不是這層；logo 那個 opacity-50 寫在 class 上，段落上
    // 的 inline style 傳不下去，同樣 attribute 讓 layout.tsx 補規則。只掛合作那一段。
    const partnerLogoOpacityVal: "faint" | "solid" | undefined =
      s?.partnerLogoOpacity === "faint" || s?.partnerLogoOpacity === "solid"
        ? s.partnerLogoOpacity
        : undefined;
    // 標題與內容的距離：要動的是段落最上面那塊（小標 + 大標 + 引言）自己帶的 mb-* class，
    // 段落上的 inline style 到不了它——跟卡片間距同一個處境同一個解法，attribute 讓
    // layout.tsx 補規則落在 .sproutly-section-head 上（各段那塊都掛了這個 class）。
    // 掛在最上面真的有一塊標題、底下真的有內容的那幾段；標題被拖成自由定位時那塊是絕對
    // 定位的，本來就沒有外距可調，那個分支不掛 class，規則自然不會命中。
    const headingGapVal: "tight" | "loose" | undefined =
      s?.headingGap === "tight" || s?.headingGap === "loose" ? s.headingGap : undefined;
    // 標題塊裡面的距離：上面那欄調的是那塊對外的下緣，這欄調的是那塊裡面——小標跟大標之間
    // （小標自己帶的 mb-*）、大標跟底下引言或那截短線之間（那行自己帶的 mt-*）。同樣蓋不到
    // 的是各元素自己的 class，所以同一招走 attribute 讓 layout.tsx 補規則，落在小標的
    // .sproutly-section-eyebrow 與底下那行的 .sproutly-section-sub 上。自由定位那個分支
    // 也掛（那塊整個被搬走，但裡面三行的相對距離還是照原本的 class 走，一樣該調得到）。
    const headingInnerGapVal: "tight" | "loose" | undefined =
      s?.headingInnerGap === "tight" || s?.headingInnerGap === "loose"
        ? s.headingInnerGap
        : undefined;
    // 小標字距：那行小標的 0.4em 寫在它自己的 tracking-[0.4em] class 上（元素自己的 class
    // 一律蓋掉繼承來的值），段落上的「字距」那欄設的是整段的 inline letter-spacing，傳到
    // 小標身上就被自己的 class 攔掉——所以整段調字距時小標是唯一動都不動的那行。要蓋掉
    // 元素自己的 class 只能靠一條更精確的規則，跟標題塊裡面那組同一招走 attribute，
    // 規則落在 .sproutly-section-eyebrow 上。掛在最上面那行真的是小標的那幾段。
    const eyebrowTrackingVal: "tight" | "wide" | undefined =
      s?.eyebrowTracking === "tight" || s?.eyebrowTracking === "wide"
        ? s.eyebrowTracking
        : undefined;
    // 小標字級：上面那欄調字與字之間，這欄調那行字本身多大。那行的 10px（有兩段 11px）
    // 同樣寫在它自己的 text-[10px] class 上，段落上調字級的那幾欄（標題大小動大標、全網站
    // 字體大小動內文）都到不了它——一樣走 attribute，規則落在 .sproutly-section-eyebrow
    // 上。跟上面那欄掛在同一批段落（最上面那行真的是小標的那幾段）。
    const eyebrowScaleVal: "small" | "large" | undefined =
      s?.eyebrowScale === "small" || s?.eyebrowScale === "large"
        ? s.eyebrowScale
        : undefined;
    // 小標粗細：上兩欄補的是那行字的字距與大小，這欄補的是那行字本身多重。各段寫死的粗細
    // 分兩種——選物與精選那兩段的小標寫在 inline style 上是 500，其餘八段沒設、繼承下來
    // 是 400。「內文粗細」那條規則的選擇器（p / li / ...）確實會命中這行 <p>，但一動就把
    // 整段的描述、引言、答案一起變粗，做不到只動小標。所以一樣走 attribute，而且要兩條規則
    // 才夠：一條蓋掉繼承來的 400，一條在 section 上設 --eyebrow-weight 給那兩行 inline 的
    // 500 讀（inline 壓得過 CSS 規則，只能繞變數）。跟上兩欄掛在同一批段落。
    const eyebrowWeightVal: "light" | "medium" | "bold" | undefined =
      s?.eyebrowWeight === "light" ||
      s?.eyebrowWeight === "medium" ||
      s?.eyebrowWeight === "bold"
        ? s.eyebrowWeight
        : undefined;
    // 小標行距：上兩欄補的是那行字的橫向與大小，這欄補的是它換行之後上下兩行隔多遠。那行是
    // <p> 又沒帶 leading class，行距是從段落那層的內文行高整條繼承下來的——那個值是給一整段
    // 要讀的字挑的，套在 10px 的標籤上兩行會散開；而唯一動得到它的「行高」會把整段的描述、
    // 引言、答案一起拖著走。所以一樣走 attribute，規則落在 .sproutly-section-eyebrow 上，
    // 屬性數比行高那條多一個，蓋得過去。跟上兩欄掛在同一批段落。
    const eyebrowLeadingVal: "tight" | "loose" | undefined =
      s?.eyebrowLeading === "tight" || s?.eyebrowLeading === "loose"
        ? s.eyebrowLeading
        : undefined;
    // 小標用色：跟標題用色（headingTone）同一個處境同一個解法。那行的顏色是 inline style
    // （規則蓋不過 inline），但每一行的 inline color 都改讀 --store-eyebrow-color、fallback
    // 回它原本那個值（十四段是主色、合作那兩行是次要文字色），商家沒設就跟原本一模一樣。
    // 值在 mergeSectionStyle 算：accent 要走那裡算好的 sectionAccent（主色壓在自訂底色上
    // 看不見時已經換成該段文字色的那個），在這裡自己拿 theme.accent 會繞過那道防呆。
    const eyebrowToneVal: "accent" | "muted" | "text" | undefined =
      s?.eyebrowTone === "accent" || s?.eyebrowTone === "muted" || s?.eyebrowTone === "text"
        ? s.eyebrowTone
        : undefined;
    // 小標大小寫：那行小標的 uppercase 跟 0.4em、10px 一樣寫在它自己的 class 上，段落那層
    // 沒有一欄傳得下去（前面五格動的是字距、大小、粗細、行距、顏色，沒有一個換字形）。
    // 對中文無效是預期的（方塊字沒有大小寫），問題在英文與混排：商家拿英文店名或「Est. 2019」
    // 當小標會被整行拉成大寫，而店名的大小寫通常是 logo 的一部分；改資料也沒用，轉換發生在
    // 畫面上，輸入框看到的還是自己打的小寫。一樣走 attribute，規則落在 .sproutly-section-eyebrow
    // 上。全大寫那一檔是「照原本的」（editor 按下去等於清掉這一欄），所以只有另外兩檔會發出
    // attribute。跟上面幾欄掛在同一批段落。
    const eyebrowCaseVal: "capitalize" | "none" | undefined =
      s?.eyebrowCase === "capitalize" || s?.eyebrowCase === "none"
        ? s.eyebrowCase
        : undefined;
    // 卡片間距：要動的是這一段裡那個卡片格線容器的 gap，不是段落自己——跟照片圓角同一個
    // 處境同一個解法，attribute 讓 layout.tsx 補規則。規則只落在 .sproutly-card-grid 上
    // （各段的卡片格線容器都掛了這個 class），不能寫成落在所有 .grid 上——hero 的左右
    // 分欄、切版用的 grid 也是 grid，蓋到那些會把版型拆掉。沒設就沒 attribute、整條規則
    // 不存在，各段的間距維持自己原本那組值。
    const gridGapVal: "tight" | "loose" | undefined =
      s?.gridGap === "tight" || s?.gridGap === "loose" ? s.gridGap : undefined;
    // 滑過卡片的動作：要蓋掉的是 layout.tsx 裡 .sproutly-card:hover 那組全站寫死的動作
    // （浮起 + 照片放大 + 壓暗 + 標題字距），段落上的 inline style 蓋不到 hover 狀態，
    // 也蓋不到卡片裡面那幾層——跟卡片間距同一個處境同一個解法，attribute 讓 layout.tsx
    // 補一組更精確的規則壓過原本那組。只掛在有卡片的四段。沒設就沒 attribute、整條規則
    // 不存在，卡片維持原本的動作。
    const cardHoverVal: "calm" | "none" | undefined =
      s?.cardHover === "calm" || s?.cardHover === "none" ? s.cardHover : undefined;
    // 卡片文字位置：卡片下面那幾行自己沒帶對齊，繼承整段容器的 text-align（預設置中），
    // 商家想做「大標置中、卡片文字靠左」動不了；而「內文對齊」那組規則落在段落上，會把
    // 卡片裡的價錢、副標拉走、品名（h3）留在原地，同一張卡兩行各自對齊。要把卡片裡的
    // 標題與段落一起指定，得靠一條落在卡片裡的規則——跟卡片間距、滑過卡片同一個處境同
    // 一個解法，attribute 讓 layout.tsx 補規則。只掛在有卡片的四段。
    const cardTextVal: "left" | "center" | "right" | undefined =
      s?.cardText === "left" || s?.cardText === "center" || s?.cardText === "right"
        ? s.cardText
        : undefined;
    // 卡片外觀：要畫的是每張卡片自己的底與框，段落上的 inline style 只到段落那一層
    // （「底色 / 外框 / 圓角 / 陰影」那四欄畫的是整段的外圍，分不到裡面每張卡身上）——
    // 跟卡片間距、卡片文字同一個處境同一個解法，attribute 讓 layout.tsx 補規則。
    // 顏色不在這裡算：底與框都走 currentColor 的淡色（見 layout.tsx），深底淺字的段落
    // 自動變成淺色，不用再挑一次。只掛在有卡片的四段。
    const cardSurfaceVal: "panel" | "outline" | undefined =
      s?.cardSurface === "panel" || s?.cardSurface === "outline" ? s.cardSurface : undefined;
    // 卡片內距：卡片裡的東西跟框之間留多少，那條 padding 寫在 layout.tsx 的卡片外觀規則裡
    // （寫死 14px），段落上的 inline style 一樣到不了卡片自己那層——同一個處境同一個解法。
    // 沒設底或框就不掛：卡片沒有邊界時內距是看不見的空白，掛了是死 attribute。
    const cardPaddingVal: "tight" | "loose" | undefined =
      cardSurfaceVal && (s?.cardPadding === "tight" || s?.cardPadding === "loose")
        ? s.cardPadding
        : undefined;
    // 卡片排法：照片從卡片上面搬到左邊，要重排的是卡片自己那幾層子元素（圖框、品名、
    // 價錢是平的一疊 block），還要順手把手機收成一列一張——兩件事段落上的 inline style
    // 都碰不到，跟卡片外觀、卡片文字同一個處境同一個解法，attribute 讓 layout.tsx 補規則。
    // 只掛在照片底下真的有字的三段（選物 / 精選 / 慢讀）：照片牆的卡片裡只有一張圖，
    // 把圖推到左邊右邊會空著，那一格按了等於把版面弄壞，不給比給了沒用好。
    const cardLayoutVal: "side" | "side-reverse" | undefined =
      s?.cardLayout === "side" || s?.cardLayout === "side-reverse" ? s.cardLayout : undefined;
    // 照片佔寬：橫著排時左右兩欄怎麼分，寫在 layout.tsx 那條 grid-template-columns 上
    // （38% 對 1fr），段落上的 inline style 一樣到不了卡片自己那層——同一個處境同一個解法。
    // 跟卡片排法掛同樣的三段，沒設成橫排的段落掛了也不會有反應（那條規則要兩個 attribute
    // 一起命中才成立）。
    const cardMediaWidthVal: "narrow" | "wide" | undefined =
      s?.cardMediaWidth === "narrow" || s?.cardMediaWidth === "wide"
        ? s.cardMediaWidth
        : undefined;
    // 手機一列幾張：每一段格線的手機欄數寫死在 Tailwind class 裡（選物、精選、照片牆、
    // 數字兩張，慢讀、客人的話一張），要換只能在 640 以下再蓋一次 grid-template-columns
    // ——段落上的 inline style 到不了裡面那層格線，也沒辦法只在某個寬度生效，跟卡片間距
    // 同一個處境同一個解法，attribute 讓 layout.tsx 補規則。
    // 掛在所有排成格線的段落（合作 logo 那段是 flex 排到滿自動換行，沒有欄數這回事，
    // 掛了也不會有反應，所以不掛）。
    const mobileColumnsVal: "one" | "two" | undefined =
      s?.mobileColumns === "one" || s?.mobileColumns === "two" ? s.mobileColumns : undefined;
    // 卡片標題行數：要蓋掉的是品名那行自己帶的 line-clamp-1（精選那段寫死一行），或反過來
    // 幫沒截的段落補上截斷——兩件事都落在卡片裡那個 h3 上，段落上的 inline style 傳不下去，
    // 跟卡片文字、卡片外觀同一個處境同一個解法，attribute 讓 layout.tsx 補規則。
    // 只掛在卡片底下真的有標題的三段（選物 / 精選 / 慢讀）：照片牆的卡片裡只有一張圖，
    // 掛了不會有反應。
    const cardTitleLinesVal: "one" | "two" | "full" | undefined =
      s?.cardTitleLines === "one" || s?.cardTitleLines === "two" || s?.cardTitleLines === "full"
        ? s.cardTitleLines
        : undefined;
    // 卡片描述行數：跟上面那格同一個處境同一個解法（要動的是卡片裡那個 p，段落上的
    // inline style 傳不下去），attribute 讓 layout.tsx 補規則。
    // 只掛在品名底下那行真的是描述的兩段（選物的副標 / 慢讀的摘要）：精選那段同一個位置
    // 放的是價錢，照片牆的卡片裡只有圖，兩段掛了不是沒反應就是把價錢截掉。
    const cardDescLinesVal: "one" | "two" | "three" | "full" | undefined =
      s?.cardDescLines === "one" ||
      s?.cardDescLines === "two" ||
      s?.cardDescLines === "three" ||
      s?.cardDescLines === "full"
        ? s.cardDescLines
        : undefined;
    // 卡片標題字級：要蓋掉的是品名那行自己帶的 text-base / text-lg class，段落上調字級的
    // 那幾欄（標題大小動大標、全網站字體大小動內文、小標字級動 eyebrow）都到不了卡片裡
    // 那個 h3——跟卡片標題行數同一個處境同一個解法，attribute 讓 layout.tsx 補規則。
    // 掛在卡片底下真的有標題的三段（選物 / 精選 / 慢讀），跟行數那格同樣三段。
    const cardTitleScaleVal: "small" | "large" | undefined =
      s?.cardTitleScale === "small" || s?.cardTitleScale === "large"
        ? s.cardTitleScale
        : undefined;
    // 卡片標題粗細：上一格動的是品名那行多大，這格動的是它多粗。三段的品名都寫死 400，
    // 跟底下的描述、價錢只差在字級與顏色淡一點，卡片一小、或描述一調大就分不出哪行是品名。
    // 這行的粗細寫在 h3 自己的 inline style 上（跟顏色、字體同一包），CSS 規則蓋不過
    // inline——所以下面改成由 --card-title-weight 這個變數帶，值在 layout.tsx 依這個
    // attribute 給。沒設的店拿到的是 fallback 400，跟原本一模一樣。
    // 掛在卡片底下真的有標題的三段（選物 / 精選 / 慢讀），跟字級那格同樣三段。
    const cardTitleWeightVal: "medium" | "bold" | undefined =
      s?.cardTitleWeight === "medium" || s?.cardTitleWeight === "bold"
        ? s.cardTitleWeight
        : undefined;
    // 卡片標題行距：上兩格動的是品名那行多大、多粗，這格動的是它排到兩行以上時，上下兩行
    // 之間隔多遠。那個值是跟著字級 class 來的（選物 1.4-1.56、精選 1.5、慢讀寫死 1.4），
    // 照一行字的狀況挑的；卡片標題行數那格讓品名可以顯示到兩行甚至完整之後，換行才第一次
    // 出現，中文上下兩行的筆畫幾乎黏在一起。段落上「行高」那欄的規則只落在 p 那類元素，
    // 卡片裡的品名是 h3、整組跳過，attribute 讓 layout.tsx 補規則。
    // 掛在卡片底下真的有標題的三段（選物 / 精選 / 慢讀），跟字級、粗細那兩格同樣三段。
    const cardTitleLeadingVal: "tight" | "loose" | undefined =
      s?.cardTitleLeading === "tight" || s?.cardTitleLeading === "loose"
        ? s.cardTitleLeading
        : undefined;
    // 卡片品名字距：上一格動的是品名換行之後上下隔多遠，這格動的是同一行裡字與字隔多遠。
    // 選物與精選的品名沒設字距（跟著整段的 --store-track 走），慢讀那行寫死 -0.005em 在
    // 自己的 inline style 裡——inline 蓋不過 CSS 規則，所以 layout.tsx 那組除了規則還設
    // --card-title-track，那行改讀變數。
    // 掛的三段跟字級、粗細、行距那幾格一樣（選物 / 精選 / 慢讀）。
    const cardTitleTrackingVal: "tight" | "wide" | undefined =
      s?.cardTitleTracking === "tight" || s?.cardTitleTracking === "wide"
        ? s.cardTitleTracking
        : undefined;
    // 卡片品名用色：前面四格動的是品名那行多大、多粗、換行隔多遠、字與字隔多遠，這格動的
    // 是它什麼顏色。三段的品名都寫死 --store-text（跟段落內文同深），整張卡上沒有一個顏色
    // 上的落點。跟標題用色（headingTone）、小標用色（eyebrowTone）同一個處境同一個解法：
    // 顏色寫在 h3 自己的 inline style 上（規則蓋不過 inline），三個位置的 color 都改讀
    // --card-title-color、fallback 回原本的 --store-text，值在 mergeSectionStyle 算——
    // accent 要走那裡算好的 sectionAccent（主色壓在自訂底色上看不見時已經換成該段文字色
    // 的那個），在這裡自己拿 theme.accent 會繞過那道防呆。
    const cardTitleToneVal: "accent" | "muted" | undefined =
      s?.cardTitleTone === "accent" || s?.cardTitleTone === "muted"
        ? s.cardTitleTone
        : undefined;
    // 卡片描述字級：上一格動的是品名那行，這格動的是它底下那段描述（寫死 14px）。同樣是
    // 段落上的 inline style 傳不下去，attribute 讓 layout.tsx 補規則。
    // 掛的範圍跟卡片描述行數那格一樣是兩段（選物副標 / 慢讀摘要）：精選那段同一個位置放
    // 的是價錢，不該被這格縮放。
    const cardDescScaleVal: "small" | "large" | undefined =
      s?.cardDescScale === "small" || s?.cardDescScale === "large"
        ? s.cardDescScale
        : undefined;
    // 卡片描述行距：上一格動的是那段描述多大，這格動的是它排到第二行以後，上下兩行之間隔
    // 多遠。品名那行已經有一格，但描述才是卡片上一定會換行的那段，而兩段的行距各寫各的
    // （選物副標只跟著 text-sm 走約 1.43、慢讀摘要寫死 1.85），一邊黏一邊散。段落上「行高」
    // 那欄的規則只落在 p 那類元素，卡片裡的描述整組跳過，attribute 讓 layout.tsx 補規則。
    // 掛的範圍跟字級那格一樣是兩段（選物副標 / 慢讀摘要）：精選那段同一個位置放的是價錢。
    const cardDescLeadingVal: "tight" | "loose" | undefined =
      s?.cardDescLeading === "tight" || s?.cardDescLeading === "loose"
        ? s.cardDescLeading
        : undefined;
    // 卡片描述粗細：上兩格動的是那段描述多大、行與行隔多遠，這格動的是它多粗。描述那段
    // 寫死 400，還同時被「卡片副文字深淺」淡到 0.7、字級又比品名小，三個減法疊起來，慢讀
    // 那種摘要卡上客人真正要讀的一段反而是最輕的一行。跟品名那格不同，這裡不必繞變數：
    // 描述的 inline style 只有顏色，粗細是 class 那層的預設，layout.tsx 的規則蓋得過去。
    // 掛的範圍跟描述字級、行距那兩格一樣是兩段（選物副標 / 慢讀摘要）：精選那段同一個位置
    // 放的是價錢，價錢自己有一格粗細。
    const cardDescWeightVal: "medium" | "bold" | undefined =
      s?.cardDescWeight === "medium" || s?.cardDescWeight === "bold"
        ? s.cardDescWeight
        : undefined;
    // 卡片描述字距：上面幾格動的是那段描述多大、行距多開、多粗，這格動的是同一行裡字與字
    // 之間隔多遠。兩段描述都沒設自己的字距、跟著整段繼承走，「內文字距」那格碰得到它們但
    // 一動整段的引言、答案全跟著動；品名字距撐開之後底下那句副標跟不上，一鬆一緊疊在同一
    // 張卡上。attribute 讓 layout.tsx 補規則（描述的 inline style 只有顏色，字距蓋得過去）。
    // 掛的範圍跟描述字級、行距、粗細那幾格一樣是兩段（選物副標 / 慢讀摘要）：精選那段同一
    // 個位置放的是價錢，不掛 sproutly-card-desc。
    const cardDescTrackingVal: "tight" | "wide" | undefined =
      s?.cardDescTracking === "tight" || s?.cardDescTracking === "wide"
        ? s.cardDescTracking
        : undefined;
    // 卡片描述用色：上面三格動的是那段描述多大、行與行隔多遠、多粗，這格動的是它什麼顏色。
    // 兩段的描述都寫死 --store-text-muted（文字色的七成），選物那行外面還套著卡片那層
    // opacity 0.7，前面三格全都繞著顏色走，補完了慢讀那種摘要卡上客人真正要讀的一段還是
    // 最輕的。跟品名用色（cardTitleTone）、價錢用色（cardPriceTone）同一個處境同一個解法：
    // 顏色寫在那兩段自己的 inline style 上（規則蓋不過 inline），改讀 --card-desc-color、
    // fallback 回原本的值，變數在 mergeSectionStyle 算——accent 要走那裡算好的 sectionAccent，
    // 在這裡自己拿 theme.accent 會繞過那道防呆。
    // 掛的範圍跟描述字級、行距、粗細那三格一樣是兩段（選物副標 / 慢讀摘要）。
    const cardDescToneVal: "accent" | "text" | undefined =
      s?.cardDescTone === "accent" || s?.cardDescTone === "text"
        ? s.cardDescTone
        : undefined;
    // 卡片小字字級：上兩格動的是品名與描述，這格動的是卡片上那幾行全大寫小字（寫死 10px
    // 的「看更多」、分類、標籤）。同樣是段落上的 inline style 傳不下去，attribute 讓
    // layout.tsx 補規則。掛的範圍是選物與慢讀兩段：精選那段同一個位置放的是「剩 N」庫存
    // 提示，那是狀態不是導覽文字，不該被這格縮放。
    const cardMicroScaleVal: "small" | "large" | undefined =
      s?.cardMicroScale === "small" || s?.cardMicroScale === "large"
        ? s.cardMicroScale
        : undefined;
    // 卡片小字字距：上一格動的是那幾行小字多大，這格動的是字與字之間空多少（寫死的
    // 0.3em / 0.4em，照英文全大寫短詞挑的，中文擠進去會散成一個個單字）。
    // 那幾行的字距大多寫在 Tailwind class 上，這份 <style> 沒包在 @layer、規則蓋得過去；
    // 只有精選那行「剩 N」的字距在 inline style 裡（跟顏色同一包），CSS 規則蓋不過
    // inline，所以下面改成由 --card-micro-track 帶，值一樣在 layout.tsx 依這個 attribute 給。
    // 掛的範圍跟字級那格一樣是三段（選物 / 精選 / 慢讀），卡片上有這種小字的就這三段。
    const cardMicroTrackingVal: "tight" | "wide" | undefined =
      s?.cardMicroTracking === "tight" || s?.cardMicroTracking === "wide"
        ? s.cardMicroTracking
        : undefined;
    // 卡片小字行距：上兩格動的是那幾行小字多大、同一行裡字與字之間空多少，這格動的是它們
    // 排到第二行之後上下兩行隔多遠。那幾行換行的機率跟段落小標一樣高——自己帶著 0.3-0.4em
    // 的字距，字級那格按到大之後 zoom 連字距一起放大，長一點的分類或標籤在手機的窄卡上
    // 一行放不下是常態。慢讀那兩行是 <p>、沒帶 leading class，繼承的是段落那層的內文行高
    // （預設 1.7、商家按到舒展就是 2），套在 10px 的標籤上兩行之間空得比字還高。
    // 規則帶 class 落在 layout.tsx，行距在 class 那層、inline style 只有顏色與字距，蓋得過去。
    // 掛的範圍跟字級、字距那兩格一樣是三段（選物 / 精選 / 慢讀）。
    const cardMicroLeadingVal: "tight" | "loose" | undefined =
      s?.cardMicroLeading === "tight" || s?.cardMicroLeading === "loose"
        ? s.cardMicroLeading
        : undefined;
    // 卡片小字粗細：上三格動的是那幾行小字多大、字與字之間空多少、換行後上下隔多遠，這格
    // 動的是它們多粗。
    // 那幾行的粗細各寫各的：選物的「看更多」、慢讀的分類與標籤沒設就是 400，10px 的中文
    // 加上 0.3em 字距，在淺底上細成一條灰線；精選的「剩 N」是 class 上的 font-medium
    // （500），用琥珀色印，在小卡上比價錢還搶。段落層的「小標粗細」規則落在自己的 eyebrow
    // 上、卡片描述與價錢那兩格的規則各帶自己的 class，三組都到不了這幾行。
    // 不必繞變數：這幾行的 inline style 只有顏色與字距，粗細在 class 那層，layout.tsx 的
    // 規則蓋得過去。掛的範圍跟字距那格一樣是三段（選物 / 精選 / 慢讀）。
    const cardMicroWeightVal: "light" | "medium" | "bold" | undefined =
      s?.cardMicroWeight === "light" ||
      s?.cardMicroWeight === "medium" ||
      s?.cardMicroWeight === "bold"
        ? s.cardMicroWeight
        : undefined;
    // 卡片小字用色：上面三格動的是那幾行小字多大、字與字之間空多少、多粗，這格動的是它們
    // 什麼顏色。那四行寫死三種值（選物「看更多」與慢讀分類是主色、慢讀標籤是次要文字色再
    // 乘 0.65、精選「剩 N」是琥珀色 #92400E），商家一格都動不到。跟小標用色（eyebrowTone）、
    // 品名用色（cardTitleTone）、價錢用色（cardPriceTone）同一個處境同一個解法：顏色寫在
    // 那幾行自己的 inline style 上（規則蓋不過 inline），四個位置的 color 都改讀
    // --card-micro-color、fallback 回原本的值，變數在 mergeSectionStyle 算——accent 要走
    // 那裡算好的 sectionAccent，在這裡自己拿 theme.accent 會繞過那道防呆。
    // 掛的範圍跟字距、粗細那兩格一樣是三段（選物 / 精選 / 慢讀）。
    const cardMicroToneVal: "accent" | "muted" | "text" | undefined =
      s?.cardMicroTone === "accent" ||
      s?.cardMicroTone === "muted" ||
      s?.cardMicroTone === "text"
        ? s.cardMicroTone
        : undefined;
    // 卡片小字大小寫：上面四格動的是那幾行小字多大、字距多開、換行後隔多遠、多粗，這格動的
    // 是那幾行字被轉成什麼字形（六處裡五處 class 寫死 uppercase）。跟段落小標那格
    //（eyebrowCase）同一件事的另外幾個位置：中文按了不會動，英文與混排會被整行拉大寫
    //（Shop all → SHOP ALL、「Care 照顧」只有前半被改、好評那行的 IG 帳號也一樣），而改
    // 輸入框的字沒用——轉換發生在畫面上不在資料裡。
    // 不必繞變數：那幾行的 inline style 只有顏色與字距，uppercase 在 class 那層，layout.tsx
    // 的規則蓋得過去（那份 <style> 沒包在 @layer）。掛的範圍跟字級、行距那幾格一樣是掛
    // sproutly-card-micro 的那幾段。
    const cardMicroCaseVal: "capitalize" | "none" | undefined =
      s?.cardMicroCase === "capitalize" || s?.cardMicroCase === "none"
        ? s.cardMicroCase
        : undefined;
    // 卡片價錢字級：上面三格動的是品名、描述、全大寫小字，這格動的是精選商品卡片上那行
    // 價錢（寫死 14px，比品名還小）。同樣是段落上的 inline style 傳不下去，attribute 讓
    // layout.tsx 補規則。只掛精選那一段：卡片上有價錢的只有它。
    const cardPriceScaleVal: "small" | "large" | undefined =
      s?.cardPriceScale === "small" || s?.cardPriceScale === "large"
        ? s.cardPriceScale
        : undefined;
    // 卡片價錢粗細：上一格動的是那行價錢多大，這格動的是它多粗。價錢在字級與深淺兩格都被
    // 補過了，粗細是最後一個沒得動的，也是三個裡最省的——不佔空間、不換顏色就能讓那行字
    // 站出來。這行沒有 inline 的 font-weight（品名那行有，所以那格得繞 CSS variable），
    // attribute 讓 layout.tsx 補一條規則就蓋得過去。同樣只掛精選那一段。
    const cardPriceWeightVal: "medium" | "bold" | undefined =
      s?.cardPriceWeight === "medium" || s?.cardPriceWeight === "bold"
        ? s.cardPriceWeight
        : undefined;
    // 卡片價錢字距：上面兩格動的是那行價錢多大、多粗，這格動的是同一行裡字與字之間隔多遠。
    // 字距在卡片上已經補完品名、描述、小字三組，價錢是最後一行沒得動的——品名字距撐開之後
    // 貼在底下的價錢還是原本的密度；「內文字距」那條規則落在 p / li，價錢這行是 div 也碰
    // 不到。這行的 inline style 只有顏色，字距是繼承來的，attribute 讓 layout.tsx 補一條
    // 規則就蓋得過去。同樣只掛精選那一段：卡片上有價錢的只有它。
    const cardPriceTrackingVal: "tight" | "wide" | undefined =
      s?.cardPriceTracking === "tight" || s?.cardPriceTracking === "wide"
        ? s.cardPriceTracking
        : undefined;
    // 卡片價錢用色：上面兩格動的是那行價錢多大、多粗，這格動的是它什麼顏色。那行寫死
    // --store-text-muted（文字色的七成）、外面還套著卡片那層 opacity 0.7，是整張卡上最淡的
    // 一行，而它偏偏是客人在首頁掃過去在找的東西。跟品名用色（cardTitleTone）同一個處境
    // 同一個解法：顏色寫在那行自己的 inline style 上（規則蓋不過 inline），改讀
    // --card-price-color、fallback 回原本的值，變數在 mergeSectionStyle 算——accent 要走
    // 那裡算好的 sectionAccent，在這裡自己拿 theme.accent 會繞過那道防呆。
    const cardPriceToneVal: "accent" | "text" | undefined =
      s?.cardPriceTone === "accent" || s?.cardPriceTone === "text"
        ? s.cardPriceTone
        : undefined;
    // 卡片行距：上面四格動的是卡片裡每一行「多大」，這格動的是行與行之間「隔多遠」（照片到
    // 品名、品名到描述或價錢、描述到底下那行小字，全是寫死的 mt-*）。同樣是段落上的 inline
    // style 傳不下去，attribute 讓 layout.tsx 補規則。
    // 掛在卡片裡真的有上下多行的三段（選物 / 精選 / 慢讀）：照片牆的卡片裡只有圖，沒有行距。
    const cardRowGapVal: "tight" | "loose" | undefined =
      s?.cardRowGap === "tight" || s?.cardRowGap === "loose"
        ? s.cardRowGap
        : undefined;
    // 卡片副文字深淺：上面那幾格動的是卡片每一行多大、隔多遠，這格動的是品名底下那行次要
    // 文字有多濃（選物副標、精選價錢）。那行的顏色已經是 --store-text-muted，外面還被全站
    // 寫死的 opacity 0.7 再淡一次，乘起來不到五成。同樣是段落上的 inline style 傳不進卡片，
    // attribute 讓 layout.tsx 補規則。
    // 只掛卡片裡真的有這種次要行的兩段（選物 / 精選）：慢讀的摘要跟照片牆的卡片不掛
    // sproutly-card-meta，本來就沒有被多淡那一層。
    const cardMetaToneVal: "muted" | "strong" | undefined =
      s?.cardMetaTone === "muted" || s?.cardMetaTone === "strong"
        ? s.cardMetaTone
        : undefined;
    return {
      bg: s?.bgColor ?? undefined,
      text: s?.textColor ?? undefined,
      align: s?.headingAlign ?? "center",
      padOverride: padVar,
      divider: s?.divider ?? "none",
      dividerWidth,
      dividerToneVal,
      dividerStyleVal,
      headingScaleVal,
      minHeightOverride: minH,
      outlineOverride: outline,
      outlineToneVal,
      outlineStyleVal,
      shadowOverride: shadow,
      borderRadiusOverride: radius,
      fontFamilyOverride: font,
      letterSpacingOverride: letterSpacing,
      lineHeightOverride: lineHeight,
      opacityOverride: opacity,
      filterOverride: filter,
      widthOverride: width,
      gapOverride: gap,
      textureOverride: texture,
      bgGradientOverride: bgGradient,
      entranceVal,
      headingWeightVal,
      headingLeadingVal,
      headingTrackingVal,
      headingRuleVal,
      headingRuleWeightVal,
      headingRuleToneVal,
      headingRuleStyleVal,
      accentBarVal,
      accentBarWidth,
      accentBarToneVal,
      accentBarStyleVal,
      lineHeightVal,
      filterVal,
      bodyAlignVal,
      bodyMeasureVal,
      bodyMeasureMax,
      bodyScaleVal,
      bodyToneVal,
      bodyWeightVal,
      bodyTrackingVal,
      headingToneVal,
      contentAlignVal,
      headingGapVal,
      headingInnerGapVal,
      eyebrowTrackingVal,
      eyebrowScaleVal,
      eyebrowWeightVal,
      eyebrowLeadingVal,
      eyebrowToneVal,
      eyebrowCaseVal,
      hideOnVal,
      mediaRadiusVal,
      mediaAspectVal,
      mediaFocusVal,
      mediaFitVal,
      partnerLogoScaleVal,
      partnerLogoOpacityVal,
      gridGapVal,
      cardHoverVal,
      cardTextVal,
      cardSurfaceVal,
      cardPaddingVal,
      cardLayoutVal,
      cardMediaWidthVal,
      mobileColumnsVal,
      cardTitleLinesVal,
      cardDescLinesVal,
      cardTitleScaleVal,
      cardTitleWeightVal,
      cardTitleLeadingVal,
      cardTitleTrackingVal,
      cardTitleToneVal,
      cardDescScaleVal,
      cardDescLeadingVal,
      cardDescWeightVal,
      cardDescTrackingVal,
      cardDescToneVal,
      cardMicroScaleVal,
      cardMicroTrackingVal,
      cardMicroLeadingVal,
      cardMicroWeightVal,
      cardMicroToneVal,
      cardMicroCaseVal,
      cardPriceScaleVal,
      cardPriceWeightVal,
      cardPriceTrackingVal,
      cardPriceToneVal,
      cardRowGapVal,
      cardMetaToneVal,
    };
    // 這裡本來手抄一份 `as { ... }`（整份欄位再列一次）。它推不出比 TS 自己推更精確的型別，
    // 卻是第三份要跟著欄位表同步改的清單——加控制忘了補就編不過（好），改錯就悄悄放寬（不好）。
    // 直接交給推導，下面 mergeSectionStyle 也改吃 ReturnType，兩邊不可能再漂移。
  };
  type ResolvedSectionStyle = ReturnType<typeof sectionStyleFor>;

  // 把背景色 + 文字色 + padOverride + 分隔線 + 標題字級合併成 section 用的 inline style
  // 自訂 CSS variable 在 TS CSSProperties 預設沒有，所以走 Record<string, unknown> cast
  // 文字色用 color + 覆寫 --store-text / --store-text-muted CSS var
  // 讓 muted 文字（副題 / eyebrow）也跟著走，避免淺底深字 section 突然有深底白字時 muted 還是深的看不見
  // 約定：直接坐在區段底色上的文字，inline color 要寫 var(--store-text)/var(--store-text-muted)
  // 而不是 theme.text/theme.textMuted —— 寫死 theme 值會把這裡的覆寫蓋掉，商家設了文字色沒反應。
  // 例外是有自己底色的容器（promise 卡 / 客人好評卡 / No Image 佔位）：底色不跟區段換，字也維持 theme 值。
  // 標題字級走 data-heading-scale attribute（見上面 headingScaleVal），不從這裡輸出 inline style
  // muted 文字色（副題 / eyebrow）= 自訂文字色加 ~70% 透明。原本只會「字串接 B3」，
  // 那只在文字色剛好是 6 碼 hex 才成立；商家在文字色框打 rgb() / 顏色名 / 3 碼 #abc 時，
  // 接出來是無效 CSS，muted 色靜默失效 —— 在自訂深底上副題就看不見（對比防呆只認 hex，也不會警告）。
  // 6 碼 hex 維持原本輸出（既有店家視覺不變），3 碼補展開，其餘交給 color-mix 算同樣的 70%。
  const mutedFromText = (color: string): string => {
    const c = color.trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) return c + "B3"; // 0xB3 ≈ 70% alpha
    if (/^#[0-9a-f]{3}$/i.test(c)) {
      const [r, g, b] = c.slice(1);
      return `#${r}${r}${g}${g}${b}${b}B3`;
    }
    return `color-mix(in srgb, ${c} 70%, transparent)`;
  };
  const mergeSectionStyle = (
    s: ResolvedSectionStyle,
    fallbackBg?: string
  ): React.CSSProperties | undefined => {
    const out: Record<string, unknown> = {};
    const bg = s.bg ?? fallbackBg;
    if (bg) out.backgroundColor = bg;
    if (s.text) {
      out.color = s.text;
      out["--store-text"] = s.text;
      out["--store-text-muted"] = mutedFromText(s.text); // 加 ~70% alpha 給 muted 用（容任何合法顏色）
    }
    // 內文濃淡：接著上面那條再改一次 --store-text-muted（順序不能反，這一欄就是要蓋過
    // 「文字色算出來的七成」那個預設濃度）。描述、說明、圖說用的都是這個變數，商家挑的是
    // 這些次要文字要多濃，不是整段的顏色（那是「文字顏色」）、也不是整段連照片一起透明
    // （那是「淡化」）——原本這兩個極端中間沒有東西，商品描述在淺底上讀不動就只能整段改色。
    // 濃：直接用該段的文字色，次要文字跟標題一樣深，長描述最好讀（年紀大的客人也看得清）。
    // 淡：55%，比預設的七成再退一階，給只想留個註腳、不要搶戲的段落。
    // 基準色跟著該段的文字色走，沒設才退回全站的——深底淺字的段落選「濃」拿到的是那個
    // 淺字色，不會挑出一個壓在自己底色上看不見的值（同 70c8177 那條線的口徑）。
    if (s.bodyToneVal) {
      const toneBase = s.text ?? theme.text;
      out["--store-text-muted"] =
        s.bodyToneVal === "strong"
          ? toneBase
          : `color-mix(in srgb, ${toneBase} 55%, transparent)`;
    }
    if (s.padOverride !== undefined) out["--store-section-pad"] = String(s.padOverride);
    // 全站主色壓在這一段的自訂底色上還看不看得見。主色是配著全站底色挑的一個要跳出來的
    // 顏色，商家把某一段換成別的底色（做成深底卡片、或換一塊跟主色相近的色塊）時，這一段
    // 裡所有用主色畫的東西——小標 eyebrow、標題底下那截短線、常見問題的＋、數字底下的短
    // 線——會一起淡進底色裡。不是壞掉，是看不見；商家不會知道是哪個設定造成的，只會覺得
    // 這段怪怪的然後把底色改回來，而換底色正是底色／外框／陰影／圓角那批控制要做出來的事。
    // 判斷交給算的（見 lib/color-contrast），不另開「重點色」控制讓商家再挑一次——多一個
    // 要挑的值，挑錯就又回到看不見。低於非文字元素的對比下限才換成該段的文字色（那個色是
    // 配著這段底色挑的，一定看得見）；夠的段落不設變數、一個像素都不動。
    // 只看該段自訂的底色：沒設自訂底色的段落坐的是全站底色，主色本來就是配它挑的。
    let sectionAccent = theme.accent;
    if (s.bg) {
      const ratio = contrastRatio(theme.accent, s.bg);
      if (ratio !== null && ratio < NON_TEXT_CONTRAST_MIN) {
        sectionAccent = s.text ?? theme.text;
        out["--store-accent"] = sectionAccent;
      }
    }
    // 標題用色：每個 h2 的 inline color 都讀 --store-heading-color、fallback 回文字色，
    // 這裡有設值才會生效。accent 用上面算好的 sectionAccent，不直接拿 theme.accent——
    // 商家把這一段換成跟主色相近的底色時，那裡已經把主色換成該段的文字色（配著這段底色
    // 挑的、一定看得見），標題跟小標、短線走同一道防呆，不會單獨淡進底色裡。
    // muted 跟次要文字同一個口徑（文字色的七成），標題退到跟描述同一層，讓照片當主角。
    if (s.headingToneVal) {
      out["--store-heading-color"] =
        s.headingToneVal === "accent"
          ? sectionAccent
          : mutedFromText(s.text ?? theme.text);
    }
    // 小標用色：跟上面那格同一套（每行小標的 inline color 都讀 --store-eyebrow-color、
    // fallback 回它原本那個值，這裡有設值才會生效）。accent 同樣用上面算好的 sectionAccent
    // ——商家把這一段換成跟主色相近的底色時，那裡已經把主色換成該段的文字色，小標跟標題、
    // 短線走同一道防呆，不會單獨淡進底色裡。muted 跟次要文字同一個口徑（文字色的七成），
    // text 是跟內文同深，給那十四段主色小標一個「退回一般文字」的選擇。
    if (s.eyebrowToneVal) {
      out["--store-eyebrow-color"] =
        s.eyebrowToneVal === "accent"
          ? sectionAccent
          : s.eyebrowToneVal === "text"
            ? s.text ?? theme.text
            : mutedFromText(s.text ?? theme.text);
    }
    // 卡片品名用色：跟上面兩格同一套（三段品名的 inline color 都讀 --card-title-color、
    // fallback 回原本的 --store-text，這裡有設值才會生效）。accent 同樣用上面算好的
    // sectionAccent，商家把這一段換成跟主色相近的底色時那裡已經換成該段的文字色，品名跟
    // 標題、小標、短線走同一道防呆，不會單獨淡進底色裡。muted 跟次要文字同一個口徑（文字色
    // 的七成）——選了它品名會跟底下的描述同深，是給「讓照片當主角」那種段落用的。
    if (s.cardTitleToneVal) {
      out["--card-title-color"] =
        s.cardTitleToneVal === "accent"
          ? sectionAccent
          : mutedFromText(s.text ?? theme.text);
    }
    // 卡片價錢用色：跟品名用色同一套（那行的 inline color 讀 --card-price-color、fallback 回
    // 原本的 --store-text-muted，這裡有設值才會生效）。accent 同樣用上面算好的 sectionAccent，
    // 商家把這一段換成跟主色相近的底色時那裡已經換成該段的文字色，價錢跟標題、小標、品名走
    // 同一道防呆。text 是跟品名同深的那個（--store-text 的來源），選了它價錢就不再比品名淡，
    // 是給「客人先看價錢」那種店用的；卡片外面那層 opacity 0.7 不歸這格管（那是「卡片副文字
    // 深淺」那格的事），兩格各自獨立、疊起來也講得通。
    // 卡片小字用色：跟上面那幾格同一套（那四行的 inline color 都讀 --card-micro-color、
    // fallback 回原本的值，這裡有設值才會生效）。accent 同樣用上面算好的 sectionAccent，
    // 商家把這一段換成跟主色相近的底色時那裡已經換成該段的文字色，這幾行跟標題、小標、
    // 品名、價錢走同一道防呆。text 是跟品名同深，給那兩行主色小字（與那行琥珀色的庫存
    // 提示）一個「退回一般文字」的選擇；muted 跟次要文字同一個口徑（文字色的七成）。
    if (s.cardMicroToneVal) {
      out["--card-micro-color"] =
        s.cardMicroToneVal === "accent"
          ? sectionAccent
          : s.cardMicroToneVal === "text"
            ? s.text ?? theme.text
            : mutedFromText(s.text ?? theme.text);
    }
    if (s.cardPriceToneVal) {
      out["--card-price-color"] =
        s.cardPriceToneVal === "accent" ? sectionAccent : s.text ?? theme.text;
    }
    // 卡片描述用色：跟品名用色、價錢用色同一套（那兩段的 inline color 讀 --card-desc-color、
    // fallback 回原本的 --store-text-muted，這裡有設值才會生效）。accent 同樣用上面算好的
    // sectionAccent，商家把這一段換成跟主色相近的底色時那裡已經換成該段的文字色，描述跟
    // 標題、小標、品名、價錢走同一道防呆。text 是跟品名同深的那個（--store-text 的來源），
    // 選了它描述就不再比品名淡，是給慢讀那種「摘要才是主角」的卡片用的；選物那段外面那層
    // opacity 0.7 不歸這格管（那是「卡片副文字深淺」那格的事），兩格各自獨立、疊起來也講得通。
    if (s.cardDescToneVal) {
      out["--card-desc-color"] =
        s.cardDescToneVal === "accent" ? sectionAccent : s.text ?? theme.text;
    }
    if (s.minHeightOverride !== undefined) out.minHeight = s.minHeightOverride;
    // 線的顏色：沒設自訂文字色就照舊用全站 theme.border（既有店家一條線都不會變）。
    // 設了文字色的段落改從那個色算——theme.border 是配著全站底色挑的淺灰，商家把某段做成
    // 深綠底白字的卡片時，那條淺灰線壓在深底上幾乎等於不存在：外框選了「明顯」也看不出來、
    // 分隔線選了上下都有也毫無動靜，看起來就是這兩個控制壞了（跟底紋一樣的毛病，那邊已經
    // 用 currentColor 收掉，這裡還寫死）。不另開一個「線條顏色」控制讓商家自己配——多一個
    // 要挑的值，而且挑錯（挑到跟底色同色）就又是看不見。
    const lineColor = s.text
      ? `color-mix(in srgb, ${s.text} 28%, transparent)`
      : theme.border;
    // 線寬讀「分隔線粗細」那格算好的值（沒設就是原本的 1px）。外框與標題底線各有自己的
    // 粗細來源，三種線刻意不共用一個值——同一段裡商家常常只想讓其中一條變明顯。
    const dividerWidth = s.dividerWidth ?? "1px";
    // 線的深淺讀「分隔線深淺」那格：strong 直接用該段文字色（跟字同深就一定看得見，深底
    // 淺字的段落自動變淺線，商家不用挑色也挑不壞），accent 用上面算好的 sectionAccent
    //（主色壓在自訂底色上看不見時已經換成該段文字色，跟標題用色同一道防呆）。只動分隔線
    // 不動外框與標題底線——商家按這格的意思是「這條要跳出來」，三條一起加深是把對比抹平。
    const dividerColor =
      s.dividerToneVal === "strong"
        ? s.text ?? theme.text
        : s.dividerToneVal === "accent"
          ? sectionAccent
          : lineColor;
    // 線型讀「分隔線線型」那格（沒設就是原本的實線）。虛線與點線是給拿這條線當裝飾的
    // ——實線的語氣是硬斷點，調性軟的店（手作、盆栽）要的是有斷點但不打斷的那種線。
    const dividerStyle = s.dividerStyleVal ?? "solid";
    if (s.divider === "top" || s.divider === "both") {
      out.borderTop = `${dividerWidth} ${dividerStyle} ${dividerColor}`;
    }
    if (s.divider === "bottom" || s.divider === "both") {
      out.borderBottom = `${dividerWidth} ${dividerStyle} ${dividerColor}`;
    }
    if (s.outlineOverride) {
      // 深淺讀「外框深淺」那格，三檔跟分隔線、底線、色條一字不差：strong 用該段文字色
      //（跟字同深就一定看得見，深底淺字自動變淺框）、accent 用算好的 sectionAccent
      //（主色被底色吃掉時已換成該段文字色，同一道防呆）。沒設照舊餵淡色，四條線在
      // 同一段裡還是同一個顏色。
      const outlineColor =
        s.outlineToneVal === "strong"
          ? s.text ?? theme.text
          : s.outlineToneVal === "accent"
            ? sectionAccent
            : lineColor;
      // 線型讀「外框線型」那格（沒設就是原本的實線），跟分隔線、色條同一招：換線型只是
      // 這條字串裡 solid 換個字。虛線配主色就是優惠券那圈「沿線剪下」的框。
      out.outline = `${s.outlineOverride.width} ${s.outlineStyleVal ?? "solid"} ${outlineColor}`;
      out.outlineOffset = s.outlineOverride.offset;
    }
    // 標題底線：線本身在 layout.tsx 的 h2::after 畫，這裡只餵它兩件 CSS 沒辦法自己知道的事。
    // 一是顏色，跟外框／分隔線共用上面同一個 lineColor（自訂文字色算出來的淡色），三種線在
    // 同一段裡才會是同一個顏色。二是左右外距——::after 是 block，父層的 text-align 管不到它，
    // 對齊選了靠右、線還是留在左邊。所以把對齊翻成 margin 的 auto 給 CSS 用。
    if (s.headingRuleVal) {
      // 深淺讀「底線深淺」那格，三檔跟分隔線深淺一字不差：strong 用該段文字色（跟字同深
      // 就一定看得見，深底淺字自動變淺線）、accent 用算好的 sectionAccent（主色被底色吃掉
      // 時已換成該段文字色，同一道防呆）。沒設照舊餵淡色，三種線同一段裡還是同一個顏色。
      out["--store-rule-color"] =
        s.headingRuleToneVal === "strong"
          ? s.text ?? theme.text
          : s.headingRuleToneVal === "accent"
            ? sectionAccent
            : lineColor;
      out["--store-rule-ml"] = s.align === "left" ? "0" : "auto";
      out["--store-rule-mr"] = s.align === "right" ? "0" : "auto";
    }
    // 內文一行字數：寬度本身餵給 layout.tsx 那條規則，另外把「窄欄往哪邊靠」也一起翻成
    // margin 的 auto。收窄之後段落就不再撐滿整欄，靠 text-align 決定不了那個窄框自己站哪裡
    // ——不餵的話一律置中，商家把內文設成靠左（報紙那種標題置中、內文靠左）就會看到一段
    // 靠左的字浮在畫面正中間。跟標題底線那條 ::after 一樣，對齊是 inline text-align，CSS
    // 選擇器讀不到，只能從這裡算好。沒單獨設內文對齊就跟著這一段的標題對齊走。
    if (s.bodyMeasureVal) {
      out["--store-measure-max"] = s.bodyMeasureMax;
      const bodyAlign = s.bodyAlignVal ?? s.align;
      out["--store-measure-ml"] = bodyAlign === "left" ? "0" : "auto";
      out["--store-measure-mr"] = bodyAlign === "right" ? "0" : "auto";
    }
    // 側邊色條：報紙／雜誌標示重點段落（引言、公告）那條粗色條。整段外框太重、分隔線
    // 太輕，中間這一級原本做不出來。畫在 borderLeft / borderRight——分隔線佔的是上下兩邊、
    // 外框走 outline，三個控制同時開也不互相蓋掉。
    // 顏色比照外框與分隔線那條線（70c8177）：該段設了自訂文字色就從它算，深底淺字的段落
    // 自動變成淺色條、不會挑出一個壓在自己底色上看不見的值；沒設就用全站主色 accent
    // ——它本來就是配著全站底色挑來跳出的顏色，一條 4px 的實心條要的正是這種存在感，
    // 用 28% 那條細線的淡色會淡到跟沒開一樣。沒設文字色時用的是上面算過的 sectionAccent
    // 而不是 theme.accent：底色剛好把主色吃掉的那一段，色條跟該段其他主色元素一起換，
    // 不會出現「同一段裡小標換了、色條還是那個看不見的顏色」。
    if (s.accentBarVal) {
      // 粗細讀「色條粗細」那格（2 / 4 / 8px，沒設就是原本的 4px）。
      // 深淺讀「色條深淺」那格：strong 用該段文字色實色（跟分隔線、底線的 strong 同一個
      // 口徑，跟字同深就一定看得見）、accent 用算好的 sectionAccent（主色被底色吃掉時已
      // 換成該段文字色，同一道防呆）、soft 從「原本那個色」取 35%——比文字色那批預設的
      // 六成再退一半，主色那批也淡得下來。沒設照舊走原本那兩種寫死值。
      const barBase = s.text ? `color-mix(in srgb, ${s.text} 60%, transparent)` : sectionAccent;
      const barColor =
        s.accentBarToneVal === "strong"
          ? s.text ?? theme.text
          : s.accentBarToneVal === "accent"
            ? sectionAccent
            : s.accentBarToneVal === "soft"
              ? `color-mix(in srgb, ${s.text ?? sectionAccent} 35%, transparent)`
              : barBase;
      // 線型讀「色條線型」那格（沒設就是原本的實線）。虛線點線是給拿色條當裝飾的——
      // 實心帶再淡還是一塊面，有孔隙的線才真的退得成裝飾；粗檔配點線就是一排圓珠，
      // 那不是 bug，是手作感網站鑲頁緣那種裝飾邊本來的樣子。
      const bar = `${s.accentBarWidth} ${s.accentBarStyleVal ?? "solid"} ${barColor}`;
      if (s.accentBarVal === "left") out.borderLeft = bar;
      else out.borderRight = bar;
    }
    if (s.shadowOverride) {
      out.boxShadow = s.shadowOverride;
    }
    if (s.borderRadiusOverride) {
      out.borderRadius = s.borderRadiusOverride;
    }
    // 字體：除了 section 自己的 fontFamily，還要一起改寫 --store-font。
    // 光設 fontFamily 這個控制等於沒作用——字體是繼承來的，但這一段裡幾乎每個字
    // （eyebrow、h2、描述、卡片標題）都在自己的 inline style 寫死 fontFamily:
    // var(--store-font)，元素自己寫的一律蓋掉繼承值。商家在某段選了「宋體」，
    // 存得進去、重整還在，畫面上一個字都沒變。跟文字色那條同一個毛病、同一個解法
    // （見上面 --store-text 的約定）：覆寫變數，所有讀變數的字自然跟著換。
    // 變數只設在這個 section 上，全站字體與其他段落不受影響。
    if (s.fontFamilyOverride) {
      out.fontFamily = s.fontFamilyOverride;
      out["--store-font"] = s.fontFamilyOverride;
    }
    // 字距：除了 section 自己的 letterSpacing，還要一起餵 --store-track。
    // 光設 letterSpacing 只管得到「沒有自己字距的字」——描述、常見問題答案那種純繼承的
    // 段落會跟著變，但這一段裡最顯眼的字（標題、引言、數字、常見問題的問句）都在自己的
    // inline style 寫死了字距，元素自己寫的一律蓋掉繼承值，而且 inline 的優先度連 CSS
    // 規則都蓋不過（行高那條走 attribute 補規則的招在這裡沒用）。商家把字距調緊或調寬，
    // 會動的只有次要的小字，標題與引言紋風不動。解法比照區段字體那條（693459c）：那些
    // 元素的 inline 值改寫成 var(--store-track, 原本的值)，這裡覆寫變數，讀變數的字自然
    // 跟著換；沒設變數就退回各自原本的值，既有店家一個字都不會動。
    // eyebrow 那種 uppercase 小標的超寬字距（0.3-0.4em）不參與——那是它的樣式標誌，
    // 跟著「寬」變成 0.12em 反而是變窄，跟商家的預期相反。
    if (s.letterSpacingOverride) {
      out.letterSpacing = s.letterSpacingOverride;
      out["--store-track"] = s.letterSpacingOverride;
    }
    // 大標字距：只餵變數、不設 section 自己的 letterSpacing——這格要動的就只有那一行大標，
    // 設在 section 上會連整段繼承的字一起變（那是上面「字距」那格的事）。變數只設在這個
    // section 上，其他段落的大標不受影響；沒設就整個 key 不出現，h2 退回讀 --store-track。
    if (s.headingTrackingVal) {
      out["--store-heading-track"] = s.headingTrackingVal;
    }
    if (s.lineHeightOverride !== undefined) {
      out.lineHeight = s.lineHeightOverride;
    }
    // 淡化：除了 section 自己的 opacity，還要一起餵 --store-section-opacity。
    // 光設 inline opacity 這個控制對幾乎每一間店都是沒作用的——每個區段都掛著進場淡入
    // （全站「動畫」開關預設就是開的），再加上各段自己的「進場動畫」，而動畫的最後一格
    // 寫死 `to { opacity: 1 }` 配 fill both：動畫宣告在階層上壓過 inline style，所以那個
    // 1 會一路蓋著、商家設的 0.85 / 0.7 從頭到尾沒機會出現。商家點得動也存得進去，畫面
    // 就是沒變（要關掉全站動畫才看得到，但沒人會知道要去關那個）。跟區段字體（693459c）、
    // 字距（55ca20c）同一個毛病同一個解法：動畫的收尾值改讀變數，這裡覆寫變數，沒設就
    // 退回 1、既有店家零變化。動畫的起點仍是 0（淡入照舊從全透明開始）。
    if (s.opacityOverride !== undefined) {
      out.opacity = s.opacityOverride;
      out["--store-section-opacity"] = String(s.opacityOverride);
    }
    // 濾鏡：只餵變數，不在 section 上設 filter（見上面 filterToVal 那段——設在 section 上會
    // 把這一段的自訂底色、文字色、主色一起洗掉，而且救不回來）。真正畫的是 layout.tsx 那條
    // 針對 img / video 的規則，開關是下面各 section 的 data-section-filter。
    if (s.filterOverride) {
      out["--store-media-filter"] = s.filterOverride;
    }
    // 區段寬度：限制 maxWidth 並置中，讓 section 變成置中的窄band / 卡片
    if (s.widthOverride) {
      out.maxWidth = s.widthOverride;
      out.marginLeft = "auto";
      out.marginRight = "auto";
    }
    // 區段外距：上下 margin 把 section 從相鄰區段拉開（置中卡片要浮出來靠這個）
    if (s.gapOverride) {
      out.marginTop = s.gapOverride;
      out.marginBottom = s.gapOverride;
    }
    // 底紋與明暗變化都疊在底色之上：backgroundImage 跟 backgroundColor 是兩個屬性，
    // 底色照舊看得到。兩者共用同一個 backgroundImage，所以收成一個 layer 陣列用逗號串
    // ——直接各寫一次會後面那個把前面那個整層蓋掉，變成「兩個控制都點得動、一起用就有
    // 一個沒反應」。backgroundSize 也照同樣順序給，逗號分隔的第 n 個對到第 n 層。
    // 明暗變化排在前面（＝疊在上層），紋路在它底下，看起來才像光打在有紋路的紙上。
    const bgLayers = [s.bgGradientOverride, s.textureOverride].filter(
      (l): l is { backgroundImage: string; backgroundSize: string } => Boolean(l)
    );
    if (bgLayers.length > 0) {
      out.backgroundImage = bgLayers.map((l) => l.backgroundImage).join(", ");
      out.backgroundSize = bgLayers.map((l) => l.backgroundSize).join(", ");
    }
    return Object.keys(out).length > 0 ? (out as React.CSSProperties) : undefined;
  };

  const BASE_URL = siteBaseUrl();

  // @id 是這個店家在整個網站的唯一身分證：首頁、聯絡頁的 Store 和商品頁 offer 的
  // seller 全指同一個 @id，Google 才知道散在各頁的結構化資料講的是「同一間店」，
  // 而不是好幾間同名的不同店。沒有它，每段 Store 都是匿名節點、會被當成獨立實體。
  const storeId = storeSchemaId(BASE_URL, slug);
  // 店家本體 Store 結構化資料走共用 builder，跟聯絡頁同一份（欄位定義與每欄的防呆線
  // 都在 lib/store-schema）。以前首頁與聯絡頁各手拼一份、靠人工維持一致，改一頁忘了
  // 另一頁就兩頁對不上；收成單一來源後不再各抄各的。
  const storeJsonLd = buildStoreJsonLd({
    baseUrl: BASE_URL,
    slug,
    name: store.name,
    description: store.description,
    heroUrl: theme.heroUrl,
    logoUrl: store.logo_url,
    phone: store.contact_phone,
    email: store.contact_email,
    address: store.address,
    socialLinks: [theme.social.instagram, theme.social.facebook, theme.social.line],
    businessHoursText,
  });

  // 以下幾個清過的值，頁面下方「來訪」區段的顯示連結要用（撥號、寫信、地圖）：跟上面
  // 結構化資料走同一份 helper（telDigits／cleanEmail／mapsHref），畫面上能點的連結與
  // 餵 Google 的號碼／位址不會對不上。地址只打空白時 mapsHref 回 null，整段不冒壞連結。
  const storePhone = telDigits(store.contact_phone);
  const storeEmail = cleanEmail(store.contact_email);
  const storeAddress = store.address?.trim();
  const storeMapsHref = mapsHref(store.address);

  // 商家可能留了只填問沒填答、或整列全空白的 FAQ。那種空列在頁面上會變成
  // 點開後沒半句內容的「＋」空格，餵給 Google 也是一筆空的問答。問與答都
  // 去掉前後空白後仍有字才算一列有效，頁面與結構化資料兩邊都只認這些。
  const validFaqItems = theme.layout.faqItems.filter(
    (item) => item.question.trim() !== "" && item.answer.trim() !== "",
  );

  // FAQPage 結構化資料 — 跟頁面上 FAQ 區段同條件才放（區段有開且真的有問答），
  // 讓 Google 搜尋結果能直接展開常見問題，省客人點進來才看到答案的一步。
  // 組成 FAQPage、濾空問空答與 trim 走 store-schema 的 buildFaqJsonLd（跟關於頁同一份）；
  // 「FAQ 區段有沒有開」這個本頁專屬的 gate 留在這裡，沒開就不放。
  const faqJsonLd = theme.layout.sectionOrder.includes("faq")
    ? buildFaqJsonLd(validFaqItems)
    : null;

  // WebSite + SearchAction 給 Google：讓搜尋結果直接附上「這家店的站內搜尋框」
  //（sitelinks search box），客人不用先點進來才找得到搜尋。target 指向商品頁的 ?q=
  // 查詢，跟站內搜尋實際走的路徑完全一致；publisher 指回 storeId 同一個店家身分證，
  // 讓這個網站節點跟首頁／聯絡頁那份 Store 綁成同一間店、不被當成另一個獨立實體。
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/${slug}#website`,
    url: `${BASE_URL}/${slug}`,
    name: store.name,
    publisher: { "@id": storeId },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/${slug}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(storeJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(websiteJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }}
        />
      )}
      <style>{`
        /* 收尾的 opacity 讀 --store-section-opacity（區段「淡化」控制設的，見 mergeSectionStyle）：
           動畫宣告壓過 inline style，寫死 1 會讓淡化在每一間開著動畫的店裡完全沒作用。
           沒設變數就是 1，跟原本一模一樣。 */
        @keyframes sproutly-subtle-fade {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: var(--store-section-opacity, 1); transform: translateY(0); }
        }
        .sproutly-subtle-fade {
          animation: sproutly-subtle-fade 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 40%;
        }
        @keyframes sproutly-hero-fade {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sproutly-hero-fade-1 { animation: sproutly-hero-fade 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both; }
        .sproutly-hero-fade-2 { animation: sproutly-hero-fade 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.8s both; }
        .sproutly-hero-fade-3 { animation: sproutly-hero-fade 1.4s cubic-bezier(0.22, 1, 0.36, 1) 1.3s both; }
        @media (prefers-reduced-motion: reduce) {
          .sproutly-subtle-fade,
          .sproutly-hero-fade-1,
          .sproutly-hero-fade-2,
          .sproutly-hero-fade-3 {
            animation: none !important;
          }
        }
      `}</style>

      <main>
        {/* === Hero（4 種 variant，商家可選） === */}
        {(() => {
          const heroStyle = theme.layout.heroStyle;
          const fade1 = theme.homepage.enableAnimation ? "sproutly-hero-fade-1" : "";
          const fade2 = theme.homepage.enableAnimation ? "sproutly-hero-fade-2" : "";
          const fade3 = theme.homepage.enableAnimation ? "sproutly-hero-fade-3" : "";
          const heroCta =
            theme.homepage.heroCta ?? HOMEPAGE_DEFAULTS.heroCta;
          const heroSecondaryCta =
            theme.homepage.heroSecondaryCta ?? HOMEPAGE_DEFAULTS.heroSecondaryCta;
          const heroMagazineByline =
            theme.homepage.heroMagazineByline ?? `Curated by ${store.name}`;
          // 主標自訂顏色 / 字級（四個版型共用；對齊另計——magazine / minimal
          // 天生置中，套預設值 left 會把現有店家的版型翻掉，只在 full-image 生效）
          const taglineColor = theme.layout.heroTaglineColor ?? theme.text;
          const taglineFontScale = theme.layout.heroTaglineFontScale;
          // 主標粗細（四個版型共用）。以前四處各寫死 fontWeight: 400——全站字最大的那一句
          // 反而是唯一調不動粗細的標題（各段大標的「標題粗細」規則明確排除 hero）。
          // 沒設定的店家算出來就是 400，跟原本一模一樣。
          const taglineWeight =
            theme.layout.heroTaglineWeight === "bold"
              ? 700
              : theme.layout.heroTaglineWeight === "medium"
              ? 500
              : 400;
          // 主標字距（四個版型共用）。四處各寫死一個 letterSpacing（0.02 / -0.01 / -0.02 /
          // -0.015em），那些值是照英文主標調的：負字距對拉丁字母是收緊，對中文方塊字是讓
          // 筆畫互相咬住，而這是全站字級最大的一句。存相對量不是絕對值——收緊 -0.03em、
          // 撐開 +0.05em，加在各版型原本那個數字上，版型之間的手感差異保留，預設不加不減。
          const taglineTrackDelta =
            theme.layout.heroTaglineTracking === "tight"
              ? -0.03
              : theme.layout.heroTaglineTracking === "wide"
              ? 0.05
              : 0;
          // base 是該版型原本寫死的 em 值；加完四捨五入到小數第三位，避免浮點跑出
          // 0.019999999999999997em 這種字串塞進 inline style。
          const taglineTracking = (baseEm: number) =>
            `${Math.round((baseEm + taglineTrackDelta) * 1000) / 1000}em`;
          // 主標行距（四個版型共用）。四處的 class 各寫死一個 leading-[]（1.6 / 1.15 /
          // 1.05 / 1.2），那些數字是照英文主標挑的：拉丁字母有大量上下伸出的筆畫，壓到
          // 1.05 還看得出行的界線；中文是等高方塊字，同樣的值排出來上下兩行幾乎貼在一起。
          // 而中文沒有空格，一句十幾個字的標語在手機上直接斷三行——主標是最容易換行的一句。
          // 跟字距一樣存相對倍率，各版型原本的差異保留；收緊那邊壓到 1.0 就不再往下。
          const taglineLeadingRatio =
            theme.layout.heroTaglineLeading === "tight"
              ? 0.85
              : theme.layout.heroTaglineLeading === "relaxed"
              ? 1.25
              : 1;
          // base 是該版型 class 上原本那個值；倍率是 1 就回 {}，class 的行距原樣留著。
          const taglineLeadingStyle = (base: number) =>
            taglineLeadingRatio !== 1
              ? {
                  lineHeight:
                    Math.round(Math.max(1, base * taglineLeadingRatio) * 1000) / 1000,
                }
              : {};
          // 各版型的預設字級是 Tailwind responsive class，只在 user 動過 slider
          // 時才用 inline clamp 蓋掉（1.0x 完全不覆寫，維持原本斷點行為）；
          // min / vw / max 各版型自己帶，對齊該版型原本 class 的字級範圍。
          const taglineSizeStyle = (minRem: number, vw: number, maxRem: number) =>
            taglineFontScale !== 1
              ? {
                  fontSize: `clamp(${minRem * taglineFontScale}rem, ${vw * taglineFontScale}vw, ${maxRem * taglineFontScale}rem)`,
                }
              : {};
          // Hero eyebrow 小標（四個版型共用）。字級 10px、字距 0.4em（雜誌 0.32em）、
          // 顏色三處 accent 一處 textMuted，四個值全寫死——hero 這組控制裡唯一一格都動不到
          // 的元素，而它是客人由上往下讀到的第一行字。10px 與 0.4em 都是照拉丁大寫字母調的，
          // 套到中文方塊字上是「太小」加「散開」兩件事一起發生。存相對量：沒設定就完全不覆寫。
          const eyebrowScale = theme.layout.heroEyebrowFontScale;
          const eyebrowSizeStyle =
            eyebrowScale !== 1
              ? { fontSize: `${Math.round(10 * eyebrowScale * 10) / 10}px` }
              : {};
          const eyebrowTrackDelta =
            theme.layout.heroEyebrowTracking === "tight"
              ? -0.25
              : theme.layout.heroEyebrowTracking === "wide"
              ? 0.15
              : 0;
          // base 是該版型原本 class 上那個 em 值；加減零就回 {}，class 的字距原樣留著。
          const eyebrowTrackStyle = (baseEm: number) =>
            eyebrowTrackDelta !== 0
              ? {
                  letterSpacing: `${Math.round((baseEm + eyebrowTrackDelta) * 1000) / 1000}em`,
                }
              : {};
          // 沒設就各自 fallback 回原本寫死的那個色（三處主色、雜誌那條 metadata 淡文字色）
          const eyebrowAccentColor = theme.layout.heroEyebrowColor ?? theme.accent;
          const eyebrowMutedColor = theme.layout.heroEyebrowColor ?? theme.textMuted;
          // 小標大小寫。五處 class 一律 uppercase，對中文是空的（方塊字沒有大小寫），
          // 對英文則是把商家打的字改掉：年份字樣、英文店名的大小寫通常是招牌的一部分。
          // inline textTransform 壓得過 class；預設 upper 回 {}，class 原樣留著。
          const eyebrowCaseStyle: { textTransform?: "none" | "capitalize" } =
            theme.layout.heroEyebrowCase === "none"
              ? { textTransform: "none" }
              : theme.layout.heroEyebrowCase === "capitalize"
              ? { textTransform: "capitalize" }
              : {};
          // 副標自訂顏色 / 字級（split / magazine / minimal 共用）
          const subtitleColor =
            theme.layout.heroSubtitleColor ?? theme.textMuted;
          const subtitleScale = theme.layout.heroSubtitleFontScale;
          const subtitleSizeStyle =
            subtitleScale !== 1
              ? {
                  fontSize: `clamp(${0.95 * subtitleScale}rem, ${1.6 * subtitleScale}vw, ${1.125 * subtitleScale}rem)`,
                }
              : {};
          // 副標對齊：inherit = 不覆寫（跟版型預設走），其餘 textAlign 強制
          const subtitleAlign = theme.layout.heroSubtitleAlign;
          const subtitleAlignStyle =
            subtitleAlign !== "inherit"
              ? { textAlign: subtitleAlign as "left" | "center" | "right" }
              : {};
          // 副標粗細 / 字距（五處共用）。這兩個以前沒有人寫過——inline style 只設顏色與
          // 字級，粗細與字距都是繼承來的。各段內文那兩格的規則落在 section 的
          // data-body-weight / data-body-tracking 上，hero 整段不發那兩個 attribute，
          // 所以副標吃不到。沒設就回 {} 完全不覆寫，既有店家算出來一模一樣。
          // 只給 400 / 500 / 700：layout 載進來的就這三個字重，其他的瀏覽器會拿常規去假造，
          // 中文筆畫糊掉（跟主標粗細、卡片那幾格同一個理由）。
          const subtitleWeightStyle =
            theme.layout.heroSubtitleWeight === "bold"
              ? { fontWeight: 700 }
              : theme.layout.heroSubtitleWeight === "medium"
              ? { fontWeight: 500 }
              : {};
          // 副標沒有寫死的 base 字距（繼承 normal），所以這裡存的是絕對值不是相對量——
          // 跟各段內文字距同一組數字（收緊 -0.02em / 撐開 0.06em）。
          const subtitleTrackStyle =
            theme.layout.heroSubtitleTracking === "tight"
              ? { letterSpacing: "-0.02em" }
              : theme.layout.heroSubtitleTracking === "wide"
              ? { letterSpacing: "0.06em" }
              : {};
          // 副標行距（五處共用）。五處 class 一律 leading-[1.9]——那是內文段落的行距，套在
          // 只有兩三行的副標上偏鬆，整段會散開成一塊灰色反而搶主標。各段內文的「行距」走
          // section 的 data-line-height，hero 不發那個 attribute，所以副標一直吃不到。
          // base 只有 1.9 一個值，存絕對值就夠；沒設回 {} 完全不覆寫。
          const subtitleLeadingStyle =
            theme.layout.heroSubtitleLeading === "tight"
              ? { lineHeight: 1.55 }
              : theme.layout.heroSubtitleLeading === "relaxed"
              ? { lineHeight: 2.2 }
              : {};
          // Hero 按鈕（CTA）文字大小。五處的字級寫死成三種值：滿版圖那兩處是 text-sm
          //（0.875rem 的底線連結）、split 兩顆與極簡那顆走 .sproutly-btn-lg（0.875rem，
          // 寫在 layout 的 CSS 裡）、雜誌那條繼承下面 metadata 那行的 10px。那一顆是整個
          // hero 上唯一有動作的東西，卻是視覺順位最後的一行字——主標可以拉到 4rem 以上，
          // 按鈕永遠 0.875rem，再加上 .sproutly-btn 一律 uppercase + 0.18em 字距，
          // 中文的「立即選購」在一顆大按鈕裡看起來又小又散。存 multiplier，1.0x 完全不覆寫。
          const ctaScale = theme.layout.heroCtaFontScale;
          // 滿版圖那兩處的底線連結（base = text-sm 0.875rem）
          const ctaLinkSizeStyle =
            ctaScale !== 1
              ? { fontSize: `${Math.round(0.875 * ctaScale * 1000) / 1000}rem` }
              : {};
          // split 兩顆 + 極簡那顆（base = .sproutly-btn-lg 的 0.875rem / padding 1.125rem
          // 2.25rem）。內距改成 em 跟著字走——1.125 / 0.875 = 1.286em、2.25 / 0.875 =
          // 2.571em，1.0x 算出來就是原本那組 rem。不換成 em 的話字一放大會把兩側留白吃光，
          // 藥丸形變成一顆塞滿字的長方形。
          const ctaBtnSizeStyle =
            ctaScale !== 1
              ? {
                  fontSize: `${Math.round(0.875 * ctaScale * 1000) / 1000}rem`,
                  padding: "1.286em 2.571em",
                }
              : {};
          // 雜誌那條 CTA（base = metadata 那行的 10px）。刻意只套在 CTA 上不套整條
          // metadata——那行左邊的 byline 是另一件事（下一格才輪到它），跟按鈕不是成對的。
          const ctaMicroSizeStyle =
            ctaScale !== 1
              ? { fontSize: `${Math.round(10 * ctaScale * 10) / 10}px` }
              : {};
          // 按鈕字距。字級那格只能讓「立即選購」四個字變大，散開的問題原封不動——0.18em 是
          // 跟著字級等比例放大的，字愈大四個字散得愈開。三處 base 各不相同：滿版圖那兩處
          // tracking-wider（0.05em）、split 與極簡吃 .sproutly-btn（0.18em）、雜誌那條繼承
          // 上層 metadata（0.32em）。存相對量，三處原本的差異保留；沒設回 {} 完全不覆寫。
          const ctaTrackDelta =
            theme.layout.heroCtaTracking === "tight"
              ? -0.12
              : theme.layout.heroCtaTracking === "wide"
              ? 0.1
              : 0;
          // 收緊壓到 0 就不再往下：負字距會讓中文筆畫互相咬住，而按鈕是最該一眼讀完的四個字。
          const ctaTrackStyle = (baseEm: number) =>
            ctaTrackDelta !== 0
              ? {
                  letterSpacing: `${Math.round(Math.max(0, baseEm + ctaTrackDelta) * 1000) / 1000}em`,
                }
              : {};
          // 按鈕大小寫。預設是「照各版型原本」不是「全大寫」——三處的 base 本來就不一致
          //（滿版圖那兩顆是底線連結，根本沒轉大寫），寫死一個 upper 當預設會在商家存檔的
          // 當下把滿版圖那顆一起改掉。inline textTransform 壓得過 class 與繼承來的值。
          const ctaCaseStyle: { textTransform?: "none" | "capitalize" } =
            theme.layout.heroCtaCase === "none"
              ? { textTransform: "none" }
              : theme.layout.heroCtaCase === "capitalize"
              ? { textTransform: "capitalize" }
              : {};
          // 雜誌版型底下那條 byline（hero 最後一個完全沒得動的元素）。字級寫死在外層那條
          // flex 的 text-[10px] 上、顏色寫死 theme.textMuted。10px 跟上面那條 metadata
          // 同一個值，是照拉丁大寫字母挑的；byline 商家常打中文或中英混排，方塊字在 10px
          // 只剩一團墨，而全網站字級那格動不到 class 上寫死的 px。顏色是整個版型最淡的一行，
          // 上面那條 metadata 至少能靠「小標顏色」拉回來，這一行沒有對應的格子。
          // 兩個都只套在 byline 那個 span 上、不套外層那條 flex——右邊的 CTA 已經有自己的
          // 三格（大小 / 字距 / 大小寫），套外層會讓這格連帶動到按鈕。
          const bylineScale = theme.layout.heroBylineFontScale;
          const bylineSizeStyle =
            bylineScale !== 1
              ? { fontSize: `${Math.round(10 * bylineScale * 10) / 10}px` }
              : {};
          const bylineColor = theme.layout.heroBylineColor ?? theme.textMuted;
          // byline 的字距與大小寫。上面兩格動的是那行字多大、什麼顏色，這兩格動的是字與字
          // 之間空多少、字母被轉成什麼字形——byline 那個 span 自己一個樣式都沒有，這兩件事
          // 是從外層那條 flex 繼承來的（tracking-[0.32em] uppercase）。
          // 0.32em 是整站最寬的字距，跟 10px 同一個出處（拉丁大寫字母），byline 打中文
          //（「由 XX 選件」）會散成一個個不相干的字，而字級那格只會讓它散得更開。uppercase
          // 對中文按了不會動，英文則會被整行拉大寫（Photography by Wang → 全大寫），改輸入框
          // 的字沒用——轉換發生在畫面上不在資料裡。
          // 跟字級、顏色同一個判斷：只套 byline 那個 span，不套外層那條 flex（右邊的 CTA
          // 有自己的字距與大小寫兩格）。inline style 壓得過 class 與繼承來的值。
          const bylineTrackDelta =
            theme.layout.heroBylineTracking === "tight"
              ? -0.24
              : theme.layout.heroBylineTracking === "wide"
              ? 0.1
              : 0;
          // base 是繼承來的 0.32em。收緊壓到 0 就不再往下：負字距會讓中文筆畫互相咬住。
          const bylineTrackStyle =
            bylineTrackDelta !== 0
              ? {
                  letterSpacing: `${
                    Math.round(Math.max(0, 0.32 + bylineTrackDelta) * 1000) / 1000
                  }em`,
                }
              : {};
          const bylineCaseStyle: { textTransform?: "none" | "capitalize" } =
            theme.layout.heroBylineCase === "none"
              ? { textTransform: "none" }
              : theme.layout.heroBylineCase === "capitalize"
              ? { textTransform: "capitalize" }
              : {};

          // Variant 1: full-image — 自適應 banner（圖 + 文字段），手機 / 桌機 同一套
          if (heroStyle === "full-image" && theme.heroUrl) {
            // Hero 高度策略
            const heroHeightClass =
              theme.layout.heroHeight === "short"
                ? "min-h-[60vh]"
                : theme.layout.heroHeight === "tall"
                ? "min-h-[80vh]"
                : theme.layout.heroHeight === "full"
                ? "min-h-screen"
                : ""; // auto
            const taglineAlign = theme.layout.heroTaglineAlign;
            return (
              <section
                className={heroHeightClass}
                data-edit-target="hero"
                data-edit-label="Hero 區段"
              >
                {/* 自適應 banner — client 偵測圖片自帶 padding，banner aspect 動態算成
                    剛好框住內容本體的比例，不論手機 / 平板 / 桌機都用同一套：
                    圖以自身比例顯示，不再 h-screen 強制 overlay、不再 transform scale 放大圖片。 */}
                <HeroAdaptiveBanner url={theme.heroUrl} alt={store.name} />
                {(() => {
                  // 主標拖動：data-edit-drag 只綁在 h1，不綁外層整塊。
                  // 拖動座標範圍 = cream block（position:relative wrapper）。
                  const taglinePos = theme.layout.freePositions["hero-tagline"] ?? null;
                  // 副標同款：有自訂位置就走 absolute。主標拖走後副標本來整段藏起來
                  //（跟著 flow 排會疊在 absolute 主標上），副標自己定過位就不用藏。
                  const subtitlePos =
                    theme.layout.freePositions[FREE_POS_KEYS.heroSubtitle] ?? null;
                  // CTA 按鈕同款：定過位走 absolute，沒定位維持「主標拖走就跟著藏」。
                  const ctaPos =
                    theme.layout.freePositions[FREE_POS_KEYS.heroCta] ?? null;
                  // Eyebrow 小標同款：定過位走 absolute，不再被主標連坐藏掉。
                  const eyebrowPos =
                    theme.layout.freePositions[FREE_POS_KEYS.heroEyebrow] ?? null;
                  return (
                <div
                  className="relative px-6 sm:px-12 py-14 sm:py-20"
                  style={{ backgroundColor: theme.bg, minHeight: taglinePos || subtitlePos || ctaPos || eyebrowPos ? "300px" : undefined }}
                  data-edit-target="hero-text-area"
                >
                  <div
                    className={taglinePos ? "" : "max-w-4xl mx-auto"}
                    style={{ textAlign: taglineAlign }}
                  >
                    {/* Eyebrow 小標：其他三版型都有渲染，full-image 一直漏掉。
                        跟副標 / CTA 同邏輯：定過位走 absolute（不再被主標連坐藏），
                        沒定位維持 flow、主標拖走就跟著藏（flow 內容會疊到 absolute 主標）。 */}
                    {eyebrowPos && theme.layout.heroEyebrow ? (
                      <p
                        data-edit-text
                        data-edit-field="heroEyebrow"
                        data-edit-drag={FREE_POS_KEYS.heroEyebrow}
                        className={`text-[10px] tracking-[0.4em] uppercase ${fade1}`}
                        style={{
                          position: "absolute",
                          left: `${eyebrowPos.x * 100}%`,
                          top: `${eyebrowPos.y * 100}%`,
                          transform: "translate(-50%, -50%)",
                          maxWidth: "min(24rem, 90%)",
                          color: eyebrowAccentColor,
                          ...eyebrowSizeStyle,
                          ...eyebrowTrackStyle(0.4),
                          ...eyebrowCaseStyle,
                        }}
                      >
                        {theme.layout.heroEyebrow}
                      </p>
                    ) : !taglinePos && theme.layout.heroEyebrow ? (
                      <p
                        data-edit-text
                        data-edit-field="heroEyebrow"
                        data-edit-drag={FREE_POS_KEYS.heroEyebrow}
                        className={`text-[10px] tracking-[0.4em] uppercase mb-6 ${fade1}`}
                        style={{
                          color: eyebrowAccentColor,
                          ...eyebrowSizeStyle,
                          ...eyebrowTrackStyle(0.4),
                          ...eyebrowCaseStyle,
                        }}
                      >
                        {theme.layout.heroEyebrow}
                      </p>
                    ) : null}
                    <h1
                      className={`leading-[1.6] ${fade1}`}
                      style={
                        taglinePos
                          ? {
                              position: "absolute",
                              left: `${taglinePos.x * 100}%`,
                              top: `${taglinePos.y * 100}%`,
                              transform: "translate(-50%, -50%)",
                              maxWidth: "min(800px, 90%)",
                              color: taglineColor,
                              fontFamily: "var(--store-font)",
                              fontWeight: taglineWeight,
                              letterSpacing: taglineTracking(0.02),
                              wordBreak: "keep-all",
                              overflowWrap: "break-word",
                              fontSize: `clamp(${1.5 * taglineFontScale}rem, ${3 * taglineFontScale}vw, ${3 * taglineFontScale}rem)`,
                              ...taglineLeadingStyle(1.6),
                            }
                          : {
                              color: taglineColor,
                              fontFamily: "var(--store-font)",
                              fontWeight: taglineWeight,
                              letterSpacing: taglineTracking(0.02),
                              wordBreak: "keep-all",
                              overflowWrap: "break-word",
                              fontSize: `clamp(${1.5 * taglineFontScale}rem, ${3 * taglineFontScale}vw, ${3 * taglineFontScale}rem)`,
                              ...taglineLeadingStyle(1.6),
                            }
                      }
                      data-edit-text
                      data-edit-field="tagline"
                      data-edit-drag="hero-tagline"
                    >
                      {taglineLines.map((line, i) => (
                        <span key={i} className="block">
                          {line}
                        </span>
                      ))}
                    </h1>
                    {(subtitlePos || !taglinePos) && theme.layout.heroSubtitle && (() => {
                      // 拖過版位 → absolute（座標系跟主標一樣是 cream block）
                      if (subtitlePos) {
                        return (
                          <p
                            data-edit-text
                            data-edit-field="heroSubtitle"
                            data-edit-drag={FREE_POS_KEYS.heroSubtitle}
                            className={`text-base sm:text-lg leading-[1.9] ${fade2}`}
                            style={{
                              position: "absolute",
                              left: `${subtitlePos.x * 100}%`,
                              top: `${subtitlePos.y * 100}%`,
                              transform: "translate(-50%, -50%)",
                              maxWidth: "min(32rem, 90%)",
                              color: subtitleColor,
                              fontFamily: "var(--store-font)",
                              ...subtitleSizeStyle,
                              ...subtitleAlignStyle,
                              ...subtitleWeightStyle,
                              ...subtitleTrackStyle,
                              ...subtitleLeadingStyle,
                            }}
                          >
                            {theme.layout.heroSubtitle}
                          </p>
                        );
                      }
                      // 副標對齊預設跟主標走（inherit），block 寬度限縮後靠 margin
                      // 把整段推到對應邊，避免置中主標卻配一段靠左的副標。
                      const effAlign =
                        subtitleAlign !== "inherit" ? subtitleAlign : taglineAlign;
                      const blockAlign =
                        effAlign === "center"
                          ? { marginLeft: "auto", marginRight: "auto" }
                          : effAlign === "right"
                          ? { marginLeft: "auto" }
                          : {};
                      return (
                        <p
                          data-edit-text
                          data-edit-field="heroSubtitle"
                          data-edit-drag={FREE_POS_KEYS.heroSubtitle}
                          className={`mt-5 text-base sm:text-lg leading-[1.9] ${fade2}`}
                          style={{
                            color: subtitleColor,
                            fontFamily: "var(--store-font)",
                            maxWidth: "32rem",
                            ...blockAlign,
                            ...subtitleSizeStyle,
                            ...subtitleAlignStyle,
                            ...subtitleWeightStyle,
                            ...subtitleTrackStyle,
                            ...subtitleLeadingStyle,
                          }}
                        >
                          {theme.layout.heroSubtitle}
                        </p>
                      );
                    })()}
                    {ctaPos ? (
                      // 拖過版位 → absolute（座標系跟主標 / 副標一樣是 cream block），
                      // 定過位就不再被主標連坐藏掉。
                      <Link
                        href={`/${slug}/shop`}
                        className={`sproutly-link inline-block text-sm tracking-wider ${theme.layout.heroSubtitle ? fade3 : fade2}`}
                        data-default-line="true"
                        data-edit-text
                        data-edit-field="heroCta"
                        data-edit-drag={FREE_POS_KEYS.heroCta}
                        style={{
                          position: "absolute",
                          left: `${ctaPos.x * 100}%`,
                          top: `${ctaPos.y * 100}%`,
                          transform: "translate(-50%, -50%)",
                          maxWidth: "min(24rem, 90%)",
                          color: theme.text,
                          fontFamily: "var(--store-font)",
                          ...ctaLinkSizeStyle,
                          ...ctaTrackStyle(0.05),
                          ...ctaCaseStyle,
                        }}
                      >
                        {heroCta}
                      </Link>
                    ) : !taglinePos && (
                      <Link
                        href={`/${slug}/shop`}
                        className={`sproutly-link mt-8 inline-block text-sm tracking-wider ${theme.layout.heroSubtitle ? fade3 : fade2}`}
                        data-default-line="true"
                        data-edit-text
                        data-edit-field="heroCta"
                        data-edit-drag={FREE_POS_KEYS.heroCta}
                        style={{
                          color: theme.text,
                          fontFamily: "var(--store-font)",
                          ...ctaLinkSizeStyle,
                          ...ctaTrackStyle(0.05),
                          ...ctaCaseStyle,
                        }}
                      >
                        {heroCta}
                      </Link>
                    )}
                  </div>
                </div>
                  );
                })()}
              </section>
            );
          }

          // Variant 2: split — 左/右 50:50（圖 + 文字）
          if (heroStyle === "split" && theme.heroUrl) {
            const imageOnRight = theme.layout.heroImageSide === "right";
            return (
              <section
                className="relative grid grid-cols-1 md:grid-cols-2 min-h-[80vh] md:min-h-screen overflow-hidden"
                style={{ background: theme.bg }}
                data-edit-target="hero"
                data-edit-label="Hero 區段"
              >
                <div
                  className={`relative aspect-square md:aspect-auto md:h-full ${imageOnRight ? "md:order-2" : ""}`}
                >
                  <Image
                    src={theme.heroUrl}
                    alt={store.name}
                    fill
                    priority
                    sizes="(min-width: 768px) 50vw, 100vw"
                    quality={85}
                    className="object-cover"
                  />
                </div>
                <div
                  className={`flex flex-col justify-center px-8 sm:px-12 md:px-16 lg:px-24 py-20 md:py-0 ${imageOnRight ? "md:order-1" : ""}`}
                >
                  {theme.layout.heroEyebrow && (
                    <p
                      data-edit-text
                      data-edit-field="heroEyebrow"
                      className={`text-[10px] tracking-[0.4em] uppercase mb-6 ${fade1}`}
                      style={{
                        color: eyebrowAccentColor,
                        ...eyebrowSizeStyle,
                        ...eyebrowTrackStyle(0.4),
                        ...eyebrowCaseStyle,
                      }}
                    >
                      {theme.layout.heroEyebrow}
                    </p>
                  )}
                  <h1
                    className={`text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-[1.15] ${fade1}`}
                    style={{
                      color: taglineColor,
                      fontFamily: "var(--store-font)",
                      fontWeight: taglineWeight,
                      letterSpacing: taglineTracking(-0.01),
                      wordBreak: "keep-all",
                      overflowWrap: "break-word",
                      ...taglineSizeStyle(1.875, 5, 3.75),
                      ...taglineLeadingStyle(1.15),
                    }}
                    data-edit-text
                    data-edit-field="tagline"
                  >
                    {taglineLines.map((line, i) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </h1>
                  {theme.layout.heroSubtitle && (
                    <p
                      data-edit-text
                      data-edit-field="heroSubtitle"
                      className={`mt-6 text-base sm:text-lg leading-[1.9] max-w-md ${fade2}`}
                      style={{
                        color: subtitleColor,
                        ...subtitleSizeStyle,
                        ...subtitleAlignStyle,
                        ...subtitleWeightStyle,
                        ...subtitleTrackStyle,
                        ...subtitleLeadingStyle,
                      }}
                    >
                      {theme.layout.heroSubtitle}
                    </p>
                  )}
                  <div className={`mt-10 flex gap-5 ${fade3}`}>
                    <Link
                      href={`/${slug}/shop`}
                      className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
                      data-edit-text
                      data-edit-field="heroCta"
                      style={{ ...ctaBtnSizeStyle, ...ctaTrackStyle(0.18), ...ctaCaseStyle }}
                    >
                      {heroCta}
                    </Link>
                    {theme.sections.about && (
                      <Link
                        href={`/${slug}/about`}
                        className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg"
                        data-edit-text
                        data-edit-field="heroSecondaryCta"
                        style={{ ...ctaBtnSizeStyle, ...ctaTrackStyle(0.18), ...ctaCaseStyle }}
                      >
                        {heroSecondaryCta}
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            );
          }

          // Variant 3: magazine — 雜誌封面風（上 metadata、中央大字、下 byline）
          if (heroStyle === "magazine") {
            return (
              <section
                className="relative min-h-screen flex flex-col justify-between py-20 sm:py-28"
                style={{ background: theme.bg }}
                data-edit-target="hero"
                data-edit-label="Hero 區段"
              >
                {/* 上方 metadata 條。小標三格套在外層這條 metadata 上、不是只套小標那個
                    span：這一行左右兩端（小標與店名）在雜誌版型裡是成對的，只動一邊會變成
                    一大一小。 */}
                <div className="max-w-6xl mx-auto px-8 sm:px-12 w-full">
                  <div
                    className={`flex justify-between items-center text-[10px] tracking-[0.32em] uppercase ${fade1}`}
                    style={{
                      color: eyebrowMutedColor,
                      ...eyebrowSizeStyle,
                      ...eyebrowTrackStyle(0.32),
                      ...eyebrowCaseStyle,
                    }}
                  >
                    <span data-edit-text data-edit-field="heroEyebrow">
                      {theme.layout.heroEyebrow || "Issue"}
                    </span>
                    <span>{store.name}</span>
                  </div>
                  <div
                    className="mt-4 h-px w-full"
                    style={{ background: theme.border }}
                  />
                </div>

                {/* 中央大字 */}
                <div className="max-w-5xl mx-auto px-8 sm:px-12 text-center w-full">
                  <h1
                    className={`text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05] ${fade1}`}
                    style={{
                      color: taglineColor,
                      fontFamily: "var(--store-font)",
                      fontWeight: taglineWeight,
                      letterSpacing: taglineTracking(-0.02),
                      wordBreak: "keep-all",
                      overflowWrap: "break-word",
                      ...taglineSizeStyle(2.25, 8, 6),
                      ...taglineLeadingStyle(1.05),
                    }}
                    data-edit-text
                    data-edit-field="tagline"
                  >
                    {taglineLines.map((line, i) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </h1>
                  {theme.layout.heroSubtitle && (
                    <p
                      data-edit-text
                      data-edit-field="heroSubtitle"
                      className={`mt-8 text-base sm:text-lg italic max-w-xl mx-auto leading-[1.9] ${fade2}`}
                      style={{
                        color: subtitleColor,
                        ...subtitleSizeStyle,
                        ...subtitleAlignStyle,
                        ...subtitleWeightStyle,
                        ...subtitleTrackStyle,
                        ...subtitleLeadingStyle,
                      }}
                    >
                      {theme.layout.heroSubtitle}
                    </p>
                  )}
                </div>

                {/* 下方 byline + CTA */}
                <div className="max-w-6xl mx-auto px-8 sm:px-12 w-full">
                  <div
                    className="h-px w-full mb-4"
                    style={{ background: theme.border }}
                  />
                  <div
                    className={`flex justify-between items-center text-[10px] tracking-[0.32em] uppercase ${fade3}`}
                    style={{ color: theme.textMuted }}
                  >
                    <span
                      data-edit-text
                      data-edit-field="heroMagazineByline"
                      style={{
                        color: bylineColor,
                        ...bylineSizeStyle,
                        ...bylineTrackStyle,
                        ...bylineCaseStyle,
                      }}
                    >
                      {heroMagazineByline}
                    </span>
                    <Link
                      href={`/${slug}/shop`}
                      className="sproutly-link"
                      data-default-line="true"
                      style={{
                        color: theme.text,
                        ...ctaMicroSizeStyle,
                        // base 是上層 metadata 那條的 0.32em。刻意只套在 CTA 上不套整條——
                        // 左邊的 byline 跟按鈕不是成對的（跟字級那格同一個理由）。
                        ...ctaTrackStyle(0.32),
                        ...ctaCaseStyle,
                      }}
                    >
                      {/* 箭頭留在可編輯範圍外，雙擊改到的只有文字本體 */}
                      <span data-edit-text data-edit-field="heroCta">
                        {heroCta}
                      </span>{" "}
                      →
                    </Link>
                  </div>
                </div>
              </section>
            );
          }

          // Variant 4: minimal（無圖純文字大字 hero）+ 既有 full-image 但無 heroUrl 的 fallback
          return (
            <section
              className="max-w-3xl mx-auto px-6 py-40 sm:py-56 text-center"
              style={{ background: theme.bg }}
              data-edit-target="hero"
              data-edit-label="Hero 區段"
            >
              {theme.layout.heroEyebrow && (
                <p
                  data-edit-text
                  data-edit-field="heroEyebrow"
                  className={`text-[10px] tracking-[0.4em] uppercase mb-8 ${fade1}`}
                  style={{
                    color: eyebrowAccentColor,
                    ...eyebrowSizeStyle,
                    ...eyebrowTrackStyle(0.4),
                    ...eyebrowCaseStyle,
                  }}
                >
                  {theme.layout.heroEyebrow}
                </p>
              )}
              <h1
                className={`text-3xl sm:text-5xl md:text-6xl leading-[1.2] ${fade1}`}
                style={{
                  color: taglineColor,
                  fontFamily: "var(--store-font)",
                  fontWeight: taglineWeight,
                  letterSpacing: taglineTracking(-0.015),
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                  ...taglineSizeStyle(1.875, 6, 3.75),
                  ...taglineLeadingStyle(1.2),
                }}
                data-edit-text
                data-edit-field="tagline"
              >
                {taglineLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h1>
              {theme.layout.heroSubtitle && (
                <p
                  data-edit-text
                  data-edit-field="heroSubtitle"
                  className={`mt-8 text-base sm:text-lg max-w-xl mx-auto leading-[1.9] ${fade2}`}
                  style={{
                    color: subtitleColor,
                    ...subtitleSizeStyle,
                    ...subtitleAlignStyle,
                    ...subtitleWeightStyle,
                    ...subtitleTrackStyle,
                    ...subtitleLeadingStyle,
                  }}
                >
                  {theme.layout.heroSubtitle}
                </p>
              )}
              <div
                className={`mx-auto mt-10 ${fade2}`}
                style={{
                  width: "48px",
                  height: "1px",
                  background: theme.accent,
                  opacity: 0.5,
                }}
              />
              <Link
                href={`/${slug}/shop`}
                className={`sproutly-btn sproutly-btn-primary sproutly-btn-lg mt-12 ${fade3}`}
                data-edit-text
                data-edit-field="heroCta"
                style={{ ...ctaBtnSizeStyle, ...ctaTrackStyle(0.18), ...ctaCaseStyle }}
              >
                {heroCta}
              </Link>
            </section>
          );
        })()}

        {/* === 選物提案 === */}
        {visibleCollections.length > 0 && (() => {
          // key 換代重開（舊 DB 殘留座標掛在舊 key 下自動失效，見 lib/free-positions）
          const introPos = theme.layout.freePositions[FREE_POS_KEYS.collectionIntro] ?? null;
          const introFree = introPos !== null;
          const collStyle = sectionStyleFor("collections");
          const collectionsCardCta =
            theme.homepage.collectionsCardCta ?? HOMEPAGE_DEFAULTS.collectionsCardCta;
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${introFree ? "min-h-[60vh]" : ""}`}
            data-edit-target="collections"
            data-edit-label="選物提案"
            data-anim={collStyle.entranceVal}
            data-heading-scale={collStyle.headingScaleVal}
            data-heading-weight={collStyle.headingWeightVal}
            data-heading-leading={collStyle.headingLeadingVal}
            data-heading-rule={collStyle.headingRuleVal}
            data-heading-rule-weight={collStyle.headingRuleWeightVal}
            data-heading-rule-style={collStyle.headingRuleStyleVal}
            data-eyebrow-tracking={collStyle.eyebrowTrackingVal}
            data-eyebrow-scale={collStyle.eyebrowScaleVal}
            data-eyebrow-weight={collStyle.eyebrowWeightVal}
            data-eyebrow-leading={collStyle.eyebrowLeadingVal}
            data-eyebrow-case={collStyle.eyebrowCaseVal}
            data-heading-gap={collStyle.headingGapVal}
              data-heading-inner={collStyle.headingInnerGapVal}
            data-line-height={collStyle.lineHeightVal}
            data-section-filter={collStyle.filterVal}
            data-body-align={collStyle.bodyAlignVal}
            data-body-measure={collStyle.bodyMeasureVal}
            data-body-scale={collStyle.bodyScaleVal}
            data-body-weight={collStyle.bodyWeightVal}
            data-body-tracking={collStyle.bodyTrackingVal}
            data-content-align={collStyle.contentAlignVal}
            data-hide-on={collStyle.hideOnVal}
            data-media-radius={collStyle.mediaRadiusVal}
            data-media-aspect={collStyle.mediaAspectVal}
            data-media-focus={collStyle.mediaFocusVal}
            data-media-fit={collStyle.mediaFitVal}
            data-grid-gap={collStyle.gridGapVal}
            data-mobile-cols={collStyle.mobileColumnsVal}
            data-card-hover={collStyle.cardHoverVal}
            data-card-text={collStyle.cardTextVal}
            data-card-surface={collStyle.cardSurfaceVal}
            data-card-padding={collStyle.cardPaddingVal}
            data-card-layout={collStyle.cardLayoutVal}
            data-card-media-width={collStyle.cardMediaWidthVal}
            data-card-title-lines={collStyle.cardTitleLinesVal}
            data-card-desc-lines={collStyle.cardDescLinesVal}
            data-card-title-scale={collStyle.cardTitleScaleVal}
            data-card-title-weight={collStyle.cardTitleWeightVal}
            data-card-title-leading={collStyle.cardTitleLeadingVal}
            data-card-title-tracking={collStyle.cardTitleTrackingVal}
            data-card-desc-scale={collStyle.cardDescScaleVal}
            data-card-desc-leading={collStyle.cardDescLeadingVal}
            data-card-desc-weight={collStyle.cardDescWeightVal}
            data-card-desc-tracking={collStyle.cardDescTrackingVal}
            data-card-micro-scale={collStyle.cardMicroScaleVal}
            data-card-micro-tracking={collStyle.cardMicroTrackingVal}
            data-card-micro-leading={collStyle.cardMicroLeadingVal}
            data-card-micro-weight={collStyle.cardMicroWeightVal}
            data-card-micro-case={collStyle.cardMicroCaseVal}
            data-card-row-gap={collStyle.cardRowGapVal}
            data-card-meta-tone={collStyle.cardMetaToneVal}
            style={mergeSectionStyle(collStyle)}
          >
            <div className="max-w-5xl mx-auto px-8 sm:px-12" style={{ textAlign: collStyle.align }}>
              {introFree ? (
                <h2
                  data-edit-text
                  data-edit-field="collectionsIntro"
                  data-edit-drag={FREE_POS_KEYS.collectionIntro}
                  className="absolute text-xl sm:text-2xl leading-[1.9]"
                  style={{
                    left: `${introPos!.x * 100}%`,
                    top: `${introPos!.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    maxWidth: "min(560px, 80vw)",
                    width: "100%",
                    color: "var(--store-heading-color, var(--store-text))",
                    fontFamily: "var(--store-font)",
                    letterSpacing: "var(--store-heading-track, inherit)",
                    // 十五個段落大標的字重與行距原本都寫死在這裡（多數 400、數字那段 500、
                    // 行距 1.2），而「標題粗細」「標題行距」兩格是 layout.tsx 的規則——inline
                    // 一律贏過規則，兩格按下去畫面不動。改讀變數、fallback 回原本的值（沒設
                    // 等於原樣），變數在那兩組規則裡跟 font-weight / line-height 一起寫出來，
                    // 跟卡片品名、內文粗細那幾格同一個作法。
                    fontWeight: "var(--heading-weight, 400)",
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {introLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </h2>
              ) : (
                <>
                  {collectionsEyebrow && (
                    <p
                      data-edit-text
                      data-edit-field="collectionsEyebrow"
                      className="sproutly-section-eyebrow text-[0.6875rem] tracking-[0.4em] uppercase mb-4"
                      style={{
                        color: eyebrowColor,
                        fontFamily: "var(--store-font)",
                        // 粗細讀 --eyebrow-weight（小標粗細那格由 layout.tsx 的規則設）：
                        // 這行的 500 寫在 inline style 上，CSS 規則壓不過，只能繞變數。
                        // 沒設時變數不存在、fallback 回原本的 500。
                        fontWeight: "var(--eyebrow-weight, 500)",
                      }}
                    >
                      {collectionsEyebrow}
                    </p>
                  )}
                <h2
                  data-edit-text
                  data-edit-field="collectionsIntro"
                  data-edit-drag={FREE_POS_KEYS.collectionIntro}
                  className={`sproutly-section-head text-xl sm:text-2xl max-w-xl ${collStyle.align === "center" ? "mx-auto" : collStyle.align === "right" ? "ml-auto" : ""} mb-32 leading-[1.9]`}
                  style={{
                    color: "var(--store-heading-color, var(--store-text))",
                    fontFamily: "var(--store-font)",
                    letterSpacing: "var(--store-heading-track, inherit)",
                    fontWeight: "var(--heading-weight, 400)",
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {introLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </h2>
                </>
              )}

              <div className={`sproutly-card-grid sproutly-stagger grid grid-cols-2 gap-x-6 sm:gap-x-12 gap-y-20 sm:gap-y-24 ${
                theme.layout.collectionsColumns === 2 ? "sm:grid-cols-2"
                : theme.layout.collectionsColumns === 4 ? "sm:grid-cols-4"
                : "sm:grid-cols-3"
              }`}>
                {visibleCollections.map((c) => (
                  <Link
                    key={c.key}
                    href={`/${slug}/shop`}
                    className="sproutly-card"
                  >
                    <div className="sproutly-card-image aspect-[3/4] relative">
                      <Image
                        src={c.image}
                        alt={c.title}
                        fill
                        sizes="(min-width: 640px) 600px, 50vw"
                        quality={80}
                        loading="lazy"
                        className="object-cover"
                      />
                    </div>
                    <h3
                      data-edit-text
                      data-edit-field="collectionCardTitle"
                      data-edit-index={c.index}
                      className="sproutly-card-title mt-6 text-lg sm:text-xl"
                      style={{
                        color: "var(--card-title-color, var(--store-text))",
                        fontFamily: "var(--store-font)",
                        fontWeight: "var(--card-title-weight, 400)",
                      }}
                    >
                      {c.title}
                    </h3>
                    {c.subtitle && (
                      <p
                        data-edit-text
                        data-edit-field="collectionCardSubtitle"
                        data-edit-index={c.index}
                        className="sproutly-card-meta sproutly-card-desc mt-1 text-sm"
                        style={{
                          color:
                            "var(--card-desc-color, var(--store-text-muted))",
                        }}
                      >
                        {c.subtitle}
                      </p>
                    )}
                    <span
                      data-edit-text
                      data-edit-field="collectionsCardCta"
                      className="sproutly-card-action sproutly-card-micro inline-block text-[10px] tracking-[0.3em] uppercase"
                      style={{ color: cardMicroColor }}
                    >
                      {collectionsCardCta}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
          );
        })()}

        {/* === 本月選物 === */}
        {featuredProducts && featuredProducts.length > 0 && (() => {
          const featuredPos = theme.layout.freePositions[FREE_POS_KEYS.featuredTitle] ?? null;
          const featuredFree = featuredPos !== null;
          const featuredStyle = sectionStyleFor("featured");
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${featuredFree ? "min-h-[60vh]" : ""}`}
            style={mergeSectionStyle(featuredStyle, theme.surface)}
            data-edit-target="featured"
            data-edit-label="本月選物"
            data-anim={featuredStyle.entranceVal}
            data-heading-scale={featuredStyle.headingScaleVal}
            data-heading-weight={featuredStyle.headingWeightVal}
            data-heading-leading={featuredStyle.headingLeadingVal}
            data-heading-rule={featuredStyle.headingRuleVal}
            data-heading-rule-weight={featuredStyle.headingRuleWeightVal}
            data-heading-rule-style={featuredStyle.headingRuleStyleVal}
            data-eyebrow-tracking={featuredStyle.eyebrowTrackingVal}
            data-eyebrow-scale={featuredStyle.eyebrowScaleVal}
            data-eyebrow-weight={featuredStyle.eyebrowWeightVal}
            data-eyebrow-leading={featuredStyle.eyebrowLeadingVal}
            data-eyebrow-case={featuredStyle.eyebrowCaseVal}
            data-heading-gap={featuredStyle.headingGapVal}
              data-heading-inner={featuredStyle.headingInnerGapVal}
            data-line-height={featuredStyle.lineHeightVal}
            data-section-filter={featuredStyle.filterVal}
            data-body-align={featuredStyle.bodyAlignVal}
            data-body-measure={featuredStyle.bodyMeasureVal}
            data-body-scale={featuredStyle.bodyScaleVal}
            data-body-weight={featuredStyle.bodyWeightVal}
            data-body-tracking={featuredStyle.bodyTrackingVal}
            data-content-align={featuredStyle.contentAlignVal}
            data-hide-on={featuredStyle.hideOnVal}
            data-media-radius={featuredStyle.mediaRadiusVal}
            data-media-aspect={featuredStyle.mediaAspectVal}
            data-media-focus={featuredStyle.mediaFocusVal}
            data-media-fit={featuredStyle.mediaFitVal}
            data-grid-gap={featuredStyle.gridGapVal}
            data-mobile-cols={featuredStyle.mobileColumnsVal}
            data-card-hover={featuredStyle.cardHoverVal}
            data-card-text={featuredStyle.cardTextVal}
            data-card-surface={featuredStyle.cardSurfaceVal}
            data-card-padding={featuredStyle.cardPaddingVal}
            data-card-layout={featuredStyle.cardLayoutVal}
            data-card-media-width={featuredStyle.cardMediaWidthVal}
            data-card-title-lines={featuredStyle.cardTitleLinesVal}
            data-card-title-scale={featuredStyle.cardTitleScaleVal}
            data-card-title-weight={featuredStyle.cardTitleWeightVal}
            data-card-title-leading={featuredStyle.cardTitleLeadingVal}
            data-card-title-tracking={featuredStyle.cardTitleTrackingVal}
            data-card-price-scale={featuredStyle.cardPriceScaleVal}
            data-card-price-weight={featuredStyle.cardPriceWeightVal}
            data-card-price-tracking={featuredStyle.cardPriceTrackingVal}
            data-card-row-gap={featuredStyle.cardRowGapVal}
            data-card-micro-scale={featuredStyle.cardMicroScaleVal}
            data-card-micro-tracking={featuredStyle.cardMicroTrackingVal}
            data-card-micro-leading={featuredStyle.cardMicroLeadingVal}
            data-card-micro-weight={featuredStyle.cardMicroWeightVal}
            data-card-micro-case={featuredStyle.cardMicroCaseVal}
            data-card-meta-tone={featuredStyle.cardMetaToneVal}
          >
            <div className="max-w-5xl mx-auto px-8 sm:px-12" style={{ textAlign: featuredStyle.align }}>
              {featuredFree ? (
                <h2
                  data-edit-text
                  data-edit-field="featuredTitle"
                  data-edit-drag={FREE_POS_KEYS.featuredTitle}
                  className="absolute text-xl sm:text-2xl"
                  style={{
                    left: `${featuredPos!.x * 100}%`,
                    top: `${featuredPos!.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    color: "var(--store-heading-color, var(--store-text))",
                    fontFamily: "var(--store-font)",
                    letterSpacing: "var(--store-heading-track, inherit)",
                    fontWeight: "var(--heading-weight, 400)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {featuredTitle}
                </h2>
              ) : (
                <>
                  {featuredEyebrow && (
                    <p
                      data-edit-text
                      data-edit-field="featuredEyebrow"
                      className="sproutly-section-eyebrow text-[0.6875rem] tracking-[0.4em] uppercase mb-4"
                      style={{
                        color: eyebrowColor,
                        fontFamily: "var(--store-font)",
                        // 粗細讀 --eyebrow-weight（小標粗細那格由 layout.tsx 的規則設）：
                        // 這行的 500 寫在 inline style 上，CSS 規則壓不過，只能繞變數。
                        // 沒設時變數不存在、fallback 回原本的 500。
                        fontWeight: "var(--eyebrow-weight, 500)",
                      }}
                    >
                      {featuredEyebrow}
                    </p>
                  )}
                  <h2
                    data-edit-drag={FREE_POS_KEYS.featuredTitle}
                    data-edit-text
                    data-edit-field="featuredTitle"
                    className="sproutly-section-head text-xl sm:text-2xl mb-20 sm:mb-28"
                    style={{
                      color: "var(--store-heading-color, var(--store-text))",
                      fontFamily: "var(--store-font)",
                      letterSpacing: "var(--store-heading-track, inherit)",
                      fontWeight: "var(--heading-weight, 400)",
                    }}
                  >
                    {featuredTitle}
                  </h2>
                </>
              )}
              <div className={`sproutly-card-grid sproutly-stagger grid grid-cols-2 gap-x-6 sm:gap-x-10 gap-y-16 ${
                theme.layout.featuredColumns === 2 ? "md:grid-cols-2"
                : theme.layout.featuredColumns === 4 ? "md:grid-cols-4"
                : "md:grid-cols-3"
              }`}>
                {featuredProducts.map((p) => {
                  const soldOut = isSoldOut(p.stock);
                  return (
                  <Link
                    key={p.id}
                    href={`/${slug}/products/${p.id}`}
                    className="sproutly-card"
                    aria-label={`${p.name}，${formatPrice(p.price_cents, p.currency)}${stockAriaSuffix(p.stock)}`}
                  >
                    <div className="sproutly-card-image aspect-square relative">
                      {/* 售完的圖片去彩、壓暗，再蓋一枚角落標記——跟 shop 逛街頁
                          同一套語言，客人在首頁就分得出哪幾株沒了，不必點進去才知道。 */}
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
                        <Image
                          src={p.image_urls[0]}
                          alt={p.name}
                          fill
                          sizes="(min-width: 768px) 350px, 50vw"
                          quality={80}
                          loading="lazy"
                          className={`object-cover transition ${
                            soldOut ? "opacity-55 grayscale" : ""
                          }`}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: theme.bg }}
                        >
                          <span
                            className="text-[0.6875rem] uppercase"
                            style={{
                              color: theme.textMuted,
                              opacity: 0.4,
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
                      style={{
                        color: "var(--card-title-color, var(--store-text))",
                        fontFamily: "var(--store-font)",
                        fontWeight: "var(--card-title-weight, 400)",
                      }}
                    >
                      {p.name}
                    </h3>
                    <p
                      className="sproutly-card-meta sproutly-card-price mt-1 text-sm"
                      style={{
                        color: "var(--card-price-color, var(--store-text-muted))",
                      }}
                    >
                      {formatPrice(p.price_cents, p.currency)}
                    </p>
                    {/* 售完已由圖片角標表達，這裡只留「剩 N」琥珀色提示，
                        跟 shop 頁與商品詳情頁同一套語言。
                        掛 sproutly-card-micro：這行跟選物的「看更多」、慢讀的分類標籤是同一種
                        全大寫小字，之前沒掛，商家在精選那段調「卡片行距」「卡片小字字級」兩格
                        都跳過它——價錢跟它擠在一起、或整張卡放寬之後它自己貼著價錢不動。
                        「剩 3 件」還是客人決定要不要現在下單的那行字，11px 的中文本來就糊。 */}
                    {isLowStock(p.stock) ? (
                      <p
                        className="sproutly-card-micro mt-1 text-[0.6875rem] uppercase font-medium"
                        style={{
                          color: cardMicroStockColor,
                          letterSpacing: "var(--card-micro-track, 0.3em)",
                        }}
                      >
                        Low Stock · 剩 {p.stock}
                      </p>
                    ) : null}
                  </Link>
                  );
                })}
              </div>
              <div className="mt-24 text-center">
                <Link
                  href={`/${slug}/shop`}
                  className="sproutly-link text-sm tracking-wider"
                  data-default-line="true"
                  data-edit-text
                  data-edit-field="featuredCta"
                  style={{ color: "var(--store-text)" }}
                >
                  {featuredCta}
                </Link>
              </div>
            </div>
          </section>
          );
        })()}

        {/* === Journal（placeholder：尚無實際文章） === */}
        {(() => {
          const journalPos = theme.layout.freePositions[FREE_POS_KEYS.journalIntro] ?? null;
          const journalFree = journalPos !== null;
          const journalStyle = sectionStyleFor("journal");
          const journalEyebrow =
            theme.homepage.journalEyebrow || HOMEPAGE_DEFAULTS.journalEyebrow;
          const journalTitle =
            theme.homepage.journalTitle || HOMEPAGE_DEFAULTS.journalTitle;
          const journalSubtitle =
            theme.homepage.journalSubtitle || HOMEPAGE_DEFAULTS.journalSubtitle;
          const journalCardLabel =
            theme.homepage.journalCardLabel ?? HOMEPAGE_DEFAULTS.journalCardLabel;
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${journalFree ? "min-h-[60vh]" : ""}`}
            style={mergeSectionStyle(journalStyle)}
            data-edit-target="journal"
            data-edit-label="Journal 區段"
            data-anim={journalStyle.entranceVal}
            data-heading-scale={journalStyle.headingScaleVal}
            data-heading-weight={journalStyle.headingWeightVal}
            data-heading-leading={journalStyle.headingLeadingVal}
            data-heading-rule={journalStyle.headingRuleVal}
            data-heading-rule-weight={journalStyle.headingRuleWeightVal}
            data-heading-rule-style={journalStyle.headingRuleStyleVal}
            data-eyebrow-tracking={journalStyle.eyebrowTrackingVal}
            data-eyebrow-scale={journalStyle.eyebrowScaleVal}
            data-eyebrow-weight={journalStyle.eyebrowWeightVal}
            data-eyebrow-leading={journalStyle.eyebrowLeadingVal}
            data-eyebrow-case={journalStyle.eyebrowCaseVal}
            data-heading-gap={journalStyle.headingGapVal}
              data-heading-inner={journalStyle.headingInnerGapVal}
            data-line-height={journalStyle.lineHeightVal}
            data-section-filter={journalStyle.filterVal}
            data-body-align={journalStyle.bodyAlignVal}
            data-body-measure={journalStyle.bodyMeasureVal}
            data-body-scale={journalStyle.bodyScaleVal}
            data-body-weight={journalStyle.bodyWeightVal}
            data-body-tracking={journalStyle.bodyTrackingVal}
            data-content-align={journalStyle.contentAlignVal}
            data-hide-on={journalStyle.hideOnVal}
            data-media-radius={journalStyle.mediaRadiusVal}
            data-media-aspect={journalStyle.mediaAspectVal}
            data-media-focus={journalStyle.mediaFocusVal}
            data-media-fit={journalStyle.mediaFitVal}
            data-grid-gap={journalStyle.gridGapVal}
            data-mobile-cols={journalStyle.mobileColumnsVal}
            data-card-hover={journalStyle.cardHoverVal}
            data-card-text={journalStyle.cardTextVal}
            data-card-surface={journalStyle.cardSurfaceVal}
            data-card-padding={journalStyle.cardPaddingVal}
            data-card-layout={journalStyle.cardLayoutVal}
            data-card-media-width={journalStyle.cardMediaWidthVal}
            data-card-title-lines={journalStyle.cardTitleLinesVal}
            data-card-desc-lines={journalStyle.cardDescLinesVal}
            data-card-title-scale={journalStyle.cardTitleScaleVal}
            data-card-title-weight={journalStyle.cardTitleWeightVal}
            data-card-title-leading={journalStyle.cardTitleLeadingVal}
            data-card-title-tracking={journalStyle.cardTitleTrackingVal}
            data-card-desc-scale={journalStyle.cardDescScaleVal}
            data-card-desc-leading={journalStyle.cardDescLeadingVal}
            data-card-desc-weight={journalStyle.cardDescWeightVal}
            data-card-desc-tracking={journalStyle.cardDescTrackingVal}
            data-card-micro-scale={journalStyle.cardMicroScaleVal}
            data-card-micro-tracking={journalStyle.cardMicroTrackingVal}
            data-card-micro-leading={journalStyle.cardMicroLeadingVal}
            data-card-micro-weight={journalStyle.cardMicroWeightVal}
            data-card-micro-case={journalStyle.cardMicroCaseVal}
            data-card-row-gap={journalStyle.cardRowGapVal}
          >
          <div className="max-w-5xl mx-auto px-8 sm:px-12" style={{ textAlign: journalStyle.align }}>
            {journalFree ? (
              <div
                data-edit-drag={FREE_POS_KEYS.journalIntro}
                className="absolute"
                style={{
                  left: `${journalPos!.x * 100}%`,
                  top: `${journalPos!.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  maxWidth: "min(560px, 80vw)",
                  width: "100%",
                }}
              >
                <p
                  data-edit-text
                  data-edit-field="journalEyebrow"
                  className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                  style={{ color: eyebrowColor }}
                >
                  {journalEyebrow}
                </p>
                <h2
                  data-edit-text
                  data-edit-field="journalTitle"
                  className="text-3xl sm:text-4xl lg:text-[2.5rem]"
                  style={{
                    color: "var(--store-heading-color, var(--store-text))",
                    fontFamily: "var(--store-font)",
                    fontWeight: "var(--heading-weight, 400)",
                    letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                    lineHeight: "var(--heading-leading, 1.2)",
                  }}
                >
                  {journalTitle}
                </h2>
                <p
                  data-edit-text
                  data-edit-field="journalSubtitle"
                  className="sproutly-section-sub mt-6 text-sm sm:text-base leading-[1.9]"
                  style={{ color: "var(--store-text-muted)" }}
                >
                  {journalSubtitle}
                </p>
              </div>
            ) : (
              <div className="sproutly-section-head mb-20 sm:mb-28" data-edit-drag={FREE_POS_KEYS.journalIntro}>
                <p
                  data-edit-text
                  data-edit-field="journalEyebrow"
                  className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                  style={{ color: eyebrowColor }}
                >
                  {journalEyebrow}
                </p>
                <h2
                  data-edit-text
                  data-edit-field="journalTitle"
                  className="text-3xl sm:text-4xl lg:text-[2.5rem]"
                  style={{
                    color: "var(--store-heading-color, var(--store-text))",
                    fontFamily: "var(--store-font)",
                    fontWeight: "var(--heading-weight, 400)",
                    letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                    lineHeight: "var(--heading-leading, 1.2)",
                  }}
                >
                  {journalTitle}
                </h2>
                <p
                  data-edit-text
                  data-edit-field="journalSubtitle"
                  className="sproutly-section-sub mt-6 text-sm sm:text-base max-w-xl leading-[1.9]"
                  style={{ color: "var(--store-text-muted)" }}
                >
                  {journalSubtitle}
                </p>
              </div>
            )}

            <div className={`sproutly-card-grid sproutly-stagger grid grid-cols-1 gap-x-8 sm:gap-x-10 gap-y-16 ${
              theme.layout.journalColumns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
            }`}>
              {(theme.homepage.journalCards.length > 0
                ? theme.homepage.journalCards
                : JOURNAL_CARD_DEFAULTS
              ).map((entry, i) => {
                const fallbackImage = visibleCollections[i]?.image;
                return (
                  <article key={i} className="sproutly-card">
                    <div
                      className="sproutly-card-image aspect-[5/3] overflow-hidden relative"
                      style={{ background: theme.surface }}
                    >
                      {fallbackImage ? (
                        <Image
                          src={fallbackImage}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 400px, 100vw"
                          quality={75}
                          loading="lazy"
                          className="object-cover"
                          style={{ opacity: 0.55 }}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.bg} 100%)`,
                          }}
                        />
                      )}
                    </div>
                    <p
                      data-edit-text
                      data-edit-field="journalCardEyebrow"
                      data-edit-index={i}
                      className="sproutly-card-micro mt-6 text-[10px] tracking-[0.4em] uppercase"
                      style={{ color: cardMicroColor }}
                    >
                      {entry.eyebrow}
                    </p>
                    <h3
                      data-edit-text
                      data-edit-field="journalCardTitle"
                      data-edit-index={i}
                      className="sproutly-card-title mt-3 text-lg sm:text-xl leading-[1.4]"
                      style={{
                        color: "var(--card-title-color, var(--store-text))",
                        fontFamily: "var(--store-font)",
                        fontWeight: "var(--card-title-weight, 400)",
                        // 字距讀 --card-title-track（卡片品名字距那格由 layout.tsx 的規則設）
                        // 再退回整段字距、再退回原本的值：inline 蓋不過 CSS 規則，那格只能
                        // 靠變數傳進來。沒設時整條變數不存在，等同原本的寫法。
                        letterSpacing:
                          "var(--card-title-track, var(--store-track, -0.005em))",
                      }}
                    >
                      {entry.title}
                    </h3>
                    <p
                      data-edit-text
                      data-edit-field="journalCardExcerpt"
                      data-edit-index={i}
                      className="sproutly-card-desc mt-3 text-sm leading-[1.85]"
                      style={{
                        color: "var(--card-desc-color, var(--store-text-muted))",
                      }}
                    >
                      {entry.excerpt}
                    </p>
                    <p
                      data-edit-text
                      data-edit-field="journalCardLabel"
                      className="sproutly-card-micro mt-5 text-[10px] tracking-[0.3em] uppercase"
                      style={{ color: cardMicroMutedColor, opacity: 0.65 }}
                    >
                      {journalCardLabel}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
          </section>
          );
        })()}

        {/* === Promise（雜誌風 quote card） === */}
        {promiseLines.length > 0 && (() => {
          const promisePos = theme.layout.freePositions[FREE_POS_KEYS.promiseCard] ?? null;
          const promiseStyle = sectionStyleFor("promise");
          const promiseCardWrap =
            promiseStyle.align === "right"
              ? "ml-auto"
              : promiseStyle.align === "left"
              ? "mr-auto"
              : "mx-auto";
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${promisePos ? "min-h-screen" : ""}`}
            style={mergeSectionStyle(promiseStyle)}
            data-edit-target="promise"
            data-edit-label="Promise 區段"
            data-anim={promiseStyle.entranceVal}
            data-heading-scale={promiseStyle.headingScaleVal}
            data-heading-weight={promiseStyle.headingWeightVal}
            data-heading-leading={promiseStyle.headingLeadingVal}
            data-heading-rule={promiseStyle.headingRuleVal}
            data-heading-rule-weight={promiseStyle.headingRuleWeightVal}
            data-heading-rule-style={promiseStyle.headingRuleStyleVal}
            data-eyebrow-tracking={promiseStyle.eyebrowTrackingVal}
            data-eyebrow-scale={promiseStyle.eyebrowScaleVal}
            data-eyebrow-weight={promiseStyle.eyebrowWeightVal}
            data-eyebrow-leading={promiseStyle.eyebrowLeadingVal}
            data-eyebrow-case={promiseStyle.eyebrowCaseVal}
            data-line-height={promiseStyle.lineHeightVal}
            data-section-filter={promiseStyle.filterVal}
            data-body-align={promiseStyle.bodyAlignVal}
            data-body-measure={promiseStyle.bodyMeasureVal}
            data-body-scale={promiseStyle.bodyScaleVal}
            data-body-weight={promiseStyle.bodyWeightVal}
            data-body-tracking={promiseStyle.bodyTrackingVal}
            data-content-align={promiseStyle.contentAlignVal}
            data-hide-on={promiseStyle.hideOnVal}
            data-media-radius={promiseStyle.mediaRadiusVal}
          >
            <div
              className={
                promisePos
                  ? "absolute"
                  : `max-w-3xl ${promiseCardWrap} px-6 sm:px-12`
              }
              data-edit-drag={FREE_POS_KEYS.promiseCard}
              style={
                promisePos
                  ? {
                      left: `${promisePos.x * 100}%`,
                      top: `${promisePos.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(680px, 90vw)",
                      width: "100%",
                      padding: "0 1.5rem",
                    }
                  : undefined
              }
            >
              <figure
                className="relative px-8 py-16 sm:px-16 sm:py-24 text-center rounded-sm"
                style={{
                  background: theme.surface,
                  boxShadow: "var(--sproutly-elev-3)",
                  border: `1px solid ${theme.border}`,
                }}
              >
                {/* 大引號 visual */}
                <span
                  aria-hidden="true"
                  className="absolute select-none pointer-events-none"
                  style={{
                    top: "1.5rem",
                    left: "2rem",
                    fontFamily: "var(--store-font)",
                    fontSize: "5rem",
                    lineHeight: 1,
                    color: theme.accent,
                    opacity: 0.18,
                    fontWeight: 400,
                  }}
                >
                  &ldquo;
                </span>
                <span
                  aria-hidden="true"
                  className="absolute select-none pointer-events-none"
                  style={{
                    bottom: "0.5rem",
                    right: "2rem",
                    fontFamily: "var(--store-font)",
                    fontSize: "5rem",
                    lineHeight: 1,
                    color: theme.accent,
                    opacity: 0.18,
                    fontWeight: 400,
                  }}
                >
                  &rdquo;
                </span>

                {/* 上方 eyebrow */}
                <p
                  data-edit-text
                  data-edit-field="promiseEyebrow"
                  className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-8 relative z-10"
                  style={{ color: eyebrowColor }}
                >
                  {promiseEyebrow}
                </p>

                <blockquote
                  data-edit-text
                  data-edit-field="promise"
                  className="text-lg sm:text-xl md:text-2xl leading-[2] relative z-10"
                  style={{
                    // 這一段從頭到尾只有這一句話，而它三個地方寫死：顏色抓全站 theme.text
                    // （不是 --store-text，所以這一段的「文字顏色」換了它不跟）、粗細寫死
                    // 400、字距只讀全站那條。inline 壓得過 layout.tsx 那幾條規則，等於
                    // 「內文粗細」「內文字距」在這一段是死的按鈕。三個都改讀變數、fallback
                    // 回原本的值，沒設等於原樣。
                    color: "var(--store-text)",
                    fontFamily: "var(--store-font)",
                    fontWeight: "var(--body-weight, 400)",
                    letterSpacing:
                      "var(--body-track, var(--store-track, 0.01em))",
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {promiseLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </blockquote>

                {/* 底部裝飾線 */}
                <div
                  className="mx-auto mt-10 relative z-10"
                  style={{
                    width: "48px",
                    height: "1px",
                    background: theme.accent,
                    opacity: 0.4,
                  }}
                />
              </figure>
            </div>
          </section>
          );
        })()}

        {/* === Testimonials（optional block，商家從 editor 加） === */}
        {theme.layout.sectionOrder.includes("testimonials") &&
          theme.layout.testimonials.length > 0 &&
          (() => {
            const testimonialsPos = theme.layout.freePositions[FREE_POS_KEYS.testimonialsTitle] ?? null;
            const testimonialsFree = testimonialsPos !== null;
            const testimonialsStyle = sectionStyleFor("testimonials");
            const testimonialsEyebrow =
              theme.homepage.testimonialsEyebrow ||
              HOMEPAGE_DEFAULTS.testimonialsEyebrow;
            const testimonialsTitle =
              theme.homepage.testimonialsTitle ||
              HOMEPAGE_DEFAULTS.testimonialsTitle;
            const testimonialsDivider =
              testimonialsStyle.align === "right"
                ? "ml-auto"
                : testimonialsStyle.align === "left"
                ? ""
                : "mx-auto";
            // 卡片上那三行字（引言 / 姓名 / 頭銜）接上編輯器既有的卡片文字控制。
            // 這一段的卡片一直沒掛 sproutly-card-* 的 class、也沒發出任何 data-card-*，但
            // 編輯器右邊那排「卡片標題 / 卡片描述 / 卡片小字」的格子每一段都照樣列出來——
            // 商家在顧客評語這段按下去，畫面上一個字都不會動，等於十二格死的控制。
            // 對應關係照那三行在卡片上的角色挑：引言是卡片上要讀的那段字（描述）、姓名是
            // 一眼認人的那一行（品名）、頭銜是底下那行附註（小字）。
            // 沒發的兩組是刻意的：行數（title-lines / desc-lines）會把引言裁掉尾巴，評語被
            // 截在半句話比排得長還糟；卡片行距（row-gap）那條規則加的是 margin-top，這張卡
            // 的間距寫在引言的下留白（mb-6）上，發了會多出一截上留白。
            return (
            <section
              className={`relative py-40 sm:py-56 ${animClass} ${testimonialsFree ? "min-h-[60vh]" : ""}`}
              style={mergeSectionStyle(testimonialsStyle, theme.surface)}
              data-edit-target="testimonials"
              data-edit-label="顧客評語"
              data-anim={testimonialsStyle.entranceVal}
              data-heading-scale={testimonialsStyle.headingScaleVal}
              data-heading-weight={testimonialsStyle.headingWeightVal}
              data-heading-leading={testimonialsStyle.headingLeadingVal}
              data-heading-rule={testimonialsStyle.headingRuleVal}
              data-heading-rule-weight={testimonialsStyle.headingRuleWeightVal}
              data-heading-rule-style={testimonialsStyle.headingRuleStyleVal}
              data-eyebrow-tracking={testimonialsStyle.eyebrowTrackingVal}
              data-eyebrow-scale={testimonialsStyle.eyebrowScaleVal}
              data-eyebrow-weight={testimonialsStyle.eyebrowWeightVal}
              data-eyebrow-leading={testimonialsStyle.eyebrowLeadingVal}
              data-eyebrow-case={testimonialsStyle.eyebrowCaseVal}
              data-heading-gap={testimonialsStyle.headingGapVal}
              data-heading-inner={testimonialsStyle.headingInnerGapVal}
              data-line-height={testimonialsStyle.lineHeightVal}
              data-section-filter={testimonialsStyle.filterVal}
              data-body-align={testimonialsStyle.bodyAlignVal}
              data-body-measure={testimonialsStyle.bodyMeasureVal}
              data-body-scale={testimonialsStyle.bodyScaleVal}
              data-body-weight={testimonialsStyle.bodyWeightVal}
              data-body-tracking={testimonialsStyle.bodyTrackingVal}
              data-content-align={testimonialsStyle.contentAlignVal}
              data-hide-on={testimonialsStyle.hideOnVal}
              data-media-radius={testimonialsStyle.mediaRadiusVal}
              data-grid-gap={testimonialsStyle.gridGapVal}
              data-mobile-cols={testimonialsStyle.mobileColumnsVal}
              data-card-title-scale={testimonialsStyle.cardTitleScaleVal}
              data-card-title-weight={testimonialsStyle.cardTitleWeightVal}
              data-card-title-leading={testimonialsStyle.cardTitleLeadingVal}
              data-card-title-tracking={testimonialsStyle.cardTitleTrackingVal}
              data-card-desc-scale={testimonialsStyle.cardDescScaleVal}
              data-card-desc-leading={testimonialsStyle.cardDescLeadingVal}
              data-card-desc-weight={testimonialsStyle.cardDescWeightVal}
              data-card-desc-tracking={testimonialsStyle.cardDescTrackingVal}
              data-card-micro-scale={testimonialsStyle.cardMicroScaleVal}
              data-card-micro-tracking={testimonialsStyle.cardMicroTrackingVal}
              data-card-micro-leading={testimonialsStyle.cardMicroLeadingVal}
              data-card-micro-weight={testimonialsStyle.cardMicroWeightVal}
              data-card-micro-case={testimonialsStyle.cardMicroCaseVal}
            >
              <div
                className="max-w-5xl mx-auto px-8 sm:px-12"
                style={{ textAlign: testimonialsStyle.align }}
              >
                {testimonialsFree ? (
                  <div
                    data-edit-drag={FREE_POS_KEYS.testimonialsTitle}
                    className="absolute"
                    style={{
                      left: `${testimonialsPos!.x * 100}%`,
                      top: `${testimonialsPos!.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(560px, 80vw)",
                      width: "100%",
                    }}
                  >
                    <p
                      data-edit-text
                      data-edit-field="testimonialsEyebrow"
                      className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                      style={{ color: eyebrowColor }}
                    >
                      {testimonialsEyebrow}
                    </p>
                    <h2
                      data-edit-text
                      data-edit-field="testimonialsTitle"
                      className="text-2xl sm:text-3xl md:text-4xl"
                      style={{
                        color: "var(--store-heading-color, var(--store-text))",
                        fontFamily: "var(--store-font)",
                        fontWeight: "var(--heading-weight, 400)",
                        letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                        lineHeight: "var(--heading-leading, 1.2)",
                      }}
                    >
                      {testimonialsTitle}
                    </h2>
                    <div
                      className="sproutly-section-sub mt-6"
                      style={{
                        width: "32px",
                        height: "1px",
                        background: accentColor,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="sproutly-section-head mb-20 sm:mb-28"
                    data-edit-drag={FREE_POS_KEYS.testimonialsTitle}
                  >
                    <p
                      data-edit-text
                      data-edit-field="testimonialsEyebrow"
                      className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                      style={{ color: eyebrowColor }}
                    >
                      {testimonialsEyebrow}
                    </p>
                    <h2
                      data-edit-text
                      data-edit-field="testimonialsTitle"
                      className="text-2xl sm:text-3xl md:text-4xl"
                      style={{
                        color: "var(--store-heading-color, var(--store-text))",
                        fontFamily: "var(--store-font)",
                        fontWeight: "var(--heading-weight, 400)",
                        letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                        lineHeight: "var(--heading-leading, 1.2)",
                      }}
                    >
                      {testimonialsTitle}
                    </h2>
                    <div
                      className={`sproutly-section-sub ${testimonialsDivider} mt-6`}
                      style={{
                        width: "32px",
                        height: "1px",
                        background: accentColor,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                )}

                <div className={`sproutly-card-grid grid grid-cols-1 gap-6 md:gap-8 ${
                  theme.layout.testimonialsColumns === 2 ? "md:grid-cols-2"
                  : theme.layout.testimonialsColumns === 4 ? "md:grid-cols-4"
                  : "md:grid-cols-3"
                }`}>
                  {theme.layout.testimonials.slice(0, 6).map((t, i) => (
                    <figure
                      key={i}
                      className="relative p-8 rounded-sm"
                      style={{
                        background: theme.bg,
                        boxShadow: "var(--sproutly-elev-2)",
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute select-none pointer-events-none"
                        style={{
                          top: "0.5rem",
                          left: "1rem",
                          fontFamily: "var(--store-font)",
                          fontSize: "3rem",
                          lineHeight: 1,
                          color: theme.accent,
                          opacity: 0.2,
                        }}
                      >
                        &ldquo;
                      </span>
                      <blockquote
                        data-edit-text
                        data-edit-field="testimonialQuote"
                        data-edit-index={i}
                        className="sproutly-card-desc text-base leading-[1.95] relative z-10 mb-6"
                        style={{
                          color: "var(--card-desc-color, var(--store-text))",
                          fontFamily: "var(--store-font)",
                          fontWeight: "var(--card-desc-weight, 400)",
                          // 字距寫在 inline、優先度壓過帶 class 的規則，所以繞 --card-desc-track
                          // （layout.tsx 依 attribute 給值），沒設就讀回原本的 --store-track
                          letterSpacing: "var(--card-desc-track, var(--store-track, 0.005em))",
                          wordBreak: "keep-all",
                        }}
                      >
                        {t.quote}
                      </blockquote>
                      <figcaption className="relative z-10">
                        <p
                          data-edit-text
                          data-edit-field="testimonialAuthor"
                          data-edit-index={i}
                          className="sproutly-card-title text-sm"
                          style={{
                            color: "var(--card-title-color, var(--store-text))",
                            // 原本是 font-medium 這個 class，改寫成 inline 的變數：
                            // 「卡片標題粗細」那格給的就是 --card-title-weight，沒設讀回 500
                            fontWeight: "var(--card-title-weight, 500)",
                          }}
                        >
                          {t.author}
                        </p>
                        {t.role && (
                          <p
                            data-edit-text
                            data-edit-field="testimonialRole"
                            data-edit-index={i}
                            className="sproutly-card-micro text-xs mt-1"
                            style={{ color: cardMicroMutedColor }}
                          >
                            {t.role}
                          </p>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === FAQ Accordion（optional block，<details> 原生 accordion） === */}
        {theme.layout.sectionOrder.includes("faq") &&
          validFaqItems.length > 0 && (() => {
            const faqPos = theme.layout.freePositions[FREE_POS_KEYS.faqIntro] ?? null;
            const faqFree = faqPos !== null;
            const faqStyle = sectionStyleFor("faq");
            const faqDivider =
              faqStyle.align === "right"
                ? "ml-auto"
                : faqStyle.align === "left"
                ? ""
                : "mx-auto";
            const faqEyebrow =
              theme.homepage.faqEyebrow ?? HOMEPAGE_DEFAULTS.faqEyebrow;
            const faqTitle =
              theme.homepage.faqTitle ?? HOMEPAGE_DEFAULTS.faqTitle;
            // 問句與答案接上編輯器既有的卡片文字控制。這一段沒有卡片格線，但編輯器右邊
            // 那排「卡片標題 / 卡片描述」的格子每一段都照樣列出來——商家在常見問題這段按
            // 下去，畫面上一個字都不會動，跟顧客評語那段補之前是同一種問題。
            // 對應關係照那兩行的角色挑：問句是客人掃過去找自己那題的那一行（卡片標題）、
            // 答案是真的要讀完的那段字（卡片描述）。
            // 沒發的幾組是刻意的：行數（title-lines / desc-lines）會把答案裁在半句話，客
            // 人來這一段就是要看完整回答；小字那組這段沒有對應的行；卡片行距那條規則加的
            // 是 margin-top，這一列的間距寫在整列的上下 padding 上，發了會多出一截。
            return (
            <section
              className={`relative py-40 sm:py-56 ${animClass} ${faqFree ? "min-h-[60vh]" : ""}`}
              style={mergeSectionStyle(faqStyle)}
              data-edit-target="faq"
              data-edit-label="常見問題"
              data-anim={faqStyle.entranceVal}
              data-heading-scale={faqStyle.headingScaleVal}
              data-heading-weight={faqStyle.headingWeightVal}
              data-heading-leading={faqStyle.headingLeadingVal}
              data-heading-rule={faqStyle.headingRuleVal}
              data-heading-rule-weight={faqStyle.headingRuleWeightVal}
              data-heading-rule-style={faqStyle.headingRuleStyleVal}
              data-eyebrow-tracking={faqStyle.eyebrowTrackingVal}
              data-eyebrow-scale={faqStyle.eyebrowScaleVal}
              data-eyebrow-weight={faqStyle.eyebrowWeightVal}
              data-eyebrow-leading={faqStyle.eyebrowLeadingVal}
              data-eyebrow-case={faqStyle.eyebrowCaseVal}
              data-heading-gap={faqStyle.headingGapVal}
              data-heading-inner={faqStyle.headingInnerGapVal}
              data-line-height={faqStyle.lineHeightVal}
              data-section-filter={faqStyle.filterVal}
              data-body-align={faqStyle.bodyAlignVal}
              data-body-measure={faqStyle.bodyMeasureVal}
              data-body-scale={faqStyle.bodyScaleVal}
              data-body-weight={faqStyle.bodyWeightVal}
              data-body-tracking={faqStyle.bodyTrackingVal}
              data-content-align={faqStyle.contentAlignVal}
              data-hide-on={faqStyle.hideOnVal}
              data-media-radius={faqStyle.mediaRadiusVal}
              data-card-title-scale={faqStyle.cardTitleScaleVal}
              data-card-title-weight={faqStyle.cardTitleWeightVal}
              data-card-title-leading={faqStyle.cardTitleLeadingVal}
              data-card-title-tracking={faqStyle.cardTitleTrackingVal}
              data-card-desc-scale={faqStyle.cardDescScaleVal}
              data-card-desc-leading={faqStyle.cardDescLeadingVal}
              data-card-desc-weight={faqStyle.cardDescWeightVal}
              data-card-desc-tracking={faqStyle.cardDescTrackingVal}
            >
              <div
                className="max-w-2xl mx-auto px-6 sm:px-12"
                style={{ textAlign: faqStyle.align }}
              >
                {faqFree ? (
                  <div
                    data-edit-drag={FREE_POS_KEYS.faqIntro}
                    className="absolute"
                    style={{
                      left: `${faqPos!.x * 100}%`,
                      top: `${faqPos!.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(560px, 80vw)",
                      width: "100%",
                    }}
                  >
                    <p
                      className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                      style={{ color: eyebrowColor }}
                    >
                      {faqEyebrow}
                    </p>
                    <h2
                      className="text-2xl sm:text-3xl md:text-4xl"
                      style={{
                        color: "var(--store-heading-color, var(--store-text))",
                        fontFamily: "var(--store-font)",
                        fontWeight: "var(--heading-weight, 400)",
                        letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                        lineHeight: "var(--heading-leading, 1.2)",
                      }}
                    >
                      {faqTitle}
                    </h2>
                    <div
                      className="sproutly-section-sub mt-6"
                      style={{
                        width: "32px",
                        height: "1px",
                        background: accentColor,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                ) : (
                <div className="sproutly-section-head mb-16" data-edit-drag={FREE_POS_KEYS.faqIntro}>
                  <p
                    data-edit-text
                    data-edit-field="faqEyebrow"
                    className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                    style={{ color: eyebrowColor }}
                  >
                    {faqEyebrow}
                  </p>
                  <h2
                    data-edit-text
                    data-edit-field="faqTitle"
                    className="text-2xl sm:text-3xl md:text-4xl"
                    style={{
                      color: "var(--store-heading-color, var(--store-text))",
                      fontFamily: "var(--store-font)",
                      fontWeight: "var(--heading-weight, 400)",
                      letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                      lineHeight: "var(--heading-leading, 1.2)",
                    }}
                  >
                    {faqTitle}
                  </h2>
                  <div
                    className={`sproutly-section-sub ${faqDivider} mt-6`}
                    style={{
                      width: "32px",
                      height: "1px",
                      background: accentColor,
                      opacity: 0.5,
                    }}
                  />
                </div>
                )}

                <ul className="divide-y" style={{ borderColor: theme.border }}>
                  {validFaqItems.map((item, i) => (
                    <li
                      key={i}
                      style={{ borderColor: theme.border }}
                      className="border-t last:border-b"
                    >
                      <details className="group">
                        <summary
                          className="flex items-center justify-between cursor-pointer py-6 list-none transition hover:opacity-80"
                          style={{ color: "var(--store-text)" }}
                        >
                          <span
                            data-edit-text
                            data-edit-field="faqQuestion"
                            data-edit-index={i}
                            className="sproutly-card-title text-base sm:text-lg pr-4"
                            style={{
                              fontFamily: "var(--store-font)",
                              // 顏色、粗細、字距三個都寫在 inline（inline 壓得過任何 CSS
                              // 規則），所以繞變數讓「卡片標題」那三格帶得動；沒設就讀回
                              // fallback 的原值，既有店家一個字都不會變
                              color: "var(--card-title-color, var(--store-text))",
                              fontWeight: "var(--card-title-weight, 400)",
                              letterSpacing:
                                "var(--card-title-track, var(--store-track, -0.005em))",
                            }}
                          >
                            {item.question}
                          </span>
                          <span
                            className="text-2xl leading-none flex-shrink-0 transition-transform duration-500 group-open:rotate-45"
                            style={{ color: accentColor }}
                            aria-hidden="true"
                          >
                            +
                          </span>
                        </summary>
                        <div
                          data-edit-text
                          data-edit-field="faqAnswer"
                          data-edit-index={i}
                          className="pb-7 pr-8 text-sm sm:text-base leading-[1.95]"
                          style={{ color: "var(--card-desc-color, var(--store-text-muted))" }}
                        >
                          {/* class 掛在每個段落上、不掛外面這層：「內文粗細 / 字距 / 大小」
                              那三條規則直接落在 p 上，掛外層的話那幾條會贏過繼承下來的值，
                              商家兩邊都設時卡片這格就沒作用了。落在 p 上帶 class 的規則比
                              那三條精確，卡片照樣聽卡片那格的 */}
                          {item.answer.split(/\n+/).map((line, idx) => (
                            <p
                              key={idx}
                              className={`sproutly-card-desc ${idx > 0 ? "mt-3" : ""}`}
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            );
          })()}

        {/* === Stats（optional block：4 個大數字 + label） === */}
        {theme.layout.sectionOrder.includes("stats") &&
          theme.layout.stats.length > 0 && (() => {
            const statsPos = theme.layout.freePositions[FREE_POS_KEYS.statsIntro] ?? null;
            const statsStyle = sectionStyleFor("stats");
            const statsEyebrow =
              theme.homepage.statsEyebrow ?? HOMEPAGE_DEFAULTS.statsEyebrow;
            const statsTitle =
              theme.homepage.statsTitle ?? HOMEPAGE_DEFAULTS.statsTitle;
            const statsHasHeading = !!(statsEyebrow || statsTitle);
            // 沒有開頭文字就沒有可拖的東西，殘留座標也不該把區段撐高
            const statsFree = statsPos !== null && statsHasHeading;
            const statsDivider =
              statsStyle.align === "right"
                ? "ml-auto"
                : statsStyle.align === "left"
                ? ""
                : "mx-auto";
            return (
            <section
              className={`relative py-32 sm:py-44 ${animClass} ${statsFree ? "min-h-[60vh]" : ""}`}
              style={mergeSectionStyle(statsStyle, theme.surface)}
              data-edit-target="stats"
              data-edit-label="數字 / 成就"
              data-anim={statsStyle.entranceVal}
              data-heading-scale={statsStyle.headingScaleVal}
              data-heading-weight={statsStyle.headingWeightVal}
              data-heading-leading={statsStyle.headingLeadingVal}
              data-heading-rule={statsStyle.headingRuleVal}
              data-heading-rule-weight={statsStyle.headingRuleWeightVal}
              data-heading-rule-style={statsStyle.headingRuleStyleVal}
              data-eyebrow-tracking={statsStyle.eyebrowTrackingVal}
              data-eyebrow-scale={statsStyle.eyebrowScaleVal}
              data-eyebrow-weight={statsStyle.eyebrowWeightVal}
              data-eyebrow-leading={statsStyle.eyebrowLeadingVal}
              data-eyebrow-case={statsStyle.eyebrowCaseVal}
              data-heading-gap={statsStyle.headingGapVal}
              data-heading-inner={statsStyle.headingInnerGapVal}
              data-line-height={statsStyle.lineHeightVal}
              data-section-filter={statsStyle.filterVal}
              data-body-align={statsStyle.bodyAlignVal}
              data-body-measure={statsStyle.bodyMeasureVal}
              data-body-scale={statsStyle.bodyScaleVal}
              data-body-weight={statsStyle.bodyWeightVal}
              data-body-tracking={statsStyle.bodyTrackingVal}
              data-content-align={statsStyle.contentAlignVal}
              data-hide-on={statsStyle.hideOnVal}
              data-media-radius={statsStyle.mediaRadiusVal}
              data-grid-gap={statsStyle.gridGapVal}
              data-mobile-cols={statsStyle.mobileColumnsVal}
              data-card-title-scale={statsStyle.cardTitleScaleVal}
              data-card-title-weight={statsStyle.cardTitleWeightVal}
              data-card-title-tracking={statsStyle.cardTitleTrackingVal}
              data-card-micro-scale={statsStyle.cardMicroScaleVal}
              data-card-micro-tracking={statsStyle.cardMicroTrackingVal}
              data-card-micro-leading={statsStyle.cardMicroLeadingVal}
              data-card-micro-weight={statsStyle.cardMicroWeightVal}
              data-card-micro-case={statsStyle.cardMicroCaseVal}
            >
              <div
                className="max-w-5xl mx-auto px-8 sm:px-12"
                style={{ textAlign: statsStyle.align }}
              >
                {statsFree && (
                  <div
                    data-edit-drag={FREE_POS_KEYS.statsIntro}
                    className="absolute"
                    style={{
                      left: `${statsPos!.x * 100}%`,
                      top: `${statsPos!.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(560px, 80vw)",
                      width: "100%",
                    }}
                  >
                    {statsEyebrow && (
                      <p
                        data-edit-text
                        data-edit-field="statsEyebrow"
                        className="sproutly-section-eyebrow text-[0.6875rem] tracking-[0.4em] uppercase mb-5"
                        style={{ color: eyebrowColor }}
                      >
                        {statsEyebrow}
                      </p>
                    )}
                    {statsTitle && (
                      <h2
                        data-edit-text
                        data-edit-field="statsTitle"
                        className="text-2xl sm:text-3xl md:text-4xl"
                        style={{
                          color: "var(--store-heading-color, var(--store-text))",
                          fontFamily: "var(--store-font)",
                          fontWeight: "var(--heading-weight, 500)",
                          letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                          lineHeight: "var(--heading-leading, 1.2)",
                        }}
                      >
                        {statsTitle}
                      </h2>
                    )}
                    <div
                      className="sproutly-section-sub mt-6"
                      style={{
                        width: "32px",
                        height: "1px",
                        background: accentColor,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                )}
                {statsHasHeading && !statsFree && (
                  <div className="sproutly-section-head mb-16 sm:mb-20" data-edit-drag={FREE_POS_KEYS.statsIntro}>
                    {statsEyebrow && (
                      <p
                        data-edit-text
                        data-edit-field="statsEyebrow"
                        className="sproutly-section-eyebrow text-[0.6875rem] tracking-[0.4em] uppercase mb-5"
                        style={{ color: eyebrowColor }}
                      >
                        {statsEyebrow}
                      </p>
                    )}
                    {statsTitle && (
                      <h2
                        data-edit-text
                        data-edit-field="statsTitle"
                        className="text-2xl sm:text-3xl md:text-4xl"
                        style={{
                          color: "var(--store-heading-color, var(--store-text))",
                          fontFamily: "var(--store-font)",
                          fontWeight: "var(--heading-weight, 500)",
                          letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                          lineHeight: "var(--heading-leading, 1.2)",
                        }}
                      >
                        {statsTitle}
                      </h2>
                    )}
                    <div
                      className={`sproutly-section-sub ${statsDivider} mt-6`}
                      style={{
                        width: "32px",
                        height: "1px",
                        background: accentColor,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                )}
                <div className={`sproutly-card-grid grid grid-cols-2 gap-y-12 gap-x-8 ${
                  theme.layout.statsColumns === 2 ? "md:grid-cols-2"
                  : theme.layout.statsColumns === 3 ? "md:grid-cols-3"
                  : "md:grid-cols-4"
                }`}>
                  {theme.layout.stats.slice(0, 6).map((s, i) => (
                    <div key={i} className="space-y-3">
                      <p
                        data-edit-text
                        data-edit-field="statValue"
                        data-edit-index={i}
                        className="sproutly-card-title text-4xl sm:text-5xl md:text-6xl tabular-nums"
                        style={{
                          // 那個大數字是這一格上一眼看到的東西，角色對應卡片品名。顏色、
                          // 粗細、字距寫在 inline（規則壓不過），改讀變數、fallback 原值。
                          // 行距那格沒發：底下這個 lineHeight: 1 是為了讓數字貼齊，而數字
                          // 本來就一行，換行才看得出差別的那格在這裡沒有意義
                          color: "var(--card-title-color, var(--store-text))",
                          fontFamily: "var(--store-font)",
                          fontWeight: "var(--card-title-weight, 400)",
                          letterSpacing:
                            "var(--card-title-track, var(--store-track, -0.02em))",
                          lineHeight: 1,
                        }}
                      >
                        {s.value}
                      </p>
                      <div
                        className="mx-auto"
                        style={{
                          width: "20px",
                          height: "1px",
                          background: accentColor,
                          opacity: 0.6,
                        }}
                      />
                      <p
                        data-edit-text
                        data-edit-field="statLabel"
                        data-edit-index={i}
                        // 數字底下那行全大寫小字，跟選物的「看更多」、慢讀的分類標籤是
                        // 同一種東西，接卡片小字那組
                        className="sproutly-card-micro text-xs sm:text-sm tracking-[0.2em] uppercase"
                        style={{ color: cardMicroMutedColor }}
                      >
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === Partners（optional block：合作夥伴 logos 灰階） === */}
        {theme.layout.sectionOrder.includes("partners") &&
          theme.layout.partners.length > 0 && (() => {
            const partnersPos = theme.layout.freePositions[FREE_POS_KEYS.partnersEyebrow] ?? null;
            const partnersFree = partnersPos !== null;
            const partnersStyle = sectionStyleFor("partners");
            const partnersJustify =
              partnersStyle.align === "left"
                ? "justify-start"
                : partnersStyle.align === "right"
                ? "justify-end"
                : "justify-center";
            const partnersEyebrow =
              theme.homepage.partnersEyebrow ?? HOMEPAGE_DEFAULTS.partnersEyebrow;
            return (
            <section
              className={`relative py-32 sm:py-44 ${animClass} ${partnersFree ? "min-h-[50vh]" : ""}`}
              style={mergeSectionStyle(partnersStyle)}
              data-edit-target="partners"
              data-edit-label="合作夥伴"
              data-anim={partnersStyle.entranceVal}
              data-heading-scale={partnersStyle.headingScaleVal}
              data-heading-weight={partnersStyle.headingWeightVal}
              data-heading-leading={partnersStyle.headingLeadingVal}
              data-heading-rule={partnersStyle.headingRuleVal}
              data-heading-rule-weight={partnersStyle.headingRuleWeightVal}
              data-heading-rule-style={partnersStyle.headingRuleStyleVal}
              data-eyebrow-tracking={partnersStyle.eyebrowTrackingVal}
              data-eyebrow-scale={partnersStyle.eyebrowScaleVal}
              data-eyebrow-weight={partnersStyle.eyebrowWeightVal}
              data-eyebrow-leading={partnersStyle.eyebrowLeadingVal}
              data-eyebrow-case={partnersStyle.eyebrowCaseVal}
              data-heading-gap={partnersStyle.headingGapVal}
              data-line-height={partnersStyle.lineHeightVal}
              data-section-filter={partnersStyle.filterVal}
              data-body-align={partnersStyle.bodyAlignVal}
              data-body-measure={partnersStyle.bodyMeasureVal}
              data-body-scale={partnersStyle.bodyScaleVal}
              data-body-weight={partnersStyle.bodyWeightVal}
              data-body-tracking={partnersStyle.bodyTrackingVal}
              data-content-align={partnersStyle.contentAlignVal}
              data-hide-on={partnersStyle.hideOnVal}
              data-media-radius={partnersStyle.mediaRadiusVal}
              data-grid-gap={partnersStyle.gridGapVal}
              data-partner-logo-scale={partnersStyle.partnerLogoScaleVal}
              data-partner-logo-opacity={partnersStyle.partnerLogoOpacityVal}
            >
              <div
                className="max-w-5xl mx-auto px-8 sm:px-12"
                style={{ textAlign: partnersStyle.align }}
              >
                {partnersFree ? (
                  <p
                    data-edit-text
                    data-edit-field="partnersEyebrow"
                    data-edit-drag={FREE_POS_KEYS.partnersEyebrow}
                    className="sproutly-section-eyebrow absolute text-[10px] tracking-[0.4em] uppercase"
                    style={{
                      left: `${partnersPos!.x * 100}%`,
                      top: `${partnersPos!.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      whiteSpace: "nowrap",
                      color: eyebrowMutedColor,
                    }}
                  >
                    {partnersEyebrow}
                  </p>
                ) : (
                <p
                  data-edit-drag={FREE_POS_KEYS.partnersEyebrow}
                  data-edit-text
                  data-edit-field="partnersEyebrow"
                  className="sproutly-section-head sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-12"
                  style={{ color: eyebrowMutedColor }}
                >
                  {partnersEyebrow}
                </p>
                )}
                <div className={`sproutly-card-grid flex flex-wrap items-center ${partnersJustify} gap-8 sm:gap-12 md:gap-16`}>
                  {theme.layout.partners.slice(0, 12).map((p, i) => {
                    const inner = (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.logoUrl}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        // 高度與透明度那兩組 class 留著當沒設時的樣子（既有店家一張都不會
                        // 變），另外掛一個 class 讓「合作 logo 大小 / 濃淡」那兩格的規則抓得
                        // 到——那兩條規則的選擇器比 class 精確，商家設了才蓋過去。
                        className="sproutly-partner-logo h-8 sm:h-10 md:h-12 w-auto opacity-50 hover:opacity-100 transition duration-500"
                        // 合作 logo 本來就一律轉黑白（設計上要它們安靜地排一列，不跟主
                        // 畫面搶色）。這個 inline 值蓋得過 layout.tsx 那條 img 規則，所以
                        // 商家把這段設成「復古」時只有它不跟著變；改讀同一個變數，沒設
                        // 濾鏡就退回原本的黑白，既有店家一張 logo 都不會變。
                        style={{ filter: "var(--store-media-filter, grayscale(100%))" }}
                      />
                    );
                    return p.href ? (
                      <a
                        key={i}
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={i} className="inline-block">
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === Gallery（optional block：3 欄圖片網格） === */}
        {theme.layout.sectionOrder.includes("gallery") &&
          theme.layout.gallery.length > 0 && (() => {
            const galleryPos = theme.layout.freePositions[FREE_POS_KEYS.galleryIntro] ?? null;
            const galleryFree = galleryPos !== null;
            const galleryStyle = sectionStyleFor("gallery");
            const galleryDivider =
              galleryStyle.align === "right"
                ? "ml-auto"
                : galleryStyle.align === "left"
                ? ""
                : "mx-auto";
            const galleryEyebrow =
              theme.homepage.galleryEyebrow ?? HOMEPAGE_DEFAULTS.galleryEyebrow;
            const galleryTitle =
              theme.homepage.galleryTitle ?? HOMEPAGE_DEFAULTS.galleryTitle;
            return (
            <section
              className={`relative py-40 sm:py-56 ${animClass} ${galleryFree ? "min-h-[60vh]" : ""}`}
              style={mergeSectionStyle(galleryStyle)}
              data-edit-target="gallery"
              data-edit-label="圖片相簿"
              data-anim={galleryStyle.entranceVal}
              data-heading-scale={galleryStyle.headingScaleVal}
              data-heading-weight={galleryStyle.headingWeightVal}
              data-heading-leading={galleryStyle.headingLeadingVal}
              data-heading-rule={galleryStyle.headingRuleVal}
              data-heading-rule-weight={galleryStyle.headingRuleWeightVal}
              data-heading-rule-style={galleryStyle.headingRuleStyleVal}
              data-eyebrow-tracking={galleryStyle.eyebrowTrackingVal}
              data-eyebrow-scale={galleryStyle.eyebrowScaleVal}
              data-eyebrow-weight={galleryStyle.eyebrowWeightVal}
              data-eyebrow-leading={galleryStyle.eyebrowLeadingVal}
              data-eyebrow-case={galleryStyle.eyebrowCaseVal}
              data-heading-gap={galleryStyle.headingGapVal}
              data-heading-inner={galleryStyle.headingInnerGapVal}
              data-line-height={galleryStyle.lineHeightVal}
              data-section-filter={galleryStyle.filterVal}
              data-body-align={galleryStyle.bodyAlignVal}
              data-body-measure={galleryStyle.bodyMeasureVal}
              data-body-scale={galleryStyle.bodyScaleVal}
              data-body-weight={galleryStyle.bodyWeightVal}
              data-body-tracking={galleryStyle.bodyTrackingVal}
              data-content-align={galleryStyle.contentAlignVal}
              data-hide-on={galleryStyle.hideOnVal}
              data-media-radius={galleryStyle.mediaRadiusVal}
              data-media-aspect={galleryStyle.mediaAspectVal}
              data-media-focus={galleryStyle.mediaFocusVal}
              data-media-fit={galleryStyle.mediaFitVal}
              data-grid-gap={galleryStyle.gridGapVal}
              data-mobile-cols={galleryStyle.mobileColumnsVal}
              data-card-hover={galleryStyle.cardHoverVal}
              data-card-text={galleryStyle.cardTextVal}
              data-card-surface={galleryStyle.cardSurfaceVal}
              data-card-padding={galleryStyle.cardPaddingVal}
              data-card-desc-scale={galleryStyle.cardDescScaleVal}
              data-card-desc-leading={galleryStyle.cardDescLeadingVal}
              data-card-desc-weight={galleryStyle.cardDescWeightVal}
              data-card-desc-tracking={galleryStyle.cardDescTrackingVal}
              data-card-desc-lines={galleryStyle.cardDescLinesVal}
              data-card-row-gap={galleryStyle.cardRowGapVal}
            >
              <div
                className="max-w-6xl mx-auto px-6 sm:px-10"
                style={{ textAlign: galleryStyle.align }}
              >
                {galleryFree ? (
                  <div
                    data-edit-drag={FREE_POS_KEYS.galleryIntro}
                    className="absolute"
                    style={{
                      left: `${galleryPos!.x * 100}%`,
                      top: `${galleryPos!.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(560px, 80vw)",
                      width: "100%",
                    }}
                  >
                    <p
                      data-edit-text
                      data-edit-field="galleryEyebrow"
                      className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                      style={{ color: eyebrowColor }}
                    >
                      {galleryEyebrow}
                    </p>
                    <h2
                      data-edit-text
                      data-edit-field="galleryTitle"
                      className="text-2xl sm:text-3xl md:text-4xl"
                      style={{
                        color: "var(--store-heading-color, var(--store-text))",
                        fontFamily: "var(--store-font)",
                        fontWeight: "var(--heading-weight, 400)",
                        letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                        lineHeight: "var(--heading-leading, 1.2)",
                      }}
                    >
                      {galleryTitle}
                    </h2>
                    <div
                      className="sproutly-section-sub mt-6"
                      style={{
                        width: "32px",
                        height: "1px",
                        background: accentColor,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                ) : (
                <div className="sproutly-section-head mb-16 sm:mb-20" data-edit-drag={FREE_POS_KEYS.galleryIntro}>
                  <p
                    data-edit-text
                    data-edit-field="galleryEyebrow"
                    className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                    style={{ color: eyebrowColor }}
                  >
                    {galleryEyebrow}
                  </p>
                  <h2
                    data-edit-text
                    data-edit-field="galleryTitle"
                    className="text-2xl sm:text-3xl md:text-4xl"
                    style={{
                      color: "var(--store-heading-color, var(--store-text))",
                      fontFamily: "var(--store-font)",
                      fontWeight: "var(--heading-weight, 400)",
                      letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                      lineHeight: "var(--heading-leading, 1.2)",
                    }}
                  >
                    {galleryTitle}
                  </h2>
                  <div
                    className={`sproutly-section-sub ${galleryDivider} mt-6`}
                    style={{
                      width: "32px",
                      height: "1px",
                      background: accentColor,
                      opacity: 0.5,
                    }}
                  />
                </div>
                )}

                <div className={`sproutly-card-grid sproutly-stagger grid grid-cols-2 gap-3 sm:gap-5 ${
                  theme.layout.galleryColumns === 2 ? "md:grid-cols-2"
                  : theme.layout.galleryColumns === 4 ? "md:grid-cols-4"
                  : "md:grid-cols-3"
                }`}>
                  {theme.layout.gallery.slice(0, 12).map((g, i) => (
                    <figure
                      key={i}
                      className="sproutly-card"
                    >
                      <div className="sproutly-card-image aspect-square relative">
                        <Image
                          src={g.url}
                          alt={g.caption ?? ""}
                          fill
                          sizes="(min-width: 768px) 350px, 50vw"
                          quality={78}
                          loading="lazy"
                          className="object-cover"
                        />
                      </div>
                      {g.caption && (
                        <figcaption
                          data-edit-text
                          data-edit-field="galleryCaption"
                          data-edit-index={i}
                          // 相簿這張卡只有圖說這一行字，角色就是卡片描述。行數這格這裡
                          // 留著（長短不一的圖說會把同一列的圖框推得高低不齊，正是那格
                          // 要解的），卡片行距也留著——mt-3 剛好等於那條規則的 0.75rem 基準
                          className="sproutly-card-desc mt-3 text-xs sm:text-sm leading-relaxed"
                          style={{ color: "var(--card-desc-color, var(--store-text-muted))" }}
                        >
                          {g.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === Visit === */}
        {(storeAddress || businessHoursText) && (() => {
          const visitPos = theme.layout.freePositions[FREE_POS_KEYS.visitCard] ?? null;
          const visitStyle = sectionStyleFor("visit");
          const visitDivider =
            visitStyle.align === "right"
              ? "ml-auto"
              : visitStyle.align === "left"
              ? ""
              : "mx-auto";
          const visitContactJustify =
            visitStyle.align === "left"
              ? "justify-start"
              : visitStyle.align === "right"
              ? "justify-end"
              : "justify-center";
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${visitPos ? "min-h-screen" : ""}`}
            style={mergeSectionStyle(visitStyle, theme.surface)}
            data-edit-target="visit"
            data-edit-label="來訪資訊"
            data-anim={visitStyle.entranceVal}
            data-heading-scale={visitStyle.headingScaleVal}
            data-heading-weight={visitStyle.headingWeightVal}
            data-heading-leading={visitStyle.headingLeadingVal}
            data-heading-rule={visitStyle.headingRuleVal}
            data-heading-rule-weight={visitStyle.headingRuleWeightVal}
            data-heading-rule-style={visitStyle.headingRuleStyleVal}
            data-eyebrow-tracking={visitStyle.eyebrowTrackingVal}
            data-eyebrow-scale={visitStyle.eyebrowScaleVal}
            data-eyebrow-weight={visitStyle.eyebrowWeightVal}
            data-eyebrow-leading={visitStyle.eyebrowLeadingVal}
            data-eyebrow-case={visitStyle.eyebrowCaseVal}
            data-line-height={visitStyle.lineHeightVal}
            data-section-filter={visitStyle.filterVal}
            data-body-align={visitStyle.bodyAlignVal}
            data-body-measure={visitStyle.bodyMeasureVal}
            data-body-scale={visitStyle.bodyScaleVal}
            data-body-weight={visitStyle.bodyWeightVal}
            data-body-tracking={visitStyle.bodyTrackingVal}
            data-content-align={visitStyle.contentAlignVal}
            data-hide-on={visitStyle.hideOnVal}
            data-media-radius={visitStyle.mediaRadiusVal}
          >
            <div
              data-edit-drag={FREE_POS_KEYS.visitCard}
              className={
                visitPos
                  ? "absolute"
                  : "max-w-xl mx-auto px-8 sm:px-12"
              }
              style={
                visitPos
                  ? {
                      left: `${visitPos.x * 100}%`,
                      top: `${visitPos.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(560px, 90vw)",
                      width: "100%",
                      padding: "0 1.5rem",
                      textAlign: "center",
                    }
                  : { textAlign: visitStyle.align }
              }
            >
              <p
                data-edit-text
                data-edit-field="visitEyebrow"
                className="sproutly-section-eyebrow text-[10px] tracking-[0.4em] uppercase mb-5"
                style={{ color: eyebrowColor }}
              >
                {visitEyebrow}
              </p>
              <h2
                data-edit-text
                data-edit-field="visitTitle"
                className="text-2xl sm:text-3xl md:text-4xl mb-4"
                style={{
                  color: "var(--store-heading-color, var(--store-text))",
                  fontFamily: "var(--store-font)",
                  fontWeight: "var(--heading-weight, 400)",
                  letterSpacing: "var(--store-heading-track, var(--store-track, -0.01em))",
                  lineHeight: "var(--heading-leading, 1.2)",
                }}
              >
                {visitTitle}
              </h2>
              <div
                className={`${visitDivider} mb-12`}
                style={{
                  width: "32px",
                  height: "1px",
                  background: accentColor,
                  opacity: 0.5,
                }}
              />
              {storeAddress && storeMapsHref && (
                // 地址做成可點連結，手機點下去直接開地圖 App 帶導航，客人不用自己複製貼上。
                // 跟聯絡頁的地址一致（contact/page.tsx），別讓兩頁一個能點一個不能點。
                <a
                  href={storeMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-block hover:opacity-80 transition"
                >
                  <span
                    className="text-base leading-loose border-b border-current pb-0.5"
                    style={{ color: "var(--store-text)" }}
                  >
                    {storeAddress}
                  </span>
                  <span
                    className="block mt-3 text-[10px] tracking-[0.3em] uppercase"
                    style={{ color: accentColor }}
                  >
                    開啟地圖導航 →
                  </span>
                </a>
              )}
              {businessHoursText && (
                <div
                  className="mt-4 text-sm whitespace-pre-line leading-loose"
                  style={{ color: "var(--store-text-muted)" }}
                >
                  {businessHoursText}
                </div>
              )}
              {(store.contact_phone || store.contact_email) && (
                <div
                  className={`mt-10 flex ${visitContactJustify} gap-8 text-sm tracking-wider`}
                  style={{ color: "var(--store-text)" }}
                >
                  {/* 清得出乾淨目標（storePhone=telDigits、storeEmail=cleanEmail，上方結構化
                      資料已算好）才掛 tel:／mailto: 連結；商家填「問我」這種非號碼／非 email 時
                      telHref／mailHref 會退成陽春 "tel:"／"mailto:" 的死連結，這裡改成純文字
                      顯示，字仍露出但不給客人一個點了沒用的連結。同 mapsHref／socialUrl 防呆線。 */}
                  {store.contact_phone && (
                    storePhone ? (
                      <a
                        href={telHref(store.contact_phone)}
                        className="border-b border-current pb-0.5 hover:opacity-70 transition"
                      >
                        {store.contact_phone}
                      </a>
                    ) : (
                      <span className="pb-0.5">{store.contact_phone}</span>
                    )
                  )}
                  {store.contact_email && (
                    storeEmail ? (
                      <a
                        href={mailHref(store.contact_email)}
                        className="border-b border-current pb-0.5 hover:opacity-70 transition"
                      >
                        {store.contact_email}
                      </a>
                    ) : (
                      <span className="pb-0.5">{store.contact_email}</span>
                    )
                  )}
                </div>
              )}
              {theme.layout.mapEmbedUrl && (
                <div
                  className="mt-12 rounded-sm overflow-hidden border"
                  style={{
                    borderColor: theme.border,
                    boxShadow: "var(--sproutly-elev-2)",
                  }}
                >
                  <iframe
                    src={theme.layout.mapEmbedUrl}
                    title="店面地圖"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full aspect-[16/10] block"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </section>
          );
        })()}
      </main>
    </>
  );
}
