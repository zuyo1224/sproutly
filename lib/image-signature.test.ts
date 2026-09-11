// lib/image-signature 的行為固定測試：上傳的圖片「內容」到底是哪一種格式。
//
// 為什麼要有這份：這是後台收圖唯一看內容、不看檔名的一關。判斷錯的後果都在客人那邊——
// 把 HEIC 放行，客人看到破圖框；把正常的 png 擋掉，商家換不了圖卻不知道哪裡不對。
// 每一種格式的簽名都用真實開頭 byte 寫死在這裡，改壞任何一條會立刻紅。
//
// 跟其他 lib 測試同一套：node:test + node:assert，import 一律帶 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sniffImageType } from "./image-signature.ts";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) =>
      typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p,
    ),
  );
const text = (s: string) => new TextEncoder().encode(s);

describe("sniffImageType", () => {
  it("jpeg：開頭 FF D8 FF", () => {
    assert.equal(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF")), "jpeg");
    // 手機拍的 jpeg 第四個 byte 常是 E1（EXIF），一樣要認
    assert.equal(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe1], "Exif")), "jpeg");
  });

  it("png：固定八 byte 簽名", () => {
    assert.equal(
      sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
      "png",
    );
  });

  it("gif：GIF87a 與 GIF89a 都認", () => {
    assert.equal(sniffImageType(bytes("GIF89a", [0x10, 0x00])), "gif");
    assert.equal(sniffImageType(bytes("GIF87a", [0x10, 0x00])), "gif");
  });

  it("webp：RIFF 容器裡第 8 個 byte 起是 WEBP", () => {
    assert.equal(sniffImageType(bytes("RIFF", [0x24, 0x00, 0x00, 0x00], "WEBPVP8 ")), "webp");
  });

  it("RIFF 開頭但裡面不是 WEBP（例如 wav 音檔）不當 webp", () => {
    assert.equal(sniffImageType(bytes("RIFF", [0x24, 0x00, 0x00, 0x00], "WAVEfmt ")), null);
  });

  it("svg：直接以 <svg 開頭", () => {
    assert.equal(sniffImageType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), "svg");
  });

  it("svg：前面有 xml 宣告、DOCTYPE、註解與空白照樣認", () => {
    assert.equal(
      sniffImageType(
        text(
          '\n  <?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg viewBox="0 0 10 10"></svg>',
        ),
      ),
      "svg",
    );
  });

  it("svg：開頭帶 UTF-8 BOM 照樣認", () => {
    assert.equal(sniffImageType(bytes([0xef, 0xbb, 0xbf], "<svg></svg>")), "svg");
  });

  it("<svg> 出現在 1024 byte 之後的文字檔不當 svg（那是 html 裡夾了一個圖示，不是圖檔）", () => {
    const html = "<!DOCTYPE html><html><body>" + "x".repeat(1100) + "<svg></svg></body></html>";
    assert.equal(sniffImageType(text(html)), null);
  });

  it("<svgfoo> 這種只是字首相同的標籤不當 svg", () => {
    assert.equal(sniffImageType(text("<svgfoo></svgfoo>")), null);
  });

  it("HEIC（改名成 .jpg 最常見的那種）認不出來，回 null", () => {
    // HEIC 是 ISO 容器：前四 byte 是 box 長度，接著 "ftypheic"
    assert.equal(sniffImageType(bytes([0x00, 0x00, 0x00, 0x18], "ftypheic")), null);
  });

  it("pdf、純文字、空檔都回 null", () => {
    assert.equal(sniffImageType(text("%PDF-1.4")), null);
    assert.equal(sniffImageType(text("hello")), null);
    assert.equal(sniffImageType(new Uint8Array(0)), null);
  });

  it("檔案比簽名還短時回 null，不會讀出界", () => {
    assert.equal(sniffImageType(bytes([0xff, 0xd8])), null);
    assert.equal(sniffImageType(bytes("RIFF")), null);
    assert.equal(sniffImageType(bytes([0x89, 0x50, 0x4e])), null);
  });
});
