// lib/upload-image-type 的行為固定測試：商家在後台換 logo、換 hero 圖、上傳商品照時，
// 「這個檔收不收」與「存進去標哪個型別」兩個判斷的每一條邊界。
//
// 為什麼要有這份：這兩個判斷之前埋在 uploadImage 裡，那支一開頭就連 Supabase Storage，
// 沒有金鑰跑不起來，所以從第一版到現在沒有任何測試碰過。而改壞了不會噴錯——副檔名擋錯
// 只是商家換圖時被回一句「格式只支援…」，型別標錯只是客人點圖時瀏覽器跳出下載而不是
// 把圖顯示出來，兩種都要等人撞到才知道。
//
// 跟其他 lib 測試同一套：node:test + node:assert，import 一律帶 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LOGO_FILE_ACCEPT,
  NOT_IMAGE_CONTENT_ERROR,
  PHOTO_FILE_ACCEPT,
  UNSUPPORTED_IMAGE_ERROR,
  resolveUploadImageType,
  uploadImageContentType,
  uploadImageExtension,
} from "./upload-image-type.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array(Array.from("RIFF\0\0\0\0WEBP", (c) => c.charCodeAt(0)));
const HEIC = new Uint8Array(Array.from("\0\0\0\x18ftypheic", (c) => c.charCodeAt(0)));
const SVG = new TextEncoder().encode("<svg></svg>");

describe("uploadImageExtension", () => {
  it("清單上的六種副檔名都收", () => {
    for (const ext of ["jpg", "jpeg", "png", "webp", "gif", "svg"]) {
      assert.equal(uploadImageExtension(`photo.${ext}`), ext);
    }
  });

  it("大寫副檔名收，回傳一律小寫（存檔路徑才不會同一種格式兩種寫法）", () => {
    assert.equal(uploadImageExtension("PHOTO.PNG"), "png");
    assert.equal(uploadImageExtension("photo.JpEg"), "jpeg");
  });

  it("檔名裡有好幾個點時只看最後一段", () => {
    assert.equal(uploadImageExtension("2026.05.21-盆栽.webp"), "webp");
  });

  it("中文檔名與空白照樣看得出副檔名", () => {
    assert.equal(uploadImageExtension("我的 店 logo.png"), "png");
  });

  it("清單外的格式不收", () => {
    assert.equal(uploadImageExtension("photo.heic"), null);
    assert.equal(uploadImageExtension("photo.bmp"), null);
    assert.equal(uploadImageExtension("履歷.pdf"), null);
  });

  it("整個檔名是空字串時當 jpg（有些來源給的 File 沒有名字，從第一版起就這樣放行）", () => {
    assert.equal(uploadImageExtension(""), "jpg");
  });

  it("完全沒有點的檔名不收（那時候拿到的是整個檔名，不是副檔名）", () => {
    assert.equal(uploadImageExtension("photo"), null);
    assert.equal(uploadImageExtension("IMG_0001"), null);
  });

  it("結尾是點的檔名跟著空字串走，當 jpg（取到的副檔名是空的，落到同一條預設）", () => {
    assert.equal(uploadImageExtension("photo."), "jpg");
  });

  it("擋下來時給的訊息是後台顯示的那句", () => {
    assert.equal(
      UNSUPPORTED_IMAGE_ERROR,
      "圖片格式只支援 jpg / png / webp / gif / svg",
    );
  });
});

describe("uploadImageContentType", () => {
  it("瀏覽器回報的是 image/ 型別就照用", () => {
    assert.equal(uploadImageContentType("png", "image/png"), "image/png");
    assert.equal(uploadImageContentType("svg", "image/svg+xml"), "image/svg+xml");
    assert.equal(uploadImageContentType("webp", "IMAGE/WEBP"), "IMAGE/WEBP");
  });

  it("沒回報型別時照副檔名推", () => {
    assert.equal(uploadImageContentType("png", ""), "image/png");
    assert.equal(uploadImageContentType("webp", null), "image/webp");
    assert.equal(uploadImageContentType("gif", undefined), "image/gif");
  });

  it("jpg 與 jpeg 都推成 image/jpeg，不是 image/jpg", () => {
    assert.equal(uploadImageContentType("jpg", ""), "image/jpeg");
    assert.equal(uploadImageContentType("jpeg", ""), "image/jpeg");
  });

  it("svg 推成 image/svg+xml，不是 image/svg", () => {
    assert.equal(uploadImageContentType("svg", ""), "image/svg+xml");
  });

  it("回報的不是圖片型別就不信，改照副檔名推", () => {
    // 這是唯一一條跟舊行為不一樣的：以前 application/octet-stream 會被原樣標上去，
    // 圖存得進去也開得回來，但客人的瀏覽器看到這個型別一律當附件下載，圖就開天窗。
    assert.equal(
      uploadImageContentType("png", "application/octet-stream"),
      "image/png",
    );
    assert.equal(uploadImageContentType("jpg", "text/plain"), "image/jpeg");
  });

  it("回報的型別前後有空白時去掉空白再判", () => {
    assert.equal(uploadImageContentType("png", "  image/png  "), "image/png");
    assert.equal(uploadImageContentType("png", "   "), "image/png");
  });
});

