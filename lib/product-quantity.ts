// 一筆商品「買幾件」的合法範圍，全站只認這一份。
//
// 以前這個 1-99 的上下限散在很多地方各抄一份：購物車 client（夾值）、單品結帳頁
// （夾值）、兩個結帳後端（驗證拒絕）、商品詳情頁與購物車頁的數量選擇器（卡上限），
// 每處都直接打死 99 這個數字、有的還連 1 一起硬寫。日後要改範圍（例如放寬到 999、
// 或某些店想限購），就得一處一處找、漏一處就「選得到的數量結帳後端卻拒收」。
//
// 收進這份：
// - QTY_MIN / QTY_MAX：唯一的上下限來源。
// - isValidQty：後端「不信任前端傳來的數量」用的驗證——必須是落在範圍內的整數，
//   兩個結帳後端原本各自寫的 `!Number.isInteger(x) || x < 1 || x > 99` 就是這條，
//   收成同一份、輸出零變化。
export const QTY_MIN = 1;
export const QTY_MAX = 99;

// 後端驗證：qty 必須是 QTY_MIN-QTY_MAX 的整數。Number.isInteger 同時擋掉
// NaN／小數／非數字，範圍再卡掉負數與超量。前端被改成 qty: -5 之類就會被這層擋下。
export function isValidQty(qty: unknown): qty is number {
  return Number.isInteger(qty) && (qty as number) >= QTY_MIN && (qty as number) <= QTY_MAX;
}
