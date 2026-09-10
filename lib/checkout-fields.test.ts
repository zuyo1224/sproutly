// lib/checkout-fields.ts 的行為固定測試。
//
// 這幾格是客人下單前唯一要自己填的東西，也是店家出貨唯一能依據的東西：姓名電話漏收
// 就是一張聯絡不到人的單，門市／地址漏收就是一張出不了貨的單，付款方式放行到還沒開通
// 的金流就是一張收不到錢的單。這裡把「什麼收、什麼拒、拒的時候客人看到哪一句、多個
// 欄位同時錯先講哪一句」全部寫死，兩條結帳路徑（單品直接買、購物車結帳）共用同一份。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkoutFieldsError, type CheckoutFields } from "./checkout-fields.ts";

const NAME = "請填收件人姓名";
const PHONE = "請填電話";
const PAYMENT = "請選擇付款方式";
const SHIPPING = "請選擇配送方式";
const STORE = "超商取貨必須填取貨門市名稱";
const ADDRESS = "宅配必須填收件地址";

// 一組全部合格的欄位，每條測試只覆蓋要試的那格。
function fields(over: Partial<CheckoutFields> = {}): CheckoutFields {
  return {
    customerName: "王小明",
    customerPhone: "0912345678",
    paymentMethod: "linepay",
    shippingMethod: "pickup",
    shippingStoreName: null,
    shippingAddress: null,
    ...over,
  };
}

describe("全部填好", () => {
  it("店面自取不必填門市也不必填地址", () => {
    assert.equal(checkoutFieldsError(fields()), null);
  });

  it("超商取貨有填門市就過", () => {
    assert.equal(
      checkoutFieldsError(
        fields({ shippingMethod: "cvs_711", shippingStoreName: "信義門市" })
      ),
      null
    );
  });

  it("宅配有填地址就過", () => {
    assert.equal(
      checkoutFieldsError(
        fields({ shippingMethod: "home_delivery", shippingAddress: "台北市…" })
      ),
      null
    );
  });

  it("五種付款方式裡沒停用的那幾種都收", () => {
    for (const m of ["linepay", "jkos", "transfer", "cod", "in_person"]) {
      assert.equal(checkoutFieldsError(fields({ paymentMethod: m })), null, m);
    }
  });

  it("五種配送方式都收（超商的補門市、宅配的補地址）", () => {
    assert.equal(checkoutFieldsError(fields({ shippingMethod: "cvs_711", shippingStoreName: "A" })), null);
    assert.equal(checkoutFieldsError(fields({ shippingMethod: "cvs_family", shippingStoreName: "A" })), null);
    assert.equal(checkoutFieldsError(fields({ shippingMethod: "cvs_hilife", shippingStoreName: "A" })), null);
    assert.equal(checkoutFieldsError(fields({ shippingMethod: "home_delivery", shippingAddress: "A" })), null);
    assert.equal(checkoutFieldsError(fields({ shippingMethod: "pickup" })), null);
  });
});

describe("姓名", () => {
  it("空字串、null、undefined 都算沒填", () => {
    assert.equal(checkoutFieldsError(fields({ customerName: "" })), NAME);
    assert.equal(checkoutFieldsError(fields({ customerName: null })), NAME);
    assert.equal(checkoutFieldsError(fields({ customerName: undefined })), NAME);
  });

  // 這支不做 trim：兩條路徑讀 FormData 時都已經 trim 過（formString / String().trim()），
  // 純空白進不到這裡。寫死這條是提醒日後有第三個呼叫端時，trim 要在讀的那一端做。
  it("純空白會被當成有填（讀欄位那端負責 trim）", () => {
    assert.equal(checkoutFieldsError(fields({ customerName: "   " })), null);
  });
});

describe("電話", () => {
  it("沒填就擋，訊息跟表單上那格的 label「電話」對齊", () => {
    assert.equal(checkoutFieldsError(fields({ customerPhone: "" })), PHONE);
    assert.equal(checkoutFieldsError(fields({ customerPhone: null })), PHONE);
  });

  // 目前只檢查有沒有填，不驗格式：市話、分機、境外號碼寫法太多，擋錯的代價（客人下不了單）
  // 比收到一個怪號碼大。要改成驗格式的話，兩條路徑會一起改到。
  it("不驗格式，隨便填什麼都收", () => {
    assert.equal(checkoutFieldsError(fields({ customerPhone: "哈囉" })), null);
    assert.equal(checkoutFieldsError(fields({ customerPhone: "02-1234 #56" })), null);
  });
});

