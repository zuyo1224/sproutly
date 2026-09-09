// lib/order-labels.ts 訂單／付款／物流口徑的行為固定測試。
//
// 為什麼要有這份：這支是後台與客人端十幾處共用的單一來源——狀態順序、往前推一格、
// 進行中判斷、付款方式白名單、配送必填欄位、note 的物流編碼、給客人的狀態說明與
// 一鍵複製訊息。改壞了不噴錯，只在畫面上安靜出事：狀態順序錯一格「確認」按鈕會直接跳
// 出貨；白名單放鬆一個停用中的信用卡就能繞過畫面成單；note 編碼與解碼對不上，取貨門市
// 會被當成客人備註；退款單多一句催款話客人會以為錢沒退。這裡把這些邊界逐條寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_ORDER_STATUSES,
  CUSTOMER_STATUS_FLOW,
  CUSTOMER_STATUS_LABELS,
  ORDER_ADVANCE_FLOW,
  ORDER_ADVANCE_VERBS,
  ORDER_STATUS_BADGES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  ORDER_STATUSES,
  PAYMENT_LABELS,
  PAYMENT_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_STATUSES,
  SHIPPING_LABELS,
  SHIPPING_OPTIONS,
  customerMessage,
  decodeShippingFromNote,
  encodeShippingIntoNote,
  isOrderActive,
  isPaidOrder,
  isPendingOrder,
  isSelectablePaymentMethod,
  isUnpaidOrder,
  nextOrderStatus,
  orderStatusMessage,
  paymentMethodLabel,
  paymentNextStepMessage,
  shippedMessage,
  shippingDetailError,
  shippingNeedsStore,
  shortOrderId,
} from "./order-labels.ts";

describe("訂單狀態順序與衍生集合", () => {
  it("正規順序是 待確認→已確認→已出貨→已完成→已取消", () => {
    assert.deepEqual(ORDER_STATUSES, [
      "pending",
      "confirmed",
      "shipped",
      "completed",
      "cancelled",
    ]);
  });

  it("ORDER_STATUS_LABELS 每個 key 都對到徽章同一個字", () => {
    for (const key of ORDER_STATUSES) {
      assert.equal(ORDER_STATUS_LABELS[key], ORDER_STATUS_BADGES[key].label);
    }
    assert.deepEqual(Object.keys(ORDER_STATUS_LABELS), ORDER_STATUSES);
  });

  it("下拉選項順序與 label 跟徽章一致", () => {
    assert.deepEqual(
      ORDER_STATUS_OPTIONS.map((o) => o.value),
      ORDER_STATUSES
    );
    for (const o of ORDER_STATUS_OPTIONS) {
      assert.equal(o.label, ORDER_STATUS_BADGES[o.value].label);
    }
  });

  it("每個徽章都有非空 label 與含 bg- 與 text- 的色票", () => {
    for (const key of ORDER_STATUSES) {
      const badge = ORDER_STATUS_BADGES[key];
      assert.ok(badge.label.length > 0, key);
      assert.match(badge.color, /\bbg-/);
      assert.match(badge.color, /\btext-/);
    }
  });

  it("往前推的線是扣掉已取消的四步，順序不變", () => {
    assert.deepEqual(ORDER_ADVANCE_FLOW, [
      "pending",
      "confirmed",
      "shipped",
      "completed",
    ]);
  });

  it("推進線上除了第一步之外每一步都有按鈕動詞，且動詞不是徽章的「已 X」", () => {
    for (const key of ORDER_ADVANCE_FLOW.slice(1)) {
      assert.ok(ORDER_ADVANCE_VERBS[key], key);
      assert.notEqual(ORDER_ADVANCE_VERBS[key], ORDER_STATUS_BADGES[key].label);
      assert.ok(!ORDER_ADVANCE_VERBS[key].startsWith("已"), key);
    }
    assert.equal(ORDER_ADVANCE_VERBS.pending, undefined);
    assert.equal(ORDER_ADVANCE_VERBS.cancelled, undefined);
  });
});

