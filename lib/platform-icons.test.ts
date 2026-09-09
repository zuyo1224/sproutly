import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_ICON_SIZES, PLATFORM_MANIFEST_ICONS } from "./platform-icons.ts";

// 這組值畫圖的 app/icon.tsx 與兩份 manifest 都在用，對不上是安靜壞掉（主畫面圖示
// 空白、Android 不跳安裝提示），所以把三個口徑寫死在這裡當護欄。
describe("PLATFORM_ICON_SIZES", () => {
  it("至少有一張 192 以上：Android 的安裝判定門檻", () => {
    assert.ok(PLATFORM_ICON_SIZES.some((size) => size >= 192));
  });

  it("是 192 與 512 兩張", () => {
    assert.deepEqual([...PLATFORM_ICON_SIZES], [192, 512]);
  });
});

describe("PLATFORM_MANIFEST_ICONS", () => {
  it("每個尺寸兩條（一條 any、一條 maskable），順序照 PLATFORM_ICON_SIZES", () => {
    assert.equal(PLATFORM_MANIFEST_ICONS.length, PLATFORM_ICON_SIZES.length * 2);
    assert.deepEqual(
      PLATFORM_MANIFEST_ICONS.map((icon) => icon.src),
      PLATFORM_ICON_SIZES.flatMap((size) => [`/icon/${size}`, `/icon/${size}`])
    );
  });

  it("每個尺寸都有一條沒寫 purpose 的：Android 的安裝判定只認這種", () => {
    for (const size of PLATFORM_ICON_SIZES) {
      const plain = PLATFORM_MANIFEST_ICONS.filter(
        (icon) => icon.src === `/icon/${size}` && !("purpose" in icon)
      );
      assert.equal(plain.length, 1);
    }
  });

  it("每個尺寸都有一條 maskable", () => {
    for (const size of PLATFORM_ICON_SIZES) {
      const maskable = PLATFORM_MANIFEST_ICONS.filter(
        (icon) => icon.src === `/icon/${size}` && "purpose" in icon
      );
      assert.equal(maskable.length, 1);
      assert.equal(
        (maskable[0] as { purpose: string }).purpose,
        "maskable"
      );
    }
  });

  it("src 是站內絕對路徑：manifest 掛在 /<slug>/site.webmanifest 底下也要指到同一張", () => {
    for (const icon of PLATFORM_MANIFEST_ICONS) {
      assert.ok(icon.src.startsWith("/icon/"));
    }
  });

  it("sizes 寫成 WxH 且跟 src 的尺寸一致", () => {
    for (const icon of PLATFORM_MANIFEST_ICONS) {
      const size = icon.src.split("/").pop();
      assert.equal(icon.sizes, `${size}x${size}`);
    }
  });

  it("type 一律 image/png：app/icon.tsx 用 next/og 畫出來的就是 png", () => {
    for (const icon of PLATFORM_MANIFEST_ICONS) {
      assert.equal(icon.type, "image/png");
    }
  });
});
