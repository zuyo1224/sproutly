// 後台與店面「用關鍵字找東西」那條線的行為固定測試：
// lib/search-normalize（全形轉半形）、lib/phone-match（電話轉數字串）、
// lib/product-search（商品名稱／描述）、lib/customer-search（客人名單）、
// lib/order-search（訂單：DB ilike 的分流與轉義、記憶體逐筆比對）。
//
// 為什麼要有這份：這五支是六個搜尋入口（後台商品列表、逛街頁、Cmd+K 搜尋 API、
// 客人列表與匯出、訂單列表與匯出）唯一的口徑來源。它們各自解過一種「明明在名單裡
// 卻搜不到」的病：中文輸入法打出的全形英數、電話格式打法不同、+886 國碼、姓名裡
// 的逗號括號把 PostgREST 的 or() 拆爛、% 與 _ 被當萬用字元。這些病修好之後頁面
// 上完全看不出來（搜得到就是搜得到），只有改壞了才會在某個入口悄悄又搜不到，
// 所以把每一條邊界寫死在這裡，之後動任何一支跑 `npm test` 就知道動到哪條線。
//
// 跟 image-url.test.ts 同一套：Node 內建 node:test + node:assert，import 一律帶 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchText } from "./search-normalize.ts";
import { phoneDigits, samePhone } from "./phone-match.ts";
import {
  matchesProductDescription,
  matchesProductName,
  matchesProductSearch,
} from "./product-search.ts";
import { matchesCustomerSearch } from "./customer-search.ts";
import {
  applyOrderSearch,
  matchesOrderSearch,
  needsMemoryOrderSearch,
} from "./order-search.ts";

describe("normalizeSearchText（全形英數符號轉半形、全形空白轉半形、轉小寫）", () => {
  it("全形英文、數字、符號各轉成對應的半形", () => {
    assert.equal(normalizeSearchText("ｄａｎｎｙ"), "danny");
    assert.equal(normalizeSearchText("５號盆"), "5號盆");
    assert.equal(normalizeSearchText("！＠＃％＿"), "!@#%_");
  });

  it("全形空白（U+3000）轉成半形空白", () => {
    assert.equal(normalizeSearchText("王　小明"), "王 小明");
  });

  it("半形大寫轉小寫；已是半形小寫的原樣輸出", () => {
    assert.equal(normalizeSearchText("Monstera Deliciosa"), "monstera deliciosa");
    assert.equal(normalizeSearchText("abc-123"), "abc-123");
  });

  it("中文字與空字串不動", () => {
    assert.equal(normalizeSearchText("龜背芋"), "龜背芋");
    assert.equal(normalizeSearchText(""), "");
  });

  it("全形範圍是「！」到「～」：全形逗號「，」在範圍內轉成半形逗號，「。」在範圍外不轉", () => {
    assert.equal(normalizeSearchText("，。"), ",。");
  });
});

describe("phoneDigits／samePhone（客人電話轉成可比對的數字串）", () => {
  it("沒填回空字串", () => {
    assert.equal(phoneDigits(null), "");
    assert.equal(phoneDigits(undefined), "");
    assert.equal(phoneDigits(""), "");
  });

  it("連字號、空格、括號、加號全清掉只留數字", () => {
    assert.equal(phoneDigits("0912-345-678"), "0912345678");
    assert.equal(phoneDigits("0912 345 678"), "0912345678");
    assert.equal(phoneDigits("(02) 2345-6789"), "0223456789");
  });

  it("全形數字轉半形後再留數字", () => {
    assert.equal(phoneDigits("０９１２３４５６７８"), "0912345678");
  });

  it("+886 國碼還原成本地 0 開頭；純文字清完是空字串", () => {
    assert.equal(phoneDigits("+886912345678"), "0912345678");
    assert.equal(phoneDigits("+886 912 345 678"), "0912345678");
    assert.equal(phoneDigits("問我"), "");
  });

  it("samePhone：格式不同的同一支算同一支；任一邊沒數字就不算，空對空也不算", () => {
    assert.equal(samePhone("0912-345-678", "+886912345678"), true);
    assert.equal(samePhone("0912345678", "0912345679"), false);
    assert.equal(samePhone("", ""), false);
    assert.equal(samePhone(null, null), false);
    assert.equal(samePhone("問我", "問我"), false);
  });
});