describe("nextOrderStatus", () => {
  it("照流程往前一格", () => {
    assert.equal(nextOrderStatus("pending"), "confirmed");
    assert.equal(nextOrderStatus("confirmed"), "shipped");
    assert.equal(nextOrderStatus("shipped"), "completed");
  });

  it("已完成走到底、已取消不在線上、不認得的值、空值都回 null", () => {
    assert.equal(nextOrderStatus("completed"), null);
    assert.equal(nextOrderStatus("cancelled"), null);
    assert.equal(nextOrderStatus("packing"), null);
    assert.equal(nextOrderStatus(""), null);
    assert.equal(nextOrderStatus(null), null);
    assert.equal(nextOrderStatus(undefined), null);
  });

  it("對每一步連續推進，最後一定停在 completed 而不是 cancelled", () => {
    let s: string | null = "pending";
    const walked: string[] = [];
    while (s) {
      walked.push(s);
      s = nextOrderStatus(s);
    }
    assert.deepEqual(walked, ORDER_ADVANCE_FLOW);
  });
});

describe("客人端狀態集合", () => {
  it("CUSTOMER_STATUS_LABELS 的 key 跟後台 ORDER_STATUSES 完全同一組", () => {
    assert.deepEqual(Object.keys(CUSTOMER_STATUS_LABELS), ORDER_STATUSES);
  });

  it("客人端說法比後台柔：pending 寫「待店家確認」、完成／取消不帶「已」", () => {
    assert.equal(CUSTOMER_STATUS_LABELS.pending, "待店家確認");
    assert.equal(CUSTOMER_STATUS_LABELS.completed, "完成");
    assert.equal(CUSTOMER_STATUS_LABELS.cancelled, "取消");
  });

  it("進度條四步就是後台推進線同一序列", () => {
    assert.deepEqual(CUSTOMER_STATUS_FLOW, ORDER_ADVANCE_FLOW);
  });

  it("進行中 = 進度條扣掉終點完成", () => {
    assert.deepEqual(ACTIVE_ORDER_STATUSES, ["pending", "confirmed", "shipped"]);
  });
});

describe("isOrderActive／isPendingOrder", () => {
  it("待確認、已確認、已出貨算進行中；完成、取消、空值不算", () => {
    assert.equal(isOrderActive("pending"), true);
    assert.equal(isOrderActive("confirmed"), true);
    assert.equal(isOrderActive("shipped"), true);
    assert.equal(isOrderActive("completed"), false);
    assert.equal(isOrderActive("cancelled"), false);
    assert.equal(isOrderActive(null), false);
    assert.equal(isOrderActive(undefined), false);
    assert.equal(isOrderActive(""), false);
  });

  it("isOrderActive 逐一跟 ACTIVE_ORDER_STATUSES 對得上", () => {
    for (const s of ORDER_STATUSES) {
      assert.equal(isOrderActive(s), ACTIVE_ORDER_STATUSES.includes(s), s);
    }
  });

  it("isPendingOrder 只認 pending，且 pending 是流程第一步", () => {
    assert.equal(isPendingOrder("pending"), true);
    assert.equal(isPendingOrder("confirmed"), false);
    assert.equal(isPendingOrder("PENDING"), false);
    assert.equal(isPendingOrder(null), false);
    assert.equal(ORDER_STATUSES[0], "pending");
  });
});

describe("付款狀態", () => {
  it("正規順序 未付款→已付款→已退款，label 與下拉一致", () => {
    assert.deepEqual(PAYMENT_STATUSES, ["unpaid", "paid", "refunded"]);
    assert.deepEqual(Object.keys(PAYMENT_STATUS_LABELS), PAYMENT_STATUSES);
    assert.deepEqual(
      PAYMENT_STATUS_OPTIONS,
      PAYMENT_STATUSES.map((value) => ({
        value,
        label: PAYMENT_STATUS_LABELS[value],
      }))
    );
  });

  it("isPaidOrder 與 isUnpaidOrder 互斥、退款單兩邊都不是", () => {
    assert.equal(isPaidOrder("paid"), true);
    assert.equal(isUnpaidOrder("paid"), false);
    assert.equal(isPaidOrder("unpaid"), false);
    assert.equal(isUnpaidOrder("unpaid"), true);
    assert.equal(isPaidOrder("refunded"), false);
    assert.equal(isUnpaidOrder("refunded"), false);
    assert.equal(isPaidOrder(null), false);
    assert.equal(isUnpaidOrder(undefined), false);
  });
});

