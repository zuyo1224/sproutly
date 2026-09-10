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
  UNSUPPORTED_IMAGE_ERROR,
  uploadImageContentType,
  uploadImageExtension,
} from "./upload-image-type.ts";

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
