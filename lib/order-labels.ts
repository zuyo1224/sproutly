// 訂單 / 付款 / 物流的中文 label 集中管理
// payment_method 用既有 sproutly_orders.payment_method 欄位
// shipping_method 暫時編碼進 sproutly_orders.note 欄位（避免需要 migration），等之後 migration 跑完再 refactor

export type PaymentOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
export type ShippingOption = {
  value: string;
  label: string;
  needsStore?: boolean;
};

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { value: "linepay", label: "LINE Pay" },
  { value: "jkos", label: "街口支付" },
  { value: "credit_card", label: "信用卡（即將推出）", disabled: true },
  { value: "transfer", label: "銀行轉帳" },
  { value: "cod", label: "貨到付款" },
  { value: "in_person", label: "面交付款" },
];

export const SHIPPING_OPTIONS: ShippingOption[] = [
  { value: "cvs_711", label: "7-11 取貨", needsStore: true },
  { value: "cvs_family", label: "全家取貨", needsStore: true },
  { value: "cvs_hilife", label: "萊爾富取貨", needsStore: true },
  { value: "home_delivery", label: "宅配到府" },
  { value: "pickup", label: "店面自取" },
];

// 後台訂單狀態徽章：中文 label + 一組固定色票（amber→blue→purple→emerald→zinc，
// 依「待處理→處理中→已出貨→完成→取消」逐步變化）。店家首頁最近訂單、訂單列表、
// 訂單詳情三處原本各抄一份一模一樣的 {label,color}，改一處顏色（或日後多一個狀態）
// 忘了另外兩處，同一筆單在三個畫面就會配不同色、甚至漏顯示。收成這一份，三頁吃同一個。
// 注意：客人端（會員訂單頁、查訂單頁）用的是較柔的說法（completed「完成」、cancelled
// 「取消」），語氣刻意不同、也不需要色票，那邊維持各自的 label，不共用這份。
export const ORDER_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "待確認", color: "bg-amber-100 text-amber-800" },
  confirmed: { label: "已確認", color: "bg-blue-100 text-blue-800" },
  shipped: { label: "已出貨", color: "bg-purple-100 text-purple-800" },
  completed: { label: "已完成", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "已取消", color: "bg-zinc-100 text-zinc-600" },
};

// 只要中文 label、不要色票的場合（訂單匯出 CSV 的狀態欄寫成中文）從徽章那份直接取
// label，跟畫面同一套字，不另抄一份。
export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ORDER_STATUS_BADGES).map(([value, badge]) => [value, badge.label])
);

// 訂單狀態的「正規順序」單一來源：待確認→已確認→已出貨→已完成→已取消。徽章 Record 的
// key 插入順序就是這個流程順序，從它取出來當 canonical enum。後台四處原本各抄一份同序
// 的狀態集合、只是形狀不同：訂單詳情下拉是 {value,label}[]、訂單列表篩選 chip 是
// {key,label}[]（前面多一顆「全部」）、匯出白名單是純字串陣列、改狀態 server action 的
// 合法值是 Set —— 日後改順序或增刪一個狀態得四處同步，漏一處就出現「下拉能選但匯出
// 篩不到」「列表有 chip 但 action 拒收」這種對不上。收成這一份：純 enum 走 ORDER_STATUSES，
// 要 {value,label} 的下拉走衍生的 ORDER_STATUS_OPTIONS（label 跟徽章同字、不另抄）。
export const ORDER_STATUSES: string[] = Object.keys(ORDER_STATUS_BADGES);

export const ORDER_STATUS_OPTIONS: { value: string; label: string }[] =
  ORDER_STATUSES.map((value) => ({ value, label: ORDER_STATUS_BADGES[value].label }));

// 付款狀態的「正規順序」與中文 label 單一來源：未付款→已付款→已退款。後台與客人端原本
// 各抄一份這三個字——訂單列表的篩選 chip 與文字色標、詳情頁的狀態下拉與藥丸徽章、訂單
// 匯出 CSV、查訂單頁、會員訂單詳情、會員訂單列表的 inline 三元、改狀態 server action 的
// 合法值 Set，逐處重打 {unpaid,paid,refunded}→中文；日後增刪一個付款狀態（例如「部分付款」）
// 得到處同步，漏一處就「下拉能選但匯出空白」「列表有 chip 但 action 拒收」。收成這份：純
// enum 走 PAYMENT_STATUSES、要中文走 PAYMENT_STATUS_LABELS、要 {value,label} 下拉走衍生的
// PAYMENT_STATUS_OPTIONS。注意：列表頁的文字色（text-xxx-700）與詳情頁的藥丸底色
// （bg-xxx-100）是刻意的兩套視覺、不是重複，留在各自頁面，只是 label 改吃這份不另抄。
export const PAYMENT_STATUSES: string[] = ["unpaid", "paid", "refunded"];

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  refunded: "已退款",
};

export const PAYMENT_STATUS_OPTIONS: { value: string; label: string }[] =
  PAYMENT_STATUSES.map((value) => ({ value, label: PAYMENT_STATUS_LABELS[value] }));

