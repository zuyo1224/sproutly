// FormData 取字串欄位的單一來源。
// 七個 server action 檔各自抄「String(formData.get("x") ?? "").trim()」——
// 必填欄位讀完 trim，選填欄位再「|| null」把空字串收成 null。
// 樣板逐字相同只差 key，散在各處，收成這兩個 helper 一起管。

/** 讀一個字串欄位，去頭尾空白；沒有值時回空字串。 */
export function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** 讀一個選填字串欄位，去頭尾空白；空字串收成 null。 */
export function formStringOrNull(formData: FormData, key: string): string | null {
  return formString(formData, key) || null;
}
