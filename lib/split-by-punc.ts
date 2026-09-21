// 中文按全形標點自然分行：切在「，、。！？」後面，標點留在該行尾，行首尾空白去掉、空行丟掉。
//
// 公開頁（app/[slug]/page.tsx）主標／精選開場拿它切完一行一個 <span class="block">；
// 編輯器預覽套 tagline 的 bridge（app/_components/editor-click-bridge.tsx）也要用同一支：
// 以前 bridge 用 textContent 整串塞回去，預覽顯示成一行、存檔重讀後才按標點拆行，
// 編輯時看到的跟存出去的對不上。兩邊共用，切法只寫一次。
export function splitByPunc(s: string): string[] {
  return s
    .split(/(?<=[，、。！？])/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
