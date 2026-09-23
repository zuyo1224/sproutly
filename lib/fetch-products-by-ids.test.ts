// lib/fetch-products-by-ids.ts 的行為固定測試。
//
// 為什麼要有這份：購物車頁與結帳頁都靠這支依 id 向 /[slug]/favorites/api 補商品資料，
// 兩頁的防呆（回應不 ok 就丟、回非陣列就丟）收成這一支之後，壞掉就是兩頁一起炸在
// products.map。這裡把全域 fetch 換成假的，寫死「打哪條網址、不走快取、兩種失敗都 throw」。
//
// 跟 fetch-order-items.test.ts 同一套：Node 內建 node:test + node:assert，import 寫 ./fetch-products-by-ids.ts。
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchProductsByIds } from "./fetch-products-by-ids.ts";

const realFetch = globalThis.fetch;

type Seen = { url: string; init: RequestInit | undefined };

// 把全域 fetch 換成回固定內容的假貨，記下每次被怎麼叫。
function stubFetch(status: number, body: unknown) {
  const seen: Seen[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return seen;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchProductsByIds（購物車／結帳補商品資料）", () => {
  it("打 /{slug}/favorites/api?ids=…、不走快取，陣列原樣回傳", async () => {
    const products = [
      { id: "a", name: "龜背芋" },
      { id: "b", name: "琴葉榕" },
    ];
    const seen = stubFetch(200, products);
    const out = await fetchProductsByIds<{ id: string; name: string }>(
      "plant-shop",
      "a,b"
    );

    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, "/plant-shop/favorites/api?ids=a%2Cb");
    assert.equal(seen[0].init?.cache, "no-store");
    assert.deepEqual(out, products);
  });

  it("空陣列也算成功，回空陣列", async () => {
    stubFetch(200, []);
    assert.deepEqual(await fetchProductsByIds("s", ""), []);
  });

  it("回應不 ok 時 throw，訊息帶狀態碼", async () => {
    stubFetch(500, { error: "boom" });
    await assert.rejects(fetchProductsByIds("s", "a"), /商品資料抓取失敗: 500/);
  });

  it("回應 ok 但內容不是陣列（API 回了錯誤物件）也 throw，不讓呼叫端炸在 .map", async () => {
    stubFetch(200, { error: "not found" });
    await assert.rejects(fetchProductsByIds("s", "a"), /回傳非陣列/);
  });

  it("回 null 同樣當失敗", async () => {
    stubFetch(200, null);
    await assert.rejects(fetchProductsByIds("s", "a"), /回傳非陣列/);
  });
});
