// 「客人填的電話」的比對口徑。
//
// 訂單上的 customer_phone 存的是客人下單當下打的原文：「0912-345-678」
// 「0912 345 678」「+886912345678」甚至全形「０９１２…」都有可能。查訂單頁
// 拿客人事後輸入的電話做完全字面比對時，同一支號碼只要兩次打的格式不同就對不上，
// 客人拿著正確的編號＋電話也會被告知查無訂單。
//
// 這裡把電話轉成「可比對的數字串」：全形數字轉半形 → 只留數字 → 台灣國碼
// 886 開頭還原成本地的 0 開頭（+886912… 和 0912… 是同一支）。台灣本地號碼
// 一律 0 開頭，數字串會以 886 起頭的只有帶國碼這種寫法，不會誤傷正常號碼。
//
// 跟 lib/contact-href 的 splitPhone 不同用途：那邊清的是「商家填的電話」要拿去
// 撥號（tel: href）與餵 Google，得處理分機；這邊是「兩支客人電話是不是同一支」
// 的比對，客人的手機號碼沒有分機問題，只需要數字等值。
export function phoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  const half = phone.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  let digits = half.replace(/\D/g, "");
  // 從國外撥回台灣的寫法「00886…」：開頭的 00 是國際冠碼，去掉後跟 +886 同一種。
  // 台灣本地號碼不會 00 開頭（00 本身就是國際冠碼），不會誤傷正常號碼。
  if (digits.startsWith("00886")) digits = digits.slice(2);
  if (digits.startsWith("886")) {
    digits = digits.slice(3);
    // 「+886 (0)912-345-678」「+886-0912…」這種國碼後面又留著本地開頭 0 的寫法很常見，
    // 以前一律再補一個 0，變成「00912…」跟客人另一次打的「0912…」對不上，查訂單頁
    // 拿正確的編號＋電話也查無訂單。國碼後面不會接 0，有就是那個本地 0，別重補。
    if (!digits.startsWith("0")) digits = "0" + digits;
  }
  return digits;
}

// 兩支電話是不是同一支。任一邊清完連一個數字都沒有就算不同——
// 空字串對空字串不能算相符，否則沒填電話的訂單會被空查詢撈到。
export function samePhone(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const da = phoneDigits(a);
  return da !== "" && da === phoneDigits(b);
}
