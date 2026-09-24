// 選照片預覽底下那行檔案大小（image-file-picker）。以前寫在元件裡：先看 bytes 滿不滿
// 1 MB，沒滿就 Math.round(bytes / 1024) 當 KB。問題在邊界：1023.5 KB～差 1 byte 到 1 MB
// 這一段（1,048,064～1,048,575 bytes）會四捨五入成「1024 KB」，商家看到的是一個不該
// 出現的單位寫法，下一張剛好 1 MB 的又顯示「1.0 MB」，兩張幾乎一樣大卻像差很多。
// 改成先算出 KB 取整，取整後滿 1024 才換成 MB，邊界那段一律顯示「1.0 MB」。
// 其餘照舊：不到 1 KB 的算 1 KB（不顯示 0 KB）、MB 取一位小數。
export function formatFileSize(bytes: number): string {
  const kb = Math.max(1, Math.round(bytes / 1024));
  if (kb < 1024) return `${kb} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
