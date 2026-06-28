// 商品「是否售完」與「售完沉底」排序的共用判斷。
//
// 以前各頁（首頁精選、shop 逛街、商品詳情的「店裡其他」、收藏頁、Cmd+K 搜尋）
// 各自抄一份 `stock !== null && stock === 0` 來判斷售完，shop 與商品詳情還各抄
// 一份「把售完那批推到最後」的 sort comparator。同一個概念散在六七處、又各寫各的，
// 哪天「缺貨」定義要改（例如改成「stock <= 0」連負庫存也算）就得每頁追著改、一漏就不一致。
// 集中成一份後，全站對「缺貨」的定義與「售完沉底」的排序保證走同一條路徑。
// 這跟 format-price、json-ld、contact-href 把重複邏輯收成單一來源是同一個出發點。
//
// stock 語意：null = 商家沒在管這項的庫存（永遠當有貨）；> 0 = 還有貨；
// <= 0 = 售完。0 是明講賣光；負數是資料壞掉或併發扣庫存「超賣」扣到負的，
// 客人一樣買不到，當售完處理才安全（別讓客人去點一個其實沒貨的）。
// 這條「<= 0 算售完」跟 availability-schema 的 availabilityForSchema 同一套——
// 那邊本來就把負數判 OutOfStock 餵給 Google，這邊以前只認 === 0，於是負庫存商品
// 會「對 Google 標售完、畫面卻顯示有貨又不沉底」兩端對不上。收成這一份單一定義後，
// 結構化資料與畫面的缺貨判斷保證走同一條路徑（availabilityForSchema 直接呼叫這支）。
export function isSoldOut(stock: number | null | undefined): boolean {
  return stock != null && stock <= 0;
}

// 把售完的整批沉到清單最後，有貨的維持原本的相對順序。
// JS Array.sort 自 ES2019 起保證穩定（同組元素相對順序不變），所以這個 comparator
// 套在「已經排好序」的清單上（例如已照 created_at 倒序或價格排好），只會把售完那群
// 整批往下挪，不會打亂同一組內原本的順序。各頁逛街優先看到買得到的，不用略過沒貨的。
export function bySoldOutLast<T extends { stock: number | null }>(a: T, b: T): number {
  return Number(isSoldOut(a.stock)) - Number(isSoldOut(b.stock));
}