describe("付款方式", () => {
  it("沒選就擋", () => {
    assert.equal(checkoutFieldsError(fields({ paymentMethod: null })), PAYMENT);
    assert.equal(checkoutFieldsError(fields({ paymentMethod: "" })), PAYMENT);
  });

  it("名單外的值當沒選（有人繞過畫面直接送）", () => {
    assert.equal(checkoutFieldsError(fields({ paymentMethod: "bitcoin" })), PAYMENT);
    assert.equal(checkoutFieldsError(fields({ paymentMethod: "LINEPAY" })), PAYMENT);
  });

  // 信用卡在選單上是「即將推出」而且停用中，繞過畫面送上來會建出一張收不到錢的單。
  it("停用中的信用卡不放行", () => {
    assert.equal(checkoutFieldsError(fields({ paymentMethod: "credit_card" })), PAYMENT);
  });
});

describe("配送方式", () => {
  it("沒選就擋", () => {
    assert.equal(checkoutFieldsError(fields({ shippingMethod: null })), SHIPPING);
    assert.equal(checkoutFieldsError(fields({ shippingMethod: "" })), SHIPPING);
  });

  it("名單外的值當沒選", () => {
    assert.equal(checkoutFieldsError(fields({ shippingMethod: "drone" })), SHIPPING);
  });
});

describe("門市與地址", () => {
  it("三家超商都必須填門市", () => {
    for (const m of ["cvs_711", "cvs_family", "cvs_hilife"]) {
      assert.equal(checkoutFieldsError(fields({ shippingMethod: m })), STORE, m);
    }
  });

  it("宅配必須填地址", () => {
    assert.equal(
      checkoutFieldsError(fields({ shippingMethod: "home_delivery" })),
      ADDRESS
    );
  });

  // 拿反了不會互相補位：超商填了地址沒填門市照樣擋，店家還是不知道去哪家店寄。
  it("超商填地址不能代替門市", () => {
    assert.equal(
      checkoutFieldsError(
        fields({ shippingMethod: "cvs_711", shippingAddress: "台北市…" })
      ),
      STORE
    );
  });

  it("宅配填門市不能代替地址", () => {
    assert.equal(
      checkoutFieldsError(
        fields({ shippingMethod: "home_delivery", shippingStoreName: "信義門市" })
      ),
      ADDRESS
    );
  });

  // 自取不寄東西，兩格都不管；多填的也不會變成錯誤。
  it("店面自取兩格都不必填、填了也不擋", () => {
    assert.equal(
      checkoutFieldsError(
        fields({ shippingMethod: "pickup", shippingStoreName: "X", shippingAddress: "Y" })
      ),
      null
    );
  });
});

describe("多格同時錯的時候先講哪一句", () => {
  // 順序＝表單由上而下（姓名 → 電話 → 付款 → 配送 → 門市／地址）。一次只講最上面那格，
  // 客人補完再送出才不會像在打地鼠。
  it("全部沒填先講姓名", () => {
    const empty: CheckoutFields = {
      customerName: "",
      customerPhone: "",
      paymentMethod: null,
      shippingMethod: null,
      shippingStoreName: null,
      shippingAddress: null,
    };
    assert.equal(checkoutFieldsError(empty), NAME);
  });

  it("姓名補上後換講電話", () => {
    assert.equal(
      checkoutFieldsError(fields({ customerPhone: "", paymentMethod: null })),
      PHONE
    );
  });

  it("付款沒選比配送沒選先講", () => {
    assert.equal(
      checkoutFieldsError(fields({ paymentMethod: null, shippingMethod: null })),
      PAYMENT
    );
  });

  it("配送沒選時不會先跳門市或地址沒填", () => {
    assert.equal(
      checkoutFieldsError(fields({ shippingMethod: "", shippingStoreName: null })),
      SHIPPING
    );
  });
});