describe("shortOrderId", () => {
  it("標準 UUID 取第一段並轉大寫", () => {
    assert.equal(
      shortOrderId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
      "A1B2C3D4"
    );
  });

  it("沒有連字號就硬切最多 8 字，短的原樣", () => {
    assert.equal(shortOrderId("abcdef1234567890"), "ABCDEF12");
    assert.equal(shortOrderId("abc"), "ABC");
  });

  it("第一段超過 8 字也只取 8 字，後台 split 與客人端 slice 才會給同一個編號", () => {
    assert.equal(shortOrderId("abcdefghij-xyz"), "ABCDEFGH");
  });

  it("空值回空字串不炸、不含 # 前綴", () => {
    assert.equal(shortOrderId(null), "");
    assert.equal(shortOrderId(undefined), "");
    assert.equal(shortOrderId(""), "");
    assert.ok(!shortOrderId("a1b2c3d4-x").startsWith("#"));
  });
});

describe("付款方式", () => {
  it("PAYMENT_LABELS 把「（即將推出）」拿掉，其餘 label 原樣", () => {
    assert.equal(PAYMENT_LABELS.credit_card, "信用卡");
    for (const o of PAYMENT_OPTIONS) {
      assert.ok(!PAYMENT_LABELS[o.value].includes("即將推出"), o.value);
    }
    assert.equal(PAYMENT_LABELS.linepay, "LINE Pay");
    assert.equal(PAYMENT_LABELS.cod, "貨到付款");
  });

  it("isSelectablePaymentMethod：名單上且沒 disabled 才能選", () => {
    assert.equal(isSelectablePaymentMethod("linepay"), true);
    assert.equal(isSelectablePaymentMethod("transfer"), true);
    assert.equal(isSelectablePaymentMethod("credit_card"), false);
    assert.equal(isSelectablePaymentMethod("bitcoin"), false);
    assert.equal(isSelectablePaymentMethod(""), false);
    assert.equal(isSelectablePaymentMethod(null), false);
    assert.equal(isSelectablePaymentMethod(undefined), false);
  });

  it("可選的方式一定有顯示 label；停用的仍在 PAYMENT_LABELS 給舊單顯示", () => {
    for (const o of PAYMENT_OPTIONS) {
      assert.equal(isSelectablePaymentMethod(o.value), !o.disabled, o.value);
      assert.ok(PAYMENT_LABELS[o.value], o.value);
    }
  });

  it("paymentMethodLabel：有方式查 label、查不到原樣、沒填回 null", () => {
    assert.equal(paymentMethodLabel("jkos"), "街口支付");
    assert.equal(paymentMethodLabel("credit_card"), "信用卡");
    assert.equal(paymentMethodLabel("weird"), "weird");
    assert.equal(paymentMethodLabel(""), null);
    assert.equal(paymentMethodLabel(null), null);
    assert.equal(paymentMethodLabel(undefined), null);
  });

  it("paymentNextStepMessage：四種要客人動作的方式各有一句，其他回 null", () => {
    assert.match(paymentNextStepMessage("transfer")!, /匯款帳號/);
    assert.match(paymentNextStepMessage("cod")!, /貨到付款/);
    assert.match(paymentNextStepMessage("in_person")!, /面交/);
    assert.match(paymentNextStepMessage("linepay")!, /LINE Pay/);
    assert.match(paymentNextStepMessage("jkos")!, /街口支付/);
    assert.equal(paymentNextStepMessage("credit_card"), null);
    assert.equal(paymentNextStepMessage("nope"), null);
    assert.equal(paymentNextStepMessage(null), null);
    assert.equal(paymentNextStepMessage(undefined), null);
  });

  it("paymentNextStepMessage 是平台替店家講（店家會…），不是店家第一人稱", () => {
    for (const m of ["transfer", "cod", "in_person", "linepay", "jkos"]) {
      const msg = paymentNextStepMessage(m)!;
      assert.match(msg, /店家/, m);
      assert.doesNotMatch(msg, /我們/, m);
    }
  });
});

