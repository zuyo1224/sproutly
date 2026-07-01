// 客人分群的唯一口徑（怎麼把一堆訂單併成「同一個人」）單一來源。
//
// 客人後台的「列表頁」與「匯出 CSV」是同一份客人名單的兩個出口，兩邊都要把訂單
// 併成客人：有登入會員 ID（customer_id）就照會員併；沒有的匿名訂單退回用電話併，
// 連電話都沒有就丟進 "unknown" 這一桶。原本這段分群迴圈在兩處各抄一份逐字相同的，
// export/route 甚至自己註解「與客人列表頁一字不差…刻意複製同一套」。
//
// 兩邊各算各的最怕「對不上」：同一位客人在列表被當成一列、匯出卻被拆成兩列（例如
// 之後有人只在其中一處改了 fallback 規則），或兩份的訂單數 / 總額兜不攏。收成這支後，
// 兩個出口吃同一條分群規則，日後要改「怎麼算同一個人」只改這裡一處。
//
// 只看得到 customer_id 與 customer_phone，所以用泛型收下任何帶這兩個欄位的訂單，
// 原本各自的 OrderRow 型別都能直接套進來、回傳的 Map 也還是原本的訂單型別。

type CustomerGroupable = {
  customer_id: string | null;
  customer_phone: string;
};

// 一筆訂單該歸到哪個客人桶：有會員 ID 用會員、否則退電話、再沒有退 "unknown"。
export function customerGroupKey(order: CustomerGroupable): string {
  return order.customer_id
    ? `account:${order.customer_id}`
    : `guest:${order.customer_phone || "unknown"}`;
}

// 分群 key 是不是「登入會員」（account:）而非匿名訪客（guest:）。列表頁與匯出都要
// 從 key 判斷客人身分，判斷字串 "account:" 也散在兩處，一起收進來當同一份口徑。
export function isAccountGroupKey(key: string): boolean {
  return key.startsWith("account:");
}

// 把訂單清單併成 Map<分群 key, 該客人的所有訂單>，維持原本插入順序。
export function groupOrdersByCustomer<T extends CustomerGroupable>(
  orders: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const order of orders) {
    const key = customerGroupKey(order);
    const arr = groups.get(key) ?? [];
    arr.push(order);
    groups.set(key, arr);
  }
  return groups;
}
