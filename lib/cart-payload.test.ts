// lib/cart-payload.ts 的行為固定測試。
//
// 這份東西整份由客人瀏覽器決定，是全站最該被當成敵意輸入的一段。改壞的樣子不會噴錯，
// 只會安靜地讓錯的訂單成立：負數量把總額算成負的、庫存反而被加回去；小數量讓金額出現
// 對不起來的分；同一個商品重複列會讓後面「商品筆數對不上 id 筆數」的檢查誤報成商品下架。
// 這裡把「什麼收、什麼拒、拒的時候客人看到哪一句」全部寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCartPayload } from "./cart-payload.ts";

const EMPTY = "購物車是空的";
const BAD = "購物車內容有誤，請重新確認";

// 測試裡只關心「有沒有過、過的話收到什麼」，包一層省得每條都寫 if。
function ok(raw: string) {
  const r = parseCartPayload(raw);
  assert.equal(r.ok, true, `預期通過，實際被拒：${r.ok ? "" : r.error}`);
  return r.ok ? r.items : [];
}
function err(raw: string | null | undefined) {
  const r = parseCartPayload(raw);
  assert.equal(r.ok, false, "預期被拒，實際通過");
  return r.ok ? "" : r.error;
}

describe("整份不成形", () => {
  it("沒帶、null、空字串都當車是空的", () => {
    assert.equal(err(undefined), EMPTY);
    assert.equal(err(null), EMPTY);
    assert.equal(err(""), EMPTY);
    assert.equal(err("   "), EMPTY);
  });

  it("不是 JSON 就當車是空的，不會讓例外炸到 route", () => {
    assert.equal(err("[{productId:"), EMPTY);
    assert.equal(err("哈囉"), EMPTY);
  });

  it("是合法 JSON 但不是陣列一樣拒收", () => {
    assert.equal(err('{"productId":"a","qty":1}'), EMPTY);
    assert.equal(err('"a"'), EMPTY);
    assert.equal(err("null"), EMPTY);
    assert.equal(err("3"), EMPTY);
  });

  it("空陣列拒收，不會建出一張沒有明細的訂單", () => {
    assert.equal(err("[]"), EMPTY);
  });
});

describe("正常的車", () => {
  it("單一品項照收", () => {
    assert.deepEqual(ok('[{"productId":"a","qty":2}]'), [
      { productId: "a", qty: 2 },
    ]);
  });

  it("多品項照原順序收，順序決定後面明細的排列", () => {
    assert.deepEqual(
      ok('[{"productId":"b","qty":1},{"productId":"a","qty":3}]'),
      [
        { productId: "b", qty: 1 },
        { productId: "a", qty: 3 },
      ]
    );
  });

  it("多餘的欄位（名稱、價格）不帶出去，後端一律以自己查到的商品為準", () => {
    assert.deepEqual(
      ok('[{"productId":"a","qty":1,"name":"假名字","priceCents":1}]'),
      [{ productId: "a", qty: 1 }]
    );
  });

  it("數量是數字字串也收，舊版購物車存的就是字串", () => {
    const items = ok('[{"productId":"a","qty":"2"}]');
    assert.deepEqual(items, [{ productId: "a", qty: 2 }]);
    assert.equal(typeof items[0].qty, "number");
  });

  it("頭尾有空白的整串照樣解得開", () => {
    assert.deepEqual(ok('  [{"productId":"a","qty":1}]  '), [
      { productId: "a", qty: 1 },
    ]);
  });
});

describe("數量不合法", () => {
  it("零與負數拒收（放行會讓總額變負、庫存被加回去）", () => {
    assert.equal(err('[{"productId":"a","qty":0}]'), BAD);
    assert.equal(err('[{"productId":"a","qty":-5}]'), BAD);
  });

  it("超過上限拒收", () => {
    assert.equal(err('[{"productId":"a","qty":100}]'), BAD);
    assert.equal(ok('[{"productId":"a","qty":99}]')[0].qty, 99);
  });

  it("小數拒收，金額不會出現算不清的分", () => {
    assert.equal(err('[{"productId":"a","qty":1.5}]'), BAD);
  });

  it("算不出數字的拒收", () => {
    assert.equal(err('[{"productId":"a","qty":"兩件"}]'), BAD);
    assert.equal(err('[{"productId":"a","qty":{}}]'), BAD);
  });

  it("null 與沒帶 qty 也拒收（Number 分別算成 0 與 NaN，都不在範圍內）", () => {
    assert.equal(err('[{"productId":"a","qty":null}]'), BAD);
    assert.equal(err('[{"productId":"a"}]'), BAD);
  });

  // 以下兩條是現況紀錄，不是理想行為：Number(true) 與 Number([1]) 都算得出 1，
  // 所以會被當成「買 1 件」收下。不改成拒收是因為收下的值仍是範圍內的整數，
  // 金額與庫存都不會因此算錯，真要收緊也該連同單品結帳那條路一起改。
  it("布林 true 被 Number 算成 1，現況會當成買 1 件收下", () => {
    assert.deepEqual(ok('[{"productId":"a","qty":true}]'), [
      { productId: "a", qty: 1 },
    ]);
  });

  it("只有一個數字的陣列同理算成那個數字", () => {
    assert.deepEqual(ok('[{"productId":"a","qty":[1]}]'), [
      { productId: "a", qty: 1 },
    ]);
    assert.equal(err('[{"productId":"a","qty":[1,2]}]'), BAD);
  });
});

describe("商品 id 不合法", () => {
  it("缺 id、空字串 id、非字串 id 一律拒收", () => {
    assert.equal(err('[{"qty":1}]'), BAD);
    assert.equal(err('[{"productId":"","qty":1}]'), BAD);
    assert.equal(err('[{"productId":123,"qty":1}]'), BAD);
    assert.equal(err('[{"productId":null,"qty":1}]'), BAD);
  });

  it("陣列裡混進不是物件的東西也拒收", () => {
    assert.equal(err('["a"]'), BAD);
    assert.equal(err("[null]"), BAD);
    assert.equal(err("[1]"), BAD);
  });
});

describe("重複的商品", () => {
  it("同一個 id 出現兩列就整份拒收", () => {
    assert.equal(
      err('[{"productId":"a","qty":1},{"productId":"a","qty":2}]'),
      BAD
    );
  });

  it("不同 id 不受影響", () => {
    assert.equal(
      ok('[{"productId":"a","qty":1},{"productId":"b","qty":1}]').length,
      2
    );
  });
});

describe("一列壞掉整份拒收", () => {
  it("前面幾列合法也不會被部分收下（半張單比整張拒收更難查）", () => {
    assert.equal(
      err('[{"productId":"a","qty":1},{"productId":"b","qty":-1}]'),
      BAD
    );
  });
});