// 訂單編號給客人看的短形式：訂單 id 是 UUID（8-4-4-4-12），平常只取最前面那段
// 8 個字當作好念好報的編號（例如 #A1B2C3D4）。後台四處原本寫 split("-")[0]、客人端
// 兩處寫 slice(0,8)，標準 UUID 下結果一樣，但萬一 id 不是正規格式（壞資料、之後換 id
// 規則）兩種寫法就會給出不同編號，同一筆單在後台與客人端對不上。收成這一份：先取
// 第一段、再硬切到最多 8 字，空值也不炸，後台與客人端永遠報同一個編號。不含 # 前綴，
// 由各處自行決定要不要加（有些地方是純編號、有些要 #）。
export function shortOrderId(id: string | null | undefined): string {
  return (id ?? "").split("-")[0].slice(0, 8).toUpperCase();
}

export const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_OPTIONS.map((o) => [o.value, o.label.replace(/（即將推出）/, "")])
);

// 訂單上的付款方式給人看的中文：有方式就查 PAYMENT_LABELS（查不到就原樣顯示，
// 避免壞資料變空白），沒填方式就回 null（讓畫面那一列整個不顯示）。後台訂單詳情、
// 結帳成功頁、查訂單頁、會員訂單詳情四處原本各抄一份同樣的三元（payment_method
// ? PAYMENT_LABELS[m] ?? m : null）；日後改 fallback 行為（例如查不到改顯示「其他」）
// 得四處同步，漏一處同一筆單兩頁付款方式就長得不一樣。收成這一支，四處改吃同一條。
export function paymentMethodLabel(
  method: string | null | undefined
): string | null {
  return method ? (PAYMENT_LABELS[method] ?? method) : null;
}

export const SHIPPING_LABELS: Record<string, string> = Object.fromEntries(
  SHIPPING_OPTIONS.map((o) => [o.value, o.label])
);

// 「這個配送方式要不要填取貨門市」單一來源：直接從 SHIPPING_OPTIONS 的 needsStore 旗標衍生。
// 結帳頁 client 早就用 SHIPPING_OPTIONS.find(...).needsStore 判斷要不要顯示門市欄，但兩個結帳
// 後端（單品 checkout/actions、購物車 cart/checkout/submit）的「超商取貨必須填門市」防呆卻各自
// 硬寫 shippingMethod === "cvs_711" || "cvs_family" || "cvs_hilife"——日後在 SHIPPING_OPTIONS 多
// 加一家超商（例如 OK 超商，needsStore:true），client 會自動顯示門市欄，但這兩個後端不改就不擋，
// 門市變成非必填、空門市單照樣成立。收成這支，三處（client 顯示 + 兩個後端驗證）吃同一條旗標。
export function shippingNeedsStore(method: string | null | undefined): boolean {
  if (!method) return false;
  return SHIPPING_OPTIONS.find((o) => o.value === method)?.needsStore ?? false;
}

// 訂單 note 編碼格式：把物流資訊塞在 note 前面，用標記區隔
// 範例：
// [配送方式] 7-11 取貨
// [取貨門市] 信義門市（XX-123）
//
// 客人實際備註內容...

const SHIPPING_PREFIX_RE = /^\[配送方式\]\s*(.+?)(?:\n\[取貨門市\]\s*(.+?))?(?:\n\n|$)/;

export function encodeShippingIntoNote(
  shippingMethod: string | null,
  storeName: string | null,
  userNote: string | null
): string | null {
  const parts: string[] = [];
  if (shippingMethod && SHIPPING_LABELS[shippingMethod]) {
    parts.push(`[配送方式] ${SHIPPING_LABELS[shippingMethod]}`);
    if (storeName) {
      parts.push(`[取貨門市] ${storeName}`);
    }
  }
  const prefix = parts.join("\n");
  const userPart = (userNote ?? "").trim();
  if (!prefix && !userPart) return null;
  if (!prefix) return userPart;
  if (!userPart) return prefix;
  return `${prefix}\n\n${userPart}`;
}

// 「已出貨」對不同取貨方式意思差很多：超商取貨要客人帶證件去門市拿、
// 店面自取是可以來店裡了、宅配才是真的在路上。共用一句「請耐心等待」會誤導
// 選超商／自取的客人乾等。shippingLabel 是已從 note 解出來的中文（例如「7-11 取貨」）。
export function shippedMessage(
  shippingLabel: string | null,
  storeName: string | null
): string {
  if (shippingLabel?.includes("宅配"))
    return "商品已寄出，宅配會再送到府上，請留意收件";
  if (shippingLabel?.includes("自取")) return "商品備好了，歡迎到店面取貨";
  if (shippingLabel?.includes("取貨"))
    return storeName
      ? `商品正寄往「${storeName}」，到店後會收到取貨通知，記得帶證件去取`
      : "商品正寄往你選的門市，到店後會收到取貨通知，記得帶證件去取";
  return "商品已寄出，請耐心等待";
}

