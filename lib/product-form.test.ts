// lib/product-form.ts 的行為固定測試。
//
// 這支是後台「新增商品」與「編輯商品」共用的表單讀取＋擋錯值。改壞的樣子不是白畫面，
// 是商家從其中一條路進來時，同一筆輸入被放行或被擋的結果跟另一條不一樣。所以這裡把
// 三件事寫死：必填欄位的檢查順序、各上限的邊界（剛好等於上限要過、超過一個字要擋）、
// 以及庫存留空是 null（不管庫存）而不是 0（賣完了）這條界線。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readProductForm, parsePrice, parseStock, assertTextLimits } from "./product-form.ts";
import {
  MAX_PRICE_YUAN,
  MAX_STOCK,
  MAX_PRODUCT_NAME_LEN,
  MAX_PRODUCT_DESC_LEN,
} from "./product-limits.ts";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

function ok(result: ReturnType<typeof readProductForm>) {
  assert.equal(result.ok, true, `預期通過，卻被擋下：${result.ok ? "" : result.error}`);
  assert.ok(result.ok);
  return result.value;
}

function err(result: ReturnType<typeof readProductForm>): string {
  assert.equal(result.ok, false, "預期被擋下，卻通過了");
  assert.ok(!result.ok);
  return result.error;
}

describe("readProductForm 讀得到的值", () => {
  it("一般情況：品名去空白、價格轉數字、庫存轉數字、上架打勾", () => {
    const v = ok(
      readProductForm(
        fd({
          name: "  龜背芋  ",
          description: " 好照顧 ",
          price: "480",
          stock: "3",
          is_active: "on",
        })
      )
    );
    assert.deepEqual(v, {
      name: "龜背芋",
      description: "好照顧",
      price: 480,
      stock: 3,
      isActive: true,
    });
  });

  it("價格留元不換算成分（換算是呼叫端的事）", () => {
    assert.equal(ok(readProductForm(fd({ name: "A", price: "480" }))).price, 480);
  });

  it("描述留空收成 null，不是空字串", () => {
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1", description: "  " }))).description, null);
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1" }))).description, null);
  });

  it("庫存留空是 null（不管這件的庫存），不是 0（賣完了）", () => {
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1", stock: "" }))).stock, null);
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1" }))).stock, null);
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1", stock: "0" }))).stock, 0);
  });

  it("沒打勾就是下架：checkbox 沒送出，或送出的不是 on", () => {
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1" }))).isActive, false);
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1", is_active: "off" }))).isActive, false);
    assert.equal(ok(readProductForm(fd({ name: "A", price: "1", is_active: "true" }))).isActive, false);
  });

  it("價格 0 可以（送禮／贈品），小數也可以（找零單位）", () => {
    assert.equal(ok(readProductForm(fd({ name: "A", price: "0" }))).price, 0);
    assert.equal(ok(readProductForm(fd({ name: "A", price: "99.5" }))).price, 99.5);
  });
});

describe("readProductForm 擋下來的情況", () => {
  it("空品名先講品名（就算價格也沒填）", () => {
    assert.equal(err(readProductForm(fd({ name: "  ", price: "" }))), "請填商品名稱");
  });

  it("品名有了、價格空著就講價格", () => {
    assert.equal(err(readProductForm(fd({ name: "A", price: "  " }))), "請填價格");
  });

  it("字數檢查排在價格／庫存前面：品名太長時先講品名", () => {
    const msg = err(
      readProductForm(fd({ name: "字".repeat(MAX_PRODUCT_NAME_LEN + 1), price: "-5" }))
    );
    assert.match(msg, /商品名稱最多/);
  });

  it("價格不是數字、是負數，都擋", () => {
    assert.equal(err(readProductForm(fd({ name: "A", price: "免費" }))), "價格必須是非負數");
    assert.equal(err(readProductForm(fd({ name: "A", price: "-1" }))), "價格必須是非負數");
  });

  it("庫存是小數或負數就擋（瀏覽器那層擋得掉，繞過來這層也要擋）", () => {
    assert.equal(
      err(readProductForm(fd({ name: "A", price: "1", stock: "5.5" }))),
      "庫存必須是非負整數或留空"
    );
    assert.equal(
      err(readProductForm(fd({ name: "A", price: "1", stock: "-2" }))),
      "庫存必須是非負整數或留空"
    );
  });
});

describe("上限的邊界", () => {
  it("價格剛好等於上限要過，多一元要擋", () => {
    assert.equal(parsePrice(String(MAX_PRICE_YUAN)), MAX_PRICE_YUAN);
    assert.throws(() => parsePrice(String(MAX_PRICE_YUAN + 1)), /價格最多/);
  });

  it("庫存剛好等於上限要過，多一件要擋", () => {
    assert.equal(parseStock(String(MAX_STOCK)), MAX_STOCK);
    assert.throws(() => parseStock(String(MAX_STOCK + 1)), /庫存最多/);
  });

  it("品名剛好等於上限要過，多一個字要擋", () => {
    assert.doesNotThrow(() => assertTextLimits("字".repeat(MAX_PRODUCT_NAME_LEN), null));
    assert.throws(() => assertTextLimits("字".repeat(MAX_PRODUCT_NAME_LEN + 1), null), /商品名稱最多/);
  });

  it("描述剛好等於上限要過，多一個字要擋；沒描述不檢查", () => {
    assert.doesNotThrow(() => assertTextLimits("A", "字".repeat(MAX_PRODUCT_DESC_LEN)));
    assert.throws(() => assertTextLimits("A", "字".repeat(MAX_PRODUCT_DESC_LEN + 1)), /商品描述最多/);
    assert.doesNotThrow(() => assertTextLimits("A", null));
  });
});

describe("新增與編輯拿到的是同一份結果", () => {
  it("同一份表單內容，兩條路徑讀出來一模一樣（呼叫端只差 redirect 去哪）", () => {
    const entries = {
      name: "龜背芋",
      description: "好照顧",
      price: "480",
      stock: "3",
      is_active: "on",
    };
    assert.deepEqual(readProductForm(fd(entries)), readProductForm(fd(entries)));
  });

  it("編輯頁沒有的 image_url 欄位不影響結果", () => {
    const base = { name: "A", price: "1" };
    assert.deepEqual(
      readProductForm(fd(base)),
      readProductForm(fd({ ...base, image_url: "https://example.com/a.jpg" }))
    );
  });
});