describe("配送方式", () => {
  it("SHIPPING_LABELS 跟 SHIPPING_OPTIONS 一對一", () => {
    assert.deepEqual(
      SHIPPING_LABELS,
      Object.fromEntries(SHIPPING_OPTIONS.map((o) => [o.value, o.label]))
    );
  });

  it("shippingNeedsStore 直接跟 needsStore 旗標走：三家超商要、宅配自取不要", () => {
    assert.equal(shippingNeedsStore("cvs_711"), true);
    assert.equal(shippingNeedsStore("cvs_family"), true);
    assert.equal(shippingNeedsStore("cvs_hilife"), true);
    assert.equal(shippingNeedsStore("home_delivery"), false);
    assert.equal(shippingNeedsStore("pickup"), false);
    assert.equal(shippingNeedsStore("drone"), false);
    assert.equal(shippingNeedsStore(""), false);
    assert.equal(shippingNeedsStore(null), false);
    assert.equal(shippingNeedsStore(undefined), false);
    for (const o of SHIPPING_OPTIONS) {
      assert.equal(shippingNeedsStore(o.value), o.needsStore === true, o.value);
    }
  });

  it("shippingDetailError：超商沒門市擋、宅配沒地址擋、其他放行", () => {
    assert.equal(
      shippingDetailError("cvs_711", null, null),
      "超商取貨必須填取貨門市名稱"
    );
    assert.equal(
      shippingDetailError("cvs_family", "", "隨便"),
      "超商取貨必須填取貨門市名稱"
    );
    assert.equal(shippingDetailError("cvs_hilife", "信義門市", null), null);
    assert.equal(shippingDetailError("home_delivery", null, null), "宅配必須填收件地址");
    assert.equal(shippingDetailError("home_delivery", null, ""), "宅配必須填收件地址");
    assert.equal(shippingDetailError("home_delivery", null, "台北市信義區"), null);
    assert.equal(shippingDetailError("pickup", null, null), null);
    assert.equal(shippingDetailError(null, null, null), null);
    assert.equal(shippingDetailError(undefined, undefined, undefined), null);
    assert.equal(shippingDetailError("unknown", null, null), null);
  });

  it("超商取貨只看門市不看地址；宅配只看地址不看門市", () => {
    assert.equal(shippingDetailError("cvs_711", "門市", null), null);
    assert.equal(shippingDetailError("home_delivery", "門市", null), "宅配必須填收件地址");
  });
});

describe("encodeShippingIntoNote／decodeShippingFromNote", () => {
  it("超商＋門市＋備註：兩行標記、空行、備註", () => {
    assert.equal(
      encodeShippingIntoNote("cvs_711", "信義門市（XX-123）", "請幫我包漂亮一點"),
      "[配送方式] 7-11 取貨\n[取貨門市] 信義門市（XX-123）\n\n請幫我包漂亮一點"
    );
  });

  it("只有配送方式沒備註：只有標記，沒尾巴空行", () => {
    assert.equal(encodeShippingIntoNote("pickup", null, null), "[配送方式] 店面自取");
    assert.equal(encodeShippingIntoNote("pickup", null, "   "), "[配送方式] 店面自取");
  });

  it("只有備註沒配送方式：原樣（去頭尾空白）", () => {
    assert.equal(encodeShippingIntoNote(null, null, "  只有備註  "), "只有備註");
  });

  it("什麼都沒有回 null；不認得的配送方式當作沒填，門市也不寫", () => {
    assert.equal(encodeShippingIntoNote(null, null, null), null);
    assert.equal(encodeShippingIntoNote(null, null, ""), null);
    assert.equal(encodeShippingIntoNote("drone", "某門市", null), null);
    assert.equal(encodeShippingIntoNote("drone", "某門市", "備註"), "備註");
  });

  it("encode 不看方式要不要門市：有傳門市就寫（結帳畫面在非超商時已拿掉門市欄，後端不會收到）", () => {
    assert.equal(
      encodeShippingIntoNote("home_delivery", "硬塞的門市", "備註"),
      "[配送方式] 宅配到府\n[取貨門市] 硬塞的門市\n\n備註"
    );
  });

  it("decode 空值與沒標記的純備註", () => {
    assert.deepEqual(decodeShippingFromNote(null), {
      shippingLabel: null,
      storeName: null,
      userNote: null,
    });
    assert.deepEqual(decodeShippingFromNote(""), {
      shippingLabel: null,
      storeName: null,
      userNote: null,
    });
    assert.deepEqual(decodeShippingFromNote("純備註"), {
      shippingLabel: null,
      storeName: null,
      userNote: "純備註",
    });
  });

  it("decode 只有標記沒備註：userNote 回 null 不是空字串", () => {
    assert.deepEqual(decodeShippingFromNote("[配送方式] 店面自取"), {
      shippingLabel: "店面自取",
      storeName: null,
      userNote: null,
    });
    assert.deepEqual(
      decodeShippingFromNote("[配送方式] 全家取貨\n[取貨門市] 大安店"),
      { shippingLabel: "全家取貨", storeName: "大安店", userNote: null }
    );
  });

  it("標記不在開頭就不解，整段當備註", () => {
    const note = "備註在前\n[配送方式] 店面自取";
    assert.deepEqual(decodeShippingFromNote(note), {
      shippingLabel: null,
      storeName: null,
      userNote: note,
    });
  });

  it("備註本身含換行與方括號也不會被吃掉", () => {
    const decoded = decodeShippingFromNote(
      encodeShippingIntoNote("cvs_family", "大安店", "第一行\n第二行\n[不是標記] 內容")!
    );
    assert.deepEqual(decoded, {
      shippingLabel: "全家取貨",
      storeName: "大安店",
      userNote: "第一行\n第二行\n[不是標記] 內容",
    });
  });

  it("每種配送方式 encode 再 decode 都能還原，label 對得上 SHIPPING_LABELS", () => {
    for (const o of SHIPPING_OPTIONS) {
      const store = o.needsStore ? "某某門市（AB-1）" : null;
      const encoded = encodeShippingIntoNote(o.value, store, "客人備註")!;
      const decoded = decodeShippingFromNote(encoded);
      assert.equal(decoded.shippingLabel, SHIPPING_LABELS[o.value], o.value);
      assert.equal(decoded.storeName, store, o.value);
      assert.equal(decoded.userNote, "客人備註", o.value);
    }
  });
});

