// 兩個顏色的對比（WCAG 相對亮度那套），用來判斷「這個顏色壓在那個底色上還看不看得見」。
//
// 為什麼需要：全站主色（accent）是配著全站底色挑的一個要跳出來的顏色，但商家可以把
// 單一區段換成任意底色。換成跟主色相近的底色時，那一段裡所有用主色畫的東西（小標
// eyebrow、標題底下那截短線、常見問題的＋）等於消失在底色裡——不是壞掉，是看不見，
// 商家只會覺得這段怎麼怪怪的，不會知道是哪個設定造成的。
//
// 判斷交給算的，不交給商家再挑一次顏色：多一個要挑的值，挑錯（挑到跟底色同色）就又
// 回到看不見。只在算出來真的不夠時才換掉，夠的段落一個像素都不動。
import { normalizeHexColor } from "./hex-color";

// sRGB 單一通道轉線性值（WCAG 2.x 的 relative luminance 定義）。
function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// 相對亮度 0（純黑）～ 1（純白）。認不得的色碼回 null，呼叫端當「算不出來」處理，
// 不要硬給一個數字——算不出來就別動商家的顏色，比猜一個然後亂換好。
export function relativeLuminance(color: unknown): number | null {
  const hex = normalizeHexColor(color);
  if (!hex) return null;
  const r = channelToLinear(parseInt(hex.slice(1, 3), 16));
  const g = channelToLinear(parseInt(hex.slice(3, 5), 16));
  const b = channelToLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// 對比值 1（兩色相同）～ 21（黑白）。任一色算不出亮度就回 null。
export function contrastRatio(a: unknown, b: unknown): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// 「圖形與介面元件」這類非內文元素的對比下限（WCAG 1.4.11 非文字對比）。主色在區段裡
// 畫的多半是這種東西：一截短線、一個點、一個＋、幾個字的小標。低於這個值就當看不見。
export const NON_TEXT_CONTRAST_MIN = 3;
