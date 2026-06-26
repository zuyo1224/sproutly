// 結構化資料（JSON-LD）安全內嵌 helper。
//
// 我們把 Store / FAQPage / Product 等結構化資料用
// <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
// 直接寫進頁面，餵給 Google。問題是這份 data 裡的 name / description / FAQ 答案 / 商品說明
// 全是商家在後台自由打的字，JSON.stringify 不會幫忙處理「這串字最後是嵌在 HTML <script> 裡」。
//
// 只要商家在描述裡打了「</script>」這幾個字（貼了一段教學、示範 HTML、或單純亂打），
// 瀏覽器在解析 HTML 時會在那裡就把 <script> 標籤關掉 —— 後面的 JSON 變成裸露在頁面上的
// 文字，整段結構化資料壞掉餵不到 Google，更糟的是 </script> 之後的內容會被當成新的 HTML
// 解析，等於開了一個讓商家內容（或被串改的資料）注入頁面的洞。
//
// 標準解法：把組好的 JSON 字串裡對 HTML 有意義的字元改寫成等效的 \uXXXX escape。
// JSON 解析器看到 < 還原成 "<"，語意完全不變；但瀏覽器的 HTML 解析器看到的是
// 「反斜線 u 0 0 3 c」這幾個普通字元，不會誤判成標籤邊界。
//   <  → <   （擋掉 </script> 與任何標籤開頭）
//   >  → >   （順手擋掉 ]]> 之類）
//   &  → &   （擋掉 HTML 實體被二次解讀）
// 另外 U+2028 / U+2029（行分隔、段分隔）在 JSON 字串裡合法，但在 <script> 內被當成換行，
// 會讓 JSON 變成語法錯誤，一併 escape 掉。
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
