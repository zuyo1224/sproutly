// lib/faq-text.ts 的行為固定測試：全形、小寫的 Q／A 也要認得，空問空答要濾掉。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFaqText } from "./faq-text.ts";

describe("parseFaqText", () => {
  it("半形 Q:／A: 照舊解析，多行答案保留換行", () => {
    assert.deepEqual(
      parseFaqText("Q: 有出貨到外島嗎？\nA: 有\n運費另計\n\nQ: 可以面交嗎？\nA: 可以"),
      [
        { question: "有出貨到外島嗎？", answer: "有\n運費另計" },
        { question: "可以面交嗎？", answer: "可以" },
      ],
    );
  });

  it("全形、小寫、冒號前有空白都認", () => {
    assert.deepEqual(parseFaqText("Ｑ：外島？\nＡ：有\r\nq: 面交？\na : 可以"), [
      { question: "外島？", answer: "有" },
      { question: "面交？", answer: "可以" },
    ]);
  });

  it("空問、沒有答案的問題濾掉；開頭不是 Q 的行忽略", () => {
    assert.deepEqual(parseFaqText("隨便一行\nQ:\nA: 孤兒答案\nQ: 只有問題"), []);
  });

  it("Quality 這種字不會被當成問題", () => {
    assert.deepEqual(parseFaqText("Q: 材質？\nA: Quality first"), [
      { question: "材質？", answer: "Quality first" },
    ]);
  });
});