describe("matchesProductSearch（商品名稱或描述含關鍵字）", () => {
  const plant = { name: "龜背芋 Monstera", description: "耐陰好養，5號盆" };
  const noDesc = { name: "琴葉榕", description: null };

  it("名稱命中、描述命中、都沒命中三種情況分得開", () => {
    assert.equal(matchesProductName(plant, "monstera"), true);
    assert.equal(matchesProductDescription(plant, "monstera"), false);
    assert.equal(matchesProductName(plant, "耐陰"), false);
    assert.equal(matchesProductDescription(plant, "耐陰"), true);
    assert.equal(matchesProductSearch(plant, "monstera"), true);
    assert.equal(matchesProductSearch(plant, "耐陰"), true);
    assert.equal(matchesProductSearch(plant, "仙人掌"), false);
  });

  it("大小寫與全形半形怎麼打都中", () => {
    assert.equal(matchesProductSearch(plant, "MONSTERA"), true);
    assert.equal(matchesProductSearch(plant, "ｍｏｎｓｔｅｒａ"), true);
    assert.equal(matchesProductSearch(plant, "５號盆"), true);
  });

  it("描述為 null 不炸，只比名稱", () => {
    assert.equal(matchesProductSearch(noDesc, "琴葉"), true);
    assert.equal(matchesProductDescription(noDesc, "琴葉"), false);
    assert.equal(matchesProductSearch(noDesc, "耐陰"), false);
  });

  it("空字串關鍵字一律算命中（呼叫端自己決定空字串要不要略過整個 filter）", () => {
    assert.equal(matchesProductSearch(plant, ""), true);
    assert.equal(matchesProductSearch(noDesc, ""), true);
  });
});

describe("matchesCustomerSearch（客人名單：姓名／Email／電話）", () => {
  const danny = { name: "Danny Wang", email: "Danny@Example.com", phone: "0912-345-678" };
  const noEmail = { name: "王小明", email: null, phone: "+886 987 654 321" };

  it("姓名、Email、電話原文子字串各自命中", () => {
    assert.equal(matchesCustomerSearch(danny, "danny"), true);
    assert.equal(matchesCustomerSearch(danny, "example.com"), true);
    assert.equal(matchesCustomerSearch(danny, "0912-345"), true);
    assert.equal(matchesCustomerSearch(danny, "小明"), false);
  });

  it("中文輸入法打出的全形英數也找得到", () => {
    assert.equal(matchesCustomerSearch(danny, "ｄａｎｎｙ"), true);
    assert.equal(matchesCustomerSearch(danny, "ＤＡＮＮＹ＠"), true);
  });

  it("電話格式打法不同也找得到：連字號、空格、+886 國碼、全形數字", () => {
    assert.equal(matchesCustomerSearch(danny, "0912345678"), true);
    assert.equal(matchesCustomerSearch(danny, "+886912345678"), true);
    assert.equal(matchesCustomerSearch(noEmail, "0987654321"), true);
    assert.equal(matchesCustomerSearch(noEmail, "0987-654-321"), true);
    assert.equal(matchesCustomerSearch(noEmail, "０９８７"), true);
  });

  it("搜的字串沒半個數字就不走數字比對；email 為 null 不炸", () => {
    assert.equal(matchesCustomerSearch(noEmail, "小明"), true);
    assert.equal(matchesCustomerSearch(noEmail, "example"), false);
  });

  it("數字不對就不中：不能因為兩邊都有數字就算命中", () => {
    assert.equal(matchesCustomerSearch(danny, "0999"), false);
  });
});

describe("needsMemoryOrderSearch（訂單搜尋走 DB ilike 還是記憶體逐筆比）", () => {
  it("純文字（姓名、Email）走 DB", () => {
    assert.equal(needsMemoryOrderSearch("danny"), false);
    assert.equal(needsMemoryOrderSearch("王小明"), false);
    assert.equal(needsMemoryOrderSearch("danny@example.com"), false);
  });

  it("含數字（電話、含數字的 Email）走記憶體，全形數字也算", () => {
    assert.equal(needsMemoryOrderSearch("0912"), true);
    assert.equal(needsMemoryOrderSearch("danny1224@example.com"), true);
    assert.equal(needsMemoryOrderSearch("０９１２"), true);
  });

  it("含 PostgREST or() 的保留字元 , ( ) 走記憶體，全形，（ ）轉半形後一樣算", () => {
    assert.equal(needsMemoryOrderSearch("Wang, Danny"), true);
    assert.equal(needsMemoryOrderSearch("王小明(阿明)"), true);
    assert.equal(needsMemoryOrderSearch("王小明（阿明）"), true);
    assert.equal(needsMemoryOrderSearch("王，小明"), true);
  });

  it("空字串走 DB（呼叫端本來就會先擋掉空字串）", () => {
    assert.equal(needsMemoryOrderSearch(""), false);
  });
});

