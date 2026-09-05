// Google Maps 嵌入網址 helper，跟 contact-href 的 socialUrl / mapsHref 同一條防呆線。
//
// 視覺編輯器「來店」區段那格要商家貼 Google Maps「分享 → 嵌入地圖」給的網址，公開頁
// 首頁來訪區與聯絡頁把它直接掛成 <iframe src>。iframe 的 src 想掛什麼網站都行，所以
// 只准 google.com/maps/embed 開頭的，其餘（別的網站、javascript:、亂填）一律不收。
//
// 商家最常填錯的兩種：
//   1. Google 那個對話框預設給的是整段 <iframe src="…" width=…></iframe> HTML，按「複製
//      HTML」貼過來的就是這一整串。以前存檔端一看不是 https://google.com/maps/embed 開頭
//      就整串丟掉，商家其實貼對了、只是多了外面那層標籤。這裡把 src="…" 裡的網址挖出來
//      （HTML 屬性裡的 &amp; 還原成 &），挖出來是好網址就照收。
//   2. 貼成「分享 → 複製連結」的 https://maps.app.goo.gl/… 或網址列的 google.com/maps/place/…。
//      這兩種不是嵌入網址、掛進 iframe 會被 Google 拒絕顯示，一樣回 null。
//
// 存檔端（editor/actions.ts）、讀取端（app/[slug]/_theme.ts 的 resolveTheme）、編輯器
// 輸入框的即時提示三邊共用這一支，判斷標準只有一份；讀取端也過一次是為了保護更早
// 存進 DB 的舊資料，公開頁永遠只掛得出白名單內的網址。
export const MAX_MAP_EMBED_URL_LEN = 1000;

const EMBED_URL_RE = /^https:\/\/(www\.)?google\.com\/maps\/embed/i;

// 從整段 <iframe …> HTML 挖出 src 的值；不是 iframe 標籤就原樣回傳。
function extractIframeSrc(raw: string): string {
  if (!/<iframe\b/i.test(raw)) return raw;
  const m = raw.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const src = m?.[1] ?? m?.[2];
  if (!src) return raw;
  // HTML 屬性裡的 & 會被寫成 &amp;，還原後才是真正的網址
  return src.replace(/&amp;/gi, "&");
}

// 回傳可以直接掛進 iframe 的嵌入網址；空字串、不是嵌入網址、或超長的一律回 null。
export function cleanMapEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const candidate = extractIframeSrc(raw.trim()).trim();
  if (!candidate || candidate.length > MAX_MAP_EMBED_URL_LEN) return null;
  return EMBED_URL_RE.test(candidate) ? candidate : null;
}
