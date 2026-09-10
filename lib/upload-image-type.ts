// 商家在後台選一個檔案上傳時，「這個檔能不能收」與「要用哪個型別存進去」這兩個判斷。
//
// 為什麼要獨立一支：這兩件事原本混在 lib/storage.ts 的 uploadImage 裡，而那支一開頭就
// 連上 Supabase Storage，沒有資料庫與金鑰就跑不起來，等於整段判斷永遠沒被測過。可是
// 判斷錯的後果都落在商家看不見的地方——檔名副檔名擋錯，商家換 logo 時被回一句「格式
// 只支援…」卻不知道自己的檔哪裡不對；存進去的型別寫錯，圖不會壞掉，只會變成客人點
// 商品圖時瀏覽器跳出「下載」而不是把圖顯示出來。所以把純字串進、純字串出的部分搬出來
// 寫死在測試裡，lib/storage.ts 只留真正碰 Storage 的骨架。
//
// 收的副檔名清單維持原樣（jpg / jpeg / png / webp / gif / svg），錯誤訊息也逐字照抄，
// 後台三個選檔框的 accept 各自寫得不一樣是另一件事，這裡不動。

const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "svg"];

export const UNSUPPORTED_IMAGE_ERROR =
  "圖片格式只支援 jpg / png / webp / gif / svg";

// 從檔名取副檔名。不在清單裡回 null（呼叫端據此回 UNSUPPORTED_IMAGE_ERROR）。
//
// 檔名整串是空的時候當 jpg：有些來源（貼上、程式產生的 File）給的 name 是空字串，
// 從第一版起就是這樣放行，維持不變。反過來「photo」這種完全沒有點的檔名不放行，
// 因為那時候拿到的是整個檔名本身，不是副檔名。
export function uploadImageExtension(fileName: string): string | null {
  const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
  return ALLOWED_EXT.includes(ext) ? ext : null;
}

// 存進 Storage 要標的 content type。
//
// 瀏覽器回報的 file.type 優先，但只在它真的是個 image/ 型別時才信：有些系統與
// 拖放來源會給 application/octet-stream 或空字串，照抄進去 Supabase 就會用那個型別把
// 圖吐回來，客人的瀏覽器看到 octet-stream 一律當附件下載，圖就開天窗。這種時候改用
// 副檔名自己推。
export function uploadImageContentType(
  ext: string,
  reportedType: string | null | undefined,
): string {
  const reported = (reportedType ?? "").trim();
  if (reported.toLowerCase().startsWith("image/")) return reported;
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  return `image/${ext}`;
}