describe("shippedMessage／orderStatusMessage", () => {
  it("宅配、自取、超商（有無門市）、其他各一句", () => {
    assert.match(shippedMessage("宅配到府", null), /宅配/);
    assert.match(shippedMessage("店面自取", null), /到店面取貨/);
    assert.match(shippedMessage("7-11 取貨", "信義門市"), /「信義門市」/);
    assert.match(shippedMessage("7-11 取貨", null), /你選的門市/);
    assert.match(shippedMessage("全家取貨", "大安店"), /帶證件/);
    assert.equal(shippedMessage(null, null), "商品已寄出，請耐心等待");
    assert.equal(shippedMessage("火箭", "門市"), "商品已寄出，請耐心等待");
  });

  it("自取的 label 也含「取」但不會被當成超商取貨", () => {
    assert.doesNotMatch(shippedMessage("店面自取", "門市"), /證件/);
  });

  it("每種配送方式的 label 都有專屬說法，不會落到「請耐心等待」", () => {
    for (const o of SHIPPING_OPTIONS) {
      assert.notEqual(shippedMessage(o.label, null), "商品已寄出，請耐心等待", o.value);
    }
  });

  it("orderStatusMessage 四步各一句、已出貨依取貨方式、取消與未知回 null", () => {
    assert.match(orderStatusMessage("pending", null, null)!, /等待確認/);
    assert.match(orderStatusMessage("confirmed", null, null)!, /備貨/);
    assert.equal(
      orderStatusMessage("shipped", "7-11 取貨", "信義門市"),
      shippedMessage("7-11 取貨", "信義門市")
    );
    assert.match(orderStatusMessage("completed", null, null)!, /謝謝/);
    assert.equal(orderStatusMessage("cancelled", null, null), null);
    assert.equal(orderStatusMessage("packing", null, null), null);
  });
});