describe("resolveUploadImageType（檔名與內容兩關一起過）", () => {
  it("檔名與內容一致：照檔名的副檔名存，型別照瀏覽器回報的推", () => {
    assert.deepEqual(resolveUploadImageType("photo.png", PNG, "image/png"), {
      ok: true,
      ext: "png",
      contentType: "image/png",
    });
    // jpg 與 jpeg 都算跟 jpeg 內容一致，副檔名照檔名寫、不硬改
    assert.deepEqual(resolveUploadImageType("photo.jpeg", JPEG, ""), {
      ok: true,
      ext: "jpeg",
      contentType: "image/jpeg",
    });
    assert.deepEqual(resolveUploadImageType("logo.svg", SVG, "image/svg+xml"), {
      ok: true,
      ext: "svg",
      contentType: "image/svg+xml",
    });
  });

  it("檔名清單外的先擋，還沒看內容（訊息維持原本那句）", () => {
    assert.deepEqual(resolveUploadImageType("photo.heic", HEIC, "image/heic"), {
      ok: false,
      error: UNSUPPORTED_IMAGE_ERROR,
    });
    assert.deepEqual(resolveUploadImageType("photo.bmp", PNG, ""), {
      ok: false,
      error: UNSUPPORTED_IMAGE_ERROR,
    });
  });

  it("檔名是 .jpg 但內容是 HEIC：擋下來，訊息點名 HEIC 該怎麼處理", () => {
    // 這是這關最主要的目的。以前這種檔被標成 image/jpeg 存進去，客人看到破圖框。
    const result = resolveUploadImageType("IMG_0001.jpg", HEIC, "image/jpeg");
    assert.deepEqual(result, { ok: false, error: NOT_IMAGE_CONTENT_ERROR });
    assert.match(NOT_IMAGE_CONTENT_ERROR, /HEIC/);
  });

  it("內容是 pdf、純文字或空檔一律擋", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4");
    assert.equal(resolveUploadImageType("scan.png", pdf, "image/png").ok, false);
    assert.equal(resolveUploadImageType("x.jpg", new Uint8Array(0), "image/jpeg").ok, false);
  });

  it("檔名與內容不一致（.jpg 裡面是 webp）：以內容為準，路徑與型別都照內容寫", () => {
    // 從 IG、網頁另存下來的圖常這樣。以前放行且標成 image/jpeg，現在照樣放行但存對。
    assert.deepEqual(resolveUploadImageType("photo.jpg", WEBP, "image/jpeg"), {
      ok: true,
      ext: "webp",
      contentType: "image/webp",
    });
    // 反過來 .png 裡面是 jpeg：存成 jpg（不是 jpeg），跟站上其他地方的習慣一致
    assert.deepEqual(resolveUploadImageType("photo.png", JPEG, "image/png"), {
      ok: true,
      ext: "jpg",
      contentType: "image/jpeg",
    });
  });

  it("不一致時瀏覽器回報的型別不再參考（回報 image/png 內容卻是 webp，仍標 image/webp）", () => {
    const result = resolveUploadImageType("photo.png", WEBP, "image/png");
    assert.equal(result.ok && result.contentType, "image/webp");
  });

  it("沒有檔名的 File（當 jpg 放行的那條）內容也要真的是 jpeg 才收", () => {
    assert.equal(resolveUploadImageType("", JPEG, "").ok, true);
    assert.deepEqual(resolveUploadImageType("", HEIC, ""), {
      ok: false,
      error: NOT_IMAGE_CONTENT_ERROR,
    });
  });
});

describe("選檔框的 accept 清單", () => {
  // 副檔名 → 選檔框那串裡對應的寫法。uploadImageContentType 推出來的就是這個值，
  // 所以直接借它，兩邊不會各維護一份對照表。
  const typeOf = (ext: string) => uploadImageContentType(ext, "");
  const listOf = (accept: string) => accept.split(",");

  it("兩串裡的每一種型別，後端都真的收得下", () => {
    // 反過來的方向才是會出事的那邊：選檔框端出一種後端會擋的格式，商家選得到、
    // 送出去卻被回一句「格式只支援…」。
    const backendTypes = new Set(
      ["jpg", "jpeg", "png", "webp", "gif", "svg"].map(typeOf),
    );
    for (const accept of [LOGO_FILE_ACCEPT, PHOTO_FILE_ACCEPT]) {
      for (const type of listOf(accept)) {
        assert.ok(backendTypes.has(type), `${type} 後端不收`);
      }
    }
  });

  it("兩串都沒有空白、沒有重複，逗號分隔照 accept 的寫法", () => {
    for (const accept of [LOGO_FILE_ACCEPT, PHOTO_FILE_ACCEPT]) {
      assert.ok(!/\s/.test(accept), `${accept} 有空白`);
      const list = listOf(accept);
      assert.equal(new Set(list).size, list.length);
      for (const type of list) {
        assert.ok(type.startsWith("image/"), `${type} 不是圖片型別`);
      }
    }
  });

  it("logo 那串收 svg，照片那串不收（照片走 next/image 最佳化，svg 會變破圖）", () => {
    assert.ok(listOf(LOGO_FILE_ACCEPT).includes("image/svg+xml"));
    assert.ok(!listOf(PHOTO_FILE_ACCEPT).includes("image/svg+xml"));
  });

  it("差別只有 svg 一項，其餘四種兩串都有", () => {
    for (const ext of ["jpg", "png", "webp", "gif"]) {
      assert.ok(listOf(LOGO_FILE_ACCEPT).includes(typeOf(ext)), ext);
      assert.ok(listOf(PHOTO_FILE_ACCEPT).includes(typeOf(ext)), ext);
    }
    assert.equal(
      listOf(LOGO_FILE_ACCEPT).length,
      listOf(PHOTO_FILE_ACCEPT).length + 1,
    );
  });
});