describe("applyOrderSearch（組給 PostgREST 的 or ilike 條件）", () => {
  // 假的 filter builder：只記下 or() 收到的字串，回傳自己。
  function fakeQuery() {
    const calls: string[] = [];
    const q = {
      calls,
      or(filter: string) {
        calls.push(filter);
        return q;
      },
    };
    return q;
  }

  it("純半形關鍵字：三欄各一條 ilike，只有一組 needle", () => {
    const q = fakeQuery();
    const returned = applyOrderSearch(q, "danny");
    assert.equal(returned, q);
    assert.deepEqual(q.calls, [
      "customer_name.ilike.%danny%,customer_phone.ilike.%danny%,customer_email.ilike.%danny%",
    ]);
  });

  it("% 與 _ 轉義成 \\% 與 \\_，不會被當成萬用字元", () => {
    const q = fakeQuery();
    applyOrderSearch(q, "50%_off");
    assert.deepEqual(q.calls, [
      "customer_name.ilike.%50\\%\\_off%,customer_phone.ilike.%50\\%\\_off%,customer_email.ilike.%50\\%\\_off%",
    ]);
  });

  it("全形關鍵字：原文那組保留，再多一組轉半形的 needle（共六條）", () => {
    const q = fakeQuery();
    applyOrderSearch(q, "ｄａｎｎｙ");
    assert.equal(q.calls.length, 1);
    const parts = q.calls[0].split(",");
    assert.equal(parts.length, 6);
    assert.equal(parts[0], "customer_name.ilike.%ｄａｎｎｙ%");
    assert.equal(parts[3], "customer_name.ilike.%danny%");
  });

  it("大小寫不同不算「轉了半形」以外的差異：Danny 轉小寫後也會多一組", () => {
    const q = fakeQuery();
    applyOrderSearch(q, "Danny");
    assert.equal(q.calls[0].split(",").length, 6);
  });

  it("全形％＿轉成半形後一樣被轉義", () => {
    const q = fakeQuery();
    applyOrderSearch(q, "５０％");
    const parts = q.calls[0].split(",");
    assert.equal(parts[3], "customer_name.ilike.%50\\%%");
  });

  it("第二道保險：全形（ ）轉半形後含保留字元，就不加那組半形 needle", () => {
    const q = fakeQuery();
    applyOrderSearch(q, "王小明（阿明）");
    assert.equal(q.calls[0].split(",").length, 3);
    assert.equal(q.calls[0].startsWith("customer_name.ilike.%王小明（阿明）%"), true);
  });
});

describe("matchesOrderSearch（訂單記憶體逐筆比對：姓名／電話／Email）", () => {
  const order = {
    customer_name: "Danny Wang",
    customer_phone: "0912-345-678",
    customer_email: "danny@example.com",
  };
  const blank = { customer_name: null, customer_phone: null, customer_email: null };

  it("姓名、電話原文、Email 子字串各自命中", () => {
    assert.equal(matchesOrderSearch(order, "wang"), true);
    assert.equal(matchesOrderSearch(order, "0912-345"), true);
    assert.equal(matchesOrderSearch(order, "@example"), true);
    assert.equal(matchesOrderSearch(order, "小明"), false);
  });

  it("電話格式怎麼打都找得到：無分隔、空格、+886、全形", () => {
    assert.equal(matchesOrderSearch(order, "0912345678"), true);
    assert.equal(matchesOrderSearch(order, "0912 345 678"), true);
    assert.equal(matchesOrderSearch(order, "+886912345678"), true);
    assert.equal(matchesOrderSearch(order, "０９１２３４５"), true);
  });

  it("含逗號括號的姓名（走記憶體那條路）用字面子字串就能中，全形括號搜半形存的也中", () => {
    const named = { ...order, customer_name: "Wang, Danny (阿丹)" };
    assert.equal(matchesOrderSearch(named, "Wang, Danny"), true);
    assert.equal(matchesOrderSearch(named, "(阿丹)"), true);
    assert.equal(matchesOrderSearch(named, "（阿丹）"), true);
  });

  it("三欄都 null 不炸：純文字不中、空字串算中、數字不中", () => {
    assert.equal(matchesOrderSearch(blank, "danny"), false);
    assert.equal(matchesOrderSearch(blank, ""), true);
    assert.equal(matchesOrderSearch(blank, "0912"), false);
  });

  it("數字不對就不中", () => {
    assert.equal(matchesOrderSearch(order, "0999"), false);
  });
});
