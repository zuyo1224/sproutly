// lib/clearable-field.ts sanitizeClearable 的三態固定測試。
//
// 為什麼要有這份：actions.ts 三段（Hero 大圖／logo、地圖嵌入網址、14 格顏色）都改吃
// 這一支，三態的邊界——「沒帶」跟「清除」跟「判不過」三個回值不能混——寫死在這裡。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeClearable } from "./clearable-field.ts";
import { normalizeHexColor } from "./hex-color.ts";

const upper = (s: string) => (s.startsWith("ok") ? s.toUpperCase() : null);

describe("sanitizeClearable", () => {
  it("undefined = 沒帶，回 undefined；null 與空字串 = 清除，回 null", () => {
    assert.equal(sanitizeClearable(undefined, upper), undefined);
    assert.equal(sanitizeClearable(null, upper), null);
    assert.equal(sanitizeClearable("", upper), null);
  });

  it("有字就走 clean：判過回乾淨值、判不過回 undefined", () => {
    assert.equal(sanitizeClearable("ok-go", upper), "OK-GO");
    assert.equal(sanitizeClearable("nope", upper), undefined);
    // 純空白不是空字串，交給 clean 判（normalizeHexColor trim 後判不過 → 跳過）
    assert.equal(sanitizeClearable("   ", normalizeHexColor), undefined);
    assert.equal(sanitizeClearable(" #AABBCC ", normalizeHexColor), "#AABBCC");
  });

  it("非字串（數字、物件、布林、NaN）一律當判不過，回 undefined 不進 clean", () => {
    let called = 0;
    const spy = (s: string) => {
      called++;
      return s;
    };
    for (const junk of [0, 123, NaN, true, false, {}, [], () => 1]) {
      assert.equal(sanitizeClearable(junk, spy), undefined);
    }
    assert.equal(called, 0);
  });
});