// 一句話告訴客人「現在這個狀態代表什麼、接下來會怎樣」。查訂單頁與會員訂單詳情
// 共用同一套說法，已出貨那步再依取貨方式給對的提醒。cancelled 各頁自行處理。
export function orderStatusMessage(
  status: string,
  shippingLabel: string | null,
  storeName: string | null
): string | null {
  switch (status) {
    case "pending":
      return "店家收到你的訂單了，請等待確認";
    case "confirmed":
      return "店家已確認訂單，正在備貨中";
    case "shipped":
      return shippedMessage(shippingLabel, storeName);
    case "completed":
      return "訂單完成，謝謝你的支持";
    default:
      return null;
  }
}

// 商家平常用 LINE / IG 跟客人接洽，每次訂單進度變了都要手打一段通知給客人。
// 這裡依訂單當下狀態組一段「可直接貼給客人」的訊息，商家一鍵複製照貼即可，
// 不用每次重打、也不會漏講重點（編號 / 品項 / 取貨方式 / 付款提醒）。
// 用語跟查訂單頁、會員訂單頁的 orderStatusMessage / shippedMessage 同一套口徑。
export function customerMessage(input: {
  status: string;
  customerName: string;
  storeName: string;
  shortId: string;
  items: { name: string; quantity: number }[];
  totalText: string;
  shippingLabel: string | null;
  pickupStore: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  trackUrl: string | null;
}): string {
  const {
    status,
    customerName,
    storeName,
    shortId,
    items,
    totalText,
    shippingLabel,
    pickupStore,
    paymentMethod,
    paymentStatus,
    trackUrl,
  } = input;

  const name = customerName?.trim() || "你好";
  const lines: string[] = [];

  // 開場依狀態給對的話（沿用各查訂單頁的說法，只是改成第二人稱、加上店名招呼）
  switch (status) {
    case "pending":
      lines.push(
        `${name} 你好，我是「${storeName}」，收到你的訂單了（編號 #${shortId}），我們確認後會再通知你，謝謝你的訂購！`
      );
      break;
    case "confirmed":
      lines.push(
        `${name} 你好，我是「${storeName}」，你的訂單 #${shortId} 已經確認，正在幫你備貨，謝謝你的等待！`
      );
      break;
    case "shipped":
      lines.push(
        `${name} 你好，我是「${storeName}」，你的訂單 #${shortId} ${shippedMessage(shippingLabel, pickupStore)}。`
      );
      break;
    case "completed":
      lines.push(
        `${name} 你好，我是「${storeName}」，你的訂單 #${shortId} 已經完成，謝謝你的支持，有需要再來找我們！`
      );
      break;
    case "cancelled":
      lines.push(
        `${name} 你好，我是「${storeName}」，你的訂單 #${shortId} 已取消，若有疑問歡迎直接回覆我們。`
      );
      break;
    default:
      lines.push(`${name} 你好，我是「${storeName}」，關於你的訂單 #${shortId}：`);
  }

  // 已取消就不再列品項與付款提醒，免得讓客人以為還要處理
  if (status !== "cancelled") {
    if (items.length > 0) {
      lines.push("");
      lines.push("訂購內容");
      for (const it of items) lines.push(`・${it.name} × ${it.quantity}`);
      lines.push(`合計 ${totalText}`);
    }

    if (shippingLabel) {
      lines.push("");
      lines.push(
        pickupStore
          ? `配送方式：${shippingLabel}（${pickupStore}）`
          : `配送方式：${shippingLabel}`
      );
    }

    // 付款提醒：只在還沒付、且是要客人主動處理的方式時才講，避免多嘴
    if (paymentStatus !== "paid") {
      if (paymentMethod === "transfer")
        lines.push("（這筆是銀行轉帳，匯款後再跟我們說一聲就可以囉）");
      else if (paymentMethod === "cod")
        lines.push("（這筆是貨到付款，取貨時再付款即可）");
      else if (paymentMethod === "in_person")
        lines.push("（這筆是面交付款，碰面時再付款即可）");
      else if (paymentMethod === "linepay" || paymentMethod === "jkos")
        // LINE Pay／街口目前沒接自動金流，收款是商家自己用 LINE Pay 請款 / 街口 QR 處理，
        // 所以這裡只提醒「會再傳付款方式給你」，不寫死「點連結付款」承諾不存在的流程。
        lines.push(`（這筆選${PAYMENT_LABELS[paymentMethod]}，我們會再把付款方式傳給你）`);
    }
  }

  if (trackUrl) {
    lines.push("");
    lines.push(`隨時查訂單進度：${trackUrl}`);
  }

  return lines.join("\n");
}

export function decodeShippingFromNote(note: string | null): {
  shippingLabel: string | null;
  storeName: string | null;
  userNote: string | null;
} {
  if (!note) return { shippingLabel: null, storeName: null, userNote: null };
  const match = note.match(SHIPPING_PREFIX_RE);
  if (!match) return { shippingLabel: null, storeName: null, userNote: note };
  const shippingLabel = match[1] ?? null;
  const storeName = match[2] ?? null;
  const userNote = note.slice(match[0].length).trim() || null;
  return { shippingLabel, storeName, userNote };
}
