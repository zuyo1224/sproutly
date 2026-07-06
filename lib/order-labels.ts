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

// 客人端的訂單狀態說法：刻意比後台 ORDER_STATUS_BADGES 更柔（pending 寫成「待店家確認」
// 而非後台的「待確認」、completed/cancelled 去掉「已」字只留「完成」「取消」），語氣站在
// 客人角度、也不配後台那套 amber/red 硬色票（客人頁吃店家自訂 theme，顏色另由各頁依
// accent 決定）。會員訂單列表頁與會員訂單詳情頁原本各抄一份逐字相同的這份 Record，
// 日後改一個字（例如 pending 想改「等待店家確認中」）漏一頁，同一筆單在列表與詳情就長
// 不一樣。收成這一份，兩頁吃同一個；查不到狀態時各頁自行 `?? order.status` 原樣顯示。
export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  pending: "待店家確認",
  confirmed: "已確認",
  shipped: "已出貨",
  completed: "完成",
  cancelled: "取消",
};

// 客人端訂單進度條的「正常四步流程」單一來源：待店家確認→已確認→已出貨→完成。順序就是
// CUSTOMER_STATUS_LABELS 的 key 插入順序去掉不在這條線上的 cancelled（已取消不畫進度條、
// 各頁另外處理）。查訂單頁與會員訂單詳情頁原本各自硬寫一份四步陣列、連 label 都各打各的：
// 同一個 pending，一邊寫「待店家確認」另一邊寫「待確認」；同一個 confirmed，一邊「店家已確認」
// 另一邊「已確認」。最明顯的破綻是會員訂單詳情頁——它頁首狀態大標吃 CUSTOMER_STATUS_LABELS
// 顯示「待店家確認」，底下進度條卻吃自己那份硬寫的「待確認」，同一筆單同一頁兩個字。收成這份：
// 兩頁的步驟順序走 CUSTOMER_STATUS_FLOW、每步 label 一律從 CUSTOMER_STATUS_LABELS 取，從此
// 大標與進度條同字、兩頁也同字。各頁的視覺（圓圈號碼／連接線／顏色／字級）仍各自決定，不共用。
export const CUSTOMER_STATUS_FLOW: string[] = Object.keys(CUSTOMER_STATUS_LABELS).filter(
  (key) => key !== "cancelled"
);

// 「進行中 / 還在跑的訂單」單一來源：待店家確認、已確認、已出貨——也就是客人進度條那條線
// （CUSTOMER_STATUS_FLOW）扣掉終點「完成」。會員中心首頁「追蹤中」計數用 .in() 查這幾個狀態、
// 訂單歷史頁「追蹤中」標題用 .filter 數這幾個狀態，原本兩處各自硬列 pending/confirmed/shipped
// （一處三個 ===、一處字串陣列），兩段註解還互相點名「同一套口徑」——日後流程多一個狀態
// （例如 packing）忘了同步，首頁數的跟歷史頁數的就對不上。收成這份：要陣列查詢走
// ACTIVE_ORDER_STATUSES、要逐筆判斷走 isOrderActive，口徑只剩一處。已完成 / 已取消都不算進行中。
export const ACTIVE_ORDER_STATUSES: string[] = CUSTOMER_STATUS_FLOW.filter(
  (key) => key !== "completed"
);

export function isOrderActive(status: string | null | undefined): boolean {
  return status != null && ACTIVE_ORDER_STATUSES.includes(status);
}

// 「這筆單商家還沒處理」單一來源：狀態剛好是流程第一步 pending（待確認）。後台原本五處
// 各自硬寫 o.status === "pending"——首頁跨店未處理計數、店家首頁待確認數與最近訂單的
// isPending、訂單列表卡片版與表格版的 needsAction，逐處重打同一個字串字面值。日後若把
// 「待確認」的 value 改名（例如 pending 改 awaiting），或多一個同樣算「待商家處理」的狀態，
// 這五處得同步，漏一處就「首頁紅點數的跟訂單列表上色的對不上」。收成這支，五處吃同一條口徑。
export function isPendingOrder(status: string | null | undefined): boolean {
  return status === "pending";
}

// 「這筆單的錢收到了嗎 / 還沒收」單一來源：逐筆看 payment_status。後台原本把
// paymentStatus === "paid" 這個原子述詞散在八處各自硬寫——跨店首頁總營收累加
// （dashboard/page.tsx）、店家首頁總營收/月營收/14 天趨勢/「來自 N 筆」與客人列表、
// 客人匯出的已付款筆數、訂單列表的已收金額，逐處重打同一個字串字面值；「還沒收」
// （=== "unpaid"）也散在店家首頁應收與訂單列表未付款兩處。日後把付款狀態的 value
// 改名（例如 paid 改 settled）、或多一個同樣算「已收到錢」的狀態，這些地方得同步，
// 漏一處就「首頁營收算的跟訂單列表已收算的對不上」。收成這兩支，逐筆判斷吃同一條口徑。
// 注意：多數呼叫端還會 && o.status !== "cancelled"（只算未取消的單），那條篩選各處
// 自己保留、不併進來；這裡只管「收沒收到錢」這一個原子問題。改狀態 server action
// （actions.ts）裡的 paymentStatus === "paid"/"unpaid" 是判斷「這次要寫進去的值」以決定
// 蓋不蓋 paid_at 時間章、語意不同（比照 isPendingOrder 不收 action 的 guard），刻意不收。
export function isPaidOrder(status: string | null | undefined): boolean {
  return status === "paid";
}

