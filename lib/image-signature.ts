// 看檔案開頭幾個 byte，判斷這份內容「真的」是哪一種圖片。
//
// 為什麼要有這支：上傳圖片以前只看檔名結尾（lib/upload-image-type 的 uploadImageExtension），
// 而檔名是商家的電腦說了算。實際會撞到的兩種情況——
//   1. iPhone 拍的 HEIC 照片經過 LINE、AirDrop 或改名之後叫 xxx.jpg，內容還是 HEIC。
//      以前這種檔照樣被收下、標成 image/jpeg 存進去，結果客人在商品頁看到的是破圖框，
//      而且後台完全看不出來，只有客人會撞到。
//   2. 從 IG、網頁另存下來的圖，副檔名寫 .jpg 內容其實是 webp（或反過來）。這種瀏覽器
//      大多會自己認出來顯示，但存進去的型別跟路徑結尾都是錯的，next/image 那關遇到
//      型別對不上也不保證每次都救得回來。
// 兩種都只有看內容才分得出來，所以這裡認的是內容本身的簽名，不是檔名。
//
// 只認站上收的五種格式（jpeg / png / webp / gif / svg）。認不出來一律回 null，由呼叫端決定
// 怎麼回商家；這裡不猜「大概是什麼」。

export type ImageSignature = "jpeg" | "png" | "webp" | "gif" | "svg";

// svg 是純文字，沒有固定的開頭 byte，只能讀開頭一小段文字找 <svg 標籤。
// 讀多少：實際的 svg 在 <?xml …?>、<!DOCTYPE …>、註解之後就會出現 <svg，1024 byte 綽綽有餘；
// 讀太多反而讓一份 html 裡面剛好夾著 <svg> 的檔被誤認。
const SVG_PROBE_BYTES = 1024;

function startsWith(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  if (bytes.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (bytes[offset + i] !== expected[i]) return false;
  }
  return true;
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export function sniffImageType(bytes: Uint8Array): ImageSignature | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "gif";
  // webp 是 RIFF 容器：前四 byte "RIFF"、接四 byte 檔案長度、再來四 byte "WEBP"。
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (looksLikeSvg(bytes)) return "svg";
  return null;
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  // 有些編輯器存出來的 svg 開頭帶 UTF-8 BOM（EF BB BF），先跳過。
  const start = startsWith(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  const head = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(start, start + SVG_PROBE_BYTES),
  );
  const text = head.trimStart();
  // 必須是以標籤開頭的文字檔，而且開頭這段裡要真的出現 <svg 標籤。
  if (!text.startsWith("<")) return false;
  return /<svg[\s>]/i.test(text);
}
