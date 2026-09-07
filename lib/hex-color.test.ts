// lib/hex-color.ts normalizeHexColor 的行為固定測試。
//
// 為什麼要有這份：這支是全站色碼驗證的唯一口徑——設定頁存主色／點綴色、編輯器存 Hero
// 主副標顏色與各區段底色／文字色、公開頁 _theme 解析、section-style-schema sanitize、
// color-contrast 算對比，五處都靠它決定「這串字算不算合法色碼」。以前是十處各抄一份
// regex，收成一支後放寬或收緊規則只動這裡；但反過來說，這裡改壞一點就是五處同時壞，
// 而且壞法很安靜：商家存的顏色被當非法退回預設色，後台看不出原因。這裡把「只收六碼、
// 前後空白去掉、大小寫照原樣保留、其他型別與格式一律 null 不猜」寫死。
//
// 用 Node 內建的 node:test + node:assert，跟其他 lib 測試同一套；import 帶 .ts 副檔名
// 是 lib 全檔慣例（Node 剝型別時不補副檔名）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeHexColor } from "./hex-color.ts";

describe("normalizeHexColor", () => {
  it("六碼合法色碼原樣回傳", () => {
    assert.equal(normalizeHexColor("#1f6f3f"), "#1f6f3f");
    assert.equal(normalizeHexColor("#000000"), "#000000");
    assert.equal(normalizeHexColor("#FFFFFF"), "#FFFFFF");
  });

  it("大小寫混用照原樣保留，不轉小寫", () => {
    assert.equal(normalizeHexColor("#AbCdEf"), "#AbCdEf");
  });

  it("前後空白會先去掉再驗，存進去的是乾淨值", () => {
    assert.equal(normalizeHexColor("  #1f6f3f"), "#1f6f3f");
    assert.equal(normalizeHexColor("#1f6f3f\n"), "#1f6f3f");
    assert.equal(normalizeHexColor("\t #1f6f3f \t"), "#1f6f3f");
  });

  it("色碼中間夾空白不算合法", () => {
    assert.equal(normalizeHexColor("#1f6f 3f"), null);
  });

  it("三碼、八碼、七碼、五碼都不收", () => {
    assert.equal(normalizeHexColor("#abc"), null);
    assert.equal(normalizeHexColor("#1f6f3f80"), null);
    assert.equal(normalizeHexColor("#1f6f3f0"), null);
    assert.equal(normalizeHexColor("#1f6f3"), null);
  });

  it("沒帶 # 不收，就算六碼也一樣", () => {
    assert.equal(normalizeHexColor("1f6f3f"), null);
  });

  it("非十六進位字元不收", () => {
    assert.equal(normalizeHexColor("#1f6g3f"), null);
    assert.equal(normalizeHexColor("#gggggg"), null);
  });

  it("空字串與純空白回 null", () => {
    assert.equal(normalizeHexColor(""), null);
    assert.equal(normalizeHexColor("   "), null);
  });

  it("其他寫法（rgb、色名、多個色碼）一律 null，不試著轉換", () => {
    assert.equal(normalizeHexColor("rgb(31, 111, 63)"), null);
    assert.equal(normalizeHexColor("green"), null);
    assert.equal(normalizeHexColor("#1f6f3f #ffffff"), null);
  });

  it("不是字串的型別一律 null，不會丟例外", () => {
    assert.equal(normalizeHexColor(null), null);
    assert.equal(normalizeHexColor(undefined), null);
    assert.equal(normalizeHexColor(0x1f6f3f), null);
    assert.equal(normalizeHexColor(["#1f6f3f"]), null);
    assert.equal(normalizeHexColor({ hex: "#1f6f3f" }), null);
    assert.equal(normalizeHexColor(true), null);
  });
});
