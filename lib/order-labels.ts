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
