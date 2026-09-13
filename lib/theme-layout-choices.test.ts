// lib/theme-layout-choices.ts 的行為固定測試。
//
// 為什麼要有這份：這張表同時餵編輯器存檔（只看 values）與公開頁讀回（values 之外回 fallback），
// 最容易被順手改壞的是「fallback 打錯字不在 values 裡」——tsc 擋不到（fallback 只要求 string），
// 結果是店面永遠畫一個清單外的值。這裡把每格 fallback ∈ values 與 pick 的三種輸入寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LAYOUT_CHOICES,
  LAYOUT_CHOICE_KEYS,
  isLayoutChoice,
  pickLayoutChoice,
} from "./theme-layout-choices.ts";

describe("LAYOUT_CHOICES", () => {
  it("每格的 fallback 都在自己的 values 裡，且 values 沒重複", () => {
    for (const key of LAYOUT_CHOICE_KEYS) {
      const { values, fallback } = LAYOUT_CHOICES[key];
      assert.ok((values as readonly string[]).includes(fallback), `${key} 的 fallback 不在清單內`);
      assert.equal(new Set(values).size, values.length, `${key} 的 values 有重複`);
    }
  });
});

describe("isLayoutChoice / pickLayoutChoice", () => {
  it("清單內的值原樣回", () => {
    assert.equal(isLayoutChoice("heroHeight", "tall"), true);
    assert.equal(pickLayoutChoice("heroHeight", "tall"), "tall");
    assert.equal(pickLayoutChoice("heroSubtitleAlign", "right"), "right");
    assert.equal(pickLayoutChoice("heroCtaWeight", "bold"), "bold");
  });

  it("沒填、壞值、非字串一律回該格 fallback", () => {
    assert.equal(isLayoutChoice("heroHeight", "huge"), false);
    assert.equal(pickLayoutChoice("heroHeight", undefined), "auto");
    assert.equal(pickLayoutChoice("heroHeight", "huge"), "auto");
    assert.equal(pickLayoutChoice("heroHeightMobile", null), "same");
    assert.equal(pickLayoutChoice("buttonRadius", 3), "pill");
    assert.equal(pickLayoutChoice("heroCtaCase", "upper"), "default");
  });
});