export function isUnpaidOrder(status: string | null | undefined): boolean {
  return status === "unpaid";
}

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

// 「這個付款方式現在可以選嗎」單一來源：要在 PAYMENT_OPTIONS 名單上、而且沒被標 disabled。
// 兩個結帳後端（單品 checkout/actions、購物車 cart/checkout/submit）原本拿 PAYMENT_LABELS
// 當合法值白名單，但那份是給「顯示」用的——連停用中的「信用卡（即將推出）」都在裡面
// （舊訂單要能顯示中文），結果結帳頁把信用卡 radio 設了 disabled，後端卻照樣放行：
// 只要繞過畫面直接送 payment_method=credit_card，訂單就用一個根本還沒開通的金流成立，
// 成功頁／後台還把它顯示成正常的「信用卡」，店家收單後才發現收不到錢。驗證改吃這支，
// PAYMENT_LABELS 回歸純顯示用途（查舊單、壞資料 fallback 都不受影響）。
export function isSelectablePaymentMethod(
  method: string | null | undefined
): boolean {
  if (!method) return false;
  const opt = PAYMENT_OPTIONS.find((o) => o.value === method);
  return opt !== undefined && !opt.disabled;
}

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

// 剛下完單「付款這邊接下來要做什麼」的一句話：結帳成功頁原本不分方式一律講「會盡快
// 聯絡你確認付款方式」，但客人結帳時早就選好了——選貨到付款／面交的不用等店家聯絡、
// 到時再付就好；選轉帳的最想知道「要不要先匯、帳號哪來」；一句籠統話讓前者白等、
// 後者多問一輪。依已選方式給對的下一步，說法跟後台一鍵複製訊息（customerMessage）
// 的付款提醒同一套口徑，只是那邊是店家第一人稱（「我們會…」）、這邊是平台替店家講
// （「店家會…」）。沒填方式或不認得的值回 null，由頁面用原本那句籠統話兜底，壞資料
// 不會變成空白。
export function paymentNextStepMessage(
  method: string | null | undefined
): string | null {
  switch (method) {
    case "transfer":
      return "這筆選了銀行轉帳，店家會再把匯款帳號傳給你，匯款後回覆一聲就可以";
    case "cod":
      return "這筆是貨到付款，取貨時再付款就可以，店家確認後會安排出貨";
    case "in_person":
      return "這筆是面交付款，碰面時再付款就可以，店家確認後會跟你聯絡";
    case "linepay":
    case "jkos":
      // LINE Pay／街口目前沒接自動金流（同 customerMessage 那段的緣由），
      // 只承諾「店家會再把付款方式傳給你」，不寫死不存在的付款連結流程。
      return `這筆選了${PAYMENT_LABELS[method]}，店家會再把付款方式傳給你`;
    default:
      return null;
  }
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

// 「配送方式決定哪個欄位必填」單一來源：超商取貨要填門市名稱、宅配到府要填收件地址。
// 兩個結帳後端（單品 checkout/actions、購物車 cart/checkout/submit）原本各抄一份這兩條
// 防呆、連「超商取貨必須填取貨門市名稱」「宅配必須填收件地址」兩句錯誤訊息都逐字重打，
// 宅配那條還各自硬寫 method === "home_delivery"。日後改一句訊息、或多一種要地址的配送
// 方式，得兩個後端同步，漏一處兩條結帳路徑就驗得不一樣、甚至一邊放空門市單過。收成這支：
// 有該擋的就回傳對應錯誤訊息、都合格回 null，由單品頁包成 redirect、購物車頁包成 JSON 400，
// 驗證規則只剩一處。門市必填沿用 shippingNeedsStore 的旗標，宅配必填集中認 home_delivery。
export function shippingDetailError(
  method: string | null | undefined,
  storeName: string | null | undefined,
  address: string | null | undefined
): string | null {
  if (shippingNeedsStore(method) && !storeName) return "超商取貨必須填取貨門市名稱";
  if (method === "home_delivery" && !address) return "宅配必須填收件地址";
  return null;
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
      // 已取消的單下面整段品項／付款提醒都不列（見 status !== "cancelled" 那個 guard），
      // 連帶「款項已退還」那句也被跳過——取消單偏偏最常伴隨退款，客人收到的訊息是
      // 推播式的（不像成功頁／查訂單頁有付款狀態列可自己看），一句「已取消」就結束，
      // 客人第一個想問的還是錢。已退款的取消單在開場句就講明錢退了，口徑同
      // 未取消退款單那句「款項已退還給你」。
      lines.push(
        `${name} 你好，我是「${storeName}」，你的訂單 #${shortId} 已取消，${
          paymentStatus === "refunded" ? "款項已退還給你，" : ""
        }若有疑問歡迎直接回覆我們。`
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

    // 付款提醒：只在還沒付（unpaid）、且是要客人主動處理的方式時才講，避免多嘴。
    // 口徑同客人端三頁的 isUnpaidOrder——已退款（refunded）的單不能再催匯款，
    // 反面邏輯（!== "paid"）會把退款單也算進去，對一筆錢已退回的單叫客人去付款。
    if (isUnpaidOrder(paymentStatus)) {
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
    } else if (paymentStatus === "refunded") {
      // 退款單不催款之外也不能默不作聲：客人看到訊息第一個想問的就是錢，
      // 主動講一句，口徑同結帳成功頁的「款項已退還」。
      lines.push("（這筆的款項已退還給你，如有疑問再跟我們說一聲）");
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
