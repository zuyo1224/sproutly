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

export const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_OPTIONS.map((o) => [o.value, o.label.replace(/（即將推出）/, "")])
);

export const SHIPPING_LABELS: Record<string, string> = Object.fromEntries(
  SHIPPING_OPTIONS.map((o) => [o.value, o.label])
);

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