describe("customerMessage", () => {
  const base = {
    status: "pending",
    customerName: "小明",
    storeName: "植物市場",
    shortId: "A1B2C3D4",
    items: [
      { name: "龜背芋", quantity: 1 },
      { name: "培養土", quantity: 2 },
    ],
    totalText: "NT$1,200",
    shippingLabel: "7-11 取貨" as string | null,
    pickupStore: "信義門市" as string | null,
    paymentMethod: "transfer" as string | null,
    paymentStatus: "unpaid",
    trackUrl: "https://example.com/track/1" as string | null,
  };

  it("待確認：開場＋品項＋合計＋配送（含門市）＋轉帳提醒＋查單連結", () => {
    const msg = customerMessage(base);
    assert.deepEqual(msg.split("\n"), [
      "小明 你好，我是「植物市場」，收到你的訂單了（編號 #A1B2C3D4），我們確認後會再通知你，謝謝你的訂購！",
      "",
      "訂購內容",
      "・龜背芋 × 1",
      "・培養土 × 2",
      "合計 NT$1,200",
      "",
      "配送方式：7-11 取貨（信義門市）",
      "（這筆是銀行轉帳，匯款後再跟我們說一聲就可以囉）",
      "",
      "隨時查訂單進度：https://example.com/track/1",
    ]);
  });

  it("名字空白用「你好」開頭；trim 掉前後空白", () => {
    assert.ok(customerMessage({ ...base, customerName: "   " }).startsWith("你好 你好，"));
    assert.ok(customerMessage({ ...base, customerName: " 阿花 " }).startsWith("阿花 你好，"));
  });

  it("已確認／已出貨／已完成開場各不同，已出貨吃 shippedMessage", () => {
    assert.match(customerMessage({ ...base, status: "confirmed" }), /正在幫你備貨/);
    const shipped = customerMessage({ ...base, status: "shipped" });
    assert.ok(shipped.includes(shippedMessage("7-11 取貨", "信義門市")));
    assert.match(customerMessage({ ...base, status: "completed" }), /已經完成/);
  });

  it("不認得的狀態給中性開場，後面照樣列品項", () => {
    const msg = customerMessage({ ...base, status: "packing" });
    assert.match(msg, /關於你的訂單 #A1B2C3D4：/);
    assert.match(msg, /訂購內容/);
  });

  it("已取消：不列品項、配送、付款提醒；查單連結仍附", () => {
    const msg = customerMessage({ ...base, status: "cancelled" });
    assert.doesNotMatch(msg, /訂購內容/);
    assert.doesNotMatch(msg, /配送方式/);
    assert.doesNotMatch(msg, /銀行轉帳/);
    assert.match(msg, /已取消/);
    assert.doesNotMatch(msg, /款項已退還/);
    assert.match(msg, /隨時查訂單進度/);
  });

  it("已取消且已退款：開場句就講錢退了", () => {
    const msg = customerMessage({ ...base, status: "cancelled", paymentStatus: "refunded" });
    assert.match(msg, /已取消，款項已退還給你，/);
  });

  it("未付款依方式給不同提醒；信用卡與未知方式不提醒", () => {
    assert.match(customerMessage({ ...base, paymentMethod: "cod" }), /貨到付款，取貨時再付款/);
    assert.match(customerMessage({ ...base, paymentMethod: "in_person" }), /面交付款/);
    assert.match(customerMessage({ ...base, paymentMethod: "linepay" }), /選LINE Pay，我們會再把付款方式傳給你/);
    assert.match(customerMessage({ ...base, paymentMethod: "jkos" }), /選街口支付/);
    assert.doesNotMatch(customerMessage({ ...base, paymentMethod: "credit_card" }), /（這筆/);
    assert.doesNotMatch(customerMessage({ ...base, paymentMethod: null }), /（這筆/);
  });

  it("已付款不催款；已退款不催款但講一句錢退了", () => {
    const paid = customerMessage({ ...base, paymentStatus: "paid" });
    assert.doesNotMatch(paid, /銀行轉帳/);
    assert.doesNotMatch(paid, /款項已退還/);
    const refunded = customerMessage({ ...base, paymentStatus: "refunded" });
    assert.doesNotMatch(refunded, /銀行轉帳/);
    assert.match(refunded, /款項已退還給你/);
  });

  it("沒品項就不列訂購內容區塊；沒配送就不列配送；沒門市不加括號", () => {
    const msg = customerMessage({
      ...base,
      items: [],
      shippingLabel: null,
      pickupStore: null,
      paymentStatus: "paid",
      trackUrl: null,
    });
    assert.equal(msg.split("\n").length, 1);
    const noStore = customerMessage({ ...base, pickupStore: null });
    assert.match(noStore, /配送方式：7-11 取貨$/m);
    assert.doesNotMatch(noStore, /（信義門市）/);
  });

  it("沒 trackUrl 就沒有查單那兩行", () => {
    const msg = customerMessage({ ...base, trackUrl: null });
    assert.doesNotMatch(msg, /查訂單進度/);
    assert.ok(!msg.endsWith("\n"));
  });
});
