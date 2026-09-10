// 商家在後台選一個檔案上傳時，「這個檔能不能收」與「要用哪個型別存進去」這兩個判斷。
//
// 為什麼要獨立一支：這兩件事原本混在 lib/storage.ts 的 uploadImage 裡，而那支一開頭就
// 連上 Supabase Storage，沒有資料庫與金鑰就跑不起來，等於整段判斷永遠沒被測過。可是
// 判斷錯的後果都落在商家看不見的地方——檔名副檔名擋錯，商家換 logo 時被回一句「格式
// 只支援…」卻不知道自己的檔哪裡不對；存進去的型別寫錯，圖不會壞掉，只會變成客人點
// 商品圖時瀏覽器跳出「下載」而不是把圖顯示出來。所以把純字串進、純字串出的部分搬出來
// 寫死在測試裡，lib/storage.ts 只留真正碰 Storage 的骨架。
//
// 收的副檔名清單維持原樣（jpg / jpeg / png / webp / gif / svg），錯誤訊息也逐字照抄。
// 後台三個選檔框「打開檔案總管時預先篩掉哪些檔」的清單也收在這裡（見檔尾兩個常數），
// 免得選檔框放行的範圍跟這支收的範圍各說各話。

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

// 後台選檔框（<input type="file"> 的 accept）要預先篩出哪些檔。
//
// 為什麼收成常數：這串以前三個地方各寫各的，logo 那格是 jpeg/png/webp/svg、hero 那格是
// jpeg/png/webp、商品照那格是 jpeg/png/webp/gif，三種寫法沒有一種對得上上面真正收的六種。
// 差在哪不會噴錯，只會讓商家在檔案總管裡看到自己的圖是灰的、以為這站不吃這種格式——
// 但那個檔其實送得上去（選檔框的 accept 只是預設篩選，切成「所有檔案」照樣選得到，
// 而後端 uploadImageExtension 本來就放行）。
//
// 為什麼分兩串而不是統一成一串：差別只在 svg，而這是渲染端的真實限制，不是隨手寫的。
//   - logo 在店面 header 是用原生 <img> 掛的，svg 直接顯示得出來，向量圖對小尺寸 logo
//     反而最清楚，所以 logo 那格留著 svg。
//   - hero 大圖與商品照走 next/image 的圖片最佳化（/_next/image）。next.config.mjs 沒有開
//     dangerouslyAllowSVG，最佳化那關拿到 image/svg+xml 會直接回錯，商家看到的是一個破圖框，
//     而且錯在公開頁、後台完全看不出來。所以照片那兩格不把 svg 端出來讓商家選。
// 兩串都補上了 gif：後端本來就收，只有 logo 與 hero 兩格漏列。
export const LOGO_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";

export const PHOTO_FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
