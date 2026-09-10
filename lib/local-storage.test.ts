// 客人裝置上四份「小抄」的行為固定測試：lib/cart（購物車）、lib/favorites（收藏）、
// lib/recent-products（最近看過）、lib/recent-orders（最近下的單）。四支都是
// localStorage based、per-store key，而且都是「讀回來時順便清洗」：JSON 壞掉、型別不對、
// 數量超出範圍，一律在讀的那一刻修掉或丟掉，頁面上永遠只看到乾淨的陣列。
//
// 為什麼要有這份：這四支沒有後端，改壞了不會噴錯，只會在客人的瀏覽器裡安靜地出事——
// 購物車徽章顯示 NaN、A 店開收藏頁把 B 店收藏清光、最近看過列出 NT$ 0、查單頁把別家店的
// 訂單編號帶進來。前三種都真的發生過、修過（見各檔案頂端註解），所以把修好的邊界寫死在這裡。
//
// Node 沒有 window / localStorage，這裡用 EventTarget 當 window、用 Map 當 localStorage
// 裝到 globalThis 上；每個 it 開頭都清空，測完把 globalThis 還原，不影響其他測試檔。
// 跟其他 lib 測試同一套：node:test + node:assert，import 一律帶 .ts。
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addToCart,
  clearCart,
  getCart,
  getCartCount,
  removeFromCart,
  setCart,
  updateQty,
} from "./cart.ts";
import {
  FAVORITES_CHANGED_EVENT,
  getFavoriteIds,
  setFavoriteIds,
} from "./favorites.ts";
import {
  getRecentProducts,
  rememberProduct,
  removeRecentProducts,
} from "./recent-products.ts";
import { getRecentOrders, rememberOrder } from "./recent-orders.ts";
import { QTY_MAX } from "./product-quantity.ts";

type FakeStorage = {
  store: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

function makeStorage(): FakeStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

const g = globalThis as Record<string, unknown>;
const saved = { window: g.window, localStorage: g.localStorage };
let storage: FakeStorage;
let fakeWindow: EventTarget;

before(() => {
  fakeWindow = new EventTarget();
  g.window = fakeWindow;
});

after(() => {
  g.window = saved.window;
  g.localStorage = saved.localStorage;
});

beforeEach(() => {
  storage = makeStorage();
  g.localStorage = storage;
});

// 直接看 localStorage 裡存了什麼，不經過任何 helper。
function rawJson(key: string): unknown {
  const raw = storage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

describe("cart：getCart 讀回來時清洗", () => {
  it("沒存過、空字串、壞 JSON、不是陣列，一律回空陣列", () => {
    assert.deepEqual(getCart("shop"), []);
    storage.setItem("sproutly_cart_shop", "");
    assert.deepEqual(getCart("shop"), []);
    storage.setItem("sproutly_cart_shop", "{not json");
    assert.deepEqual(getCart("shop"), []);
    storage.setItem("sproutly_cart_shop", JSON.stringify({ productId: "a", qty: 1 }));
    assert.deepEqual(getCart("shop"), []);
  });

  it("每家店各自一把 key，A 店的購物車不會出現在 B 店", () => {
    setCart("a", [{ productId: "p1", qty: 2 }]);
    assert.deepEqual(getCart("a"), [{ productId: "p1", qty: 2 }]);
    assert.deepEqual(getCart("b"), []);
  });

  it("productId 不是字串、或整筆是 null 的項目直接丟掉", () => {
    storage.setItem(
      "sproutly_cart_shop",
      JSON.stringify([
        null,
        { productId: 123, qty: 1 },
        { qty: 1 },
        { productId: "ok", qty: 1 },
      ])
    );
    assert.deepEqual(getCart("shop"), [{ productId: "ok", qty: 1 }]);
  });

  it("qty 夾到 1-99 的整數：0 與負數變 1、超量變 99、小數往下取整、數字字串轉數字", () => {
    storage.setItem(
      "sproutly_cart_shop",
      JSON.stringify([
        { productId: "zero", qty: 0 },
        { productId: "neg", qty: -5 },
        { productId: "big", qty: 500 },
        { productId: "frac", qty: 2.7 },
        { productId: "str", qty: "3" },
      ])
    );
    assert.deepEqual(getCart("shop"), [
      { productId: "zero", qty: 1 },
      { productId: "neg", qty: 1 },
      { productId: "big", qty: QTY_MAX },
      { productId: "frac", qty: 2 },
      { productId: "str", qty: 3 },
    ]);
  });

  it("qty 算不出數字（文字、undefined、null 以外的物件）的項目丟掉，徽章不會變 NaN", () => {
    storage.setItem(
      "sproutly_cart_shop",
      JSON.stringify([
        { productId: "abc", qty: "abc" },
        { productId: "none" },
        { productId: "obj", qty: {} },
        { productId: "ok", qty: 4 },
      ])
    );
    assert.deepEqual(getCart("shop"), [{ productId: "ok", qty: 4 }]);
    assert.equal(getCartCount("shop"), 4);
  });

  it("localStorage 讀取丟例外時回空陣列，不往外炸", () => {
    storage.getItem = () => {
      throw new Error("SecurityError");
    };
    assert.deepEqual(getCart("shop"), []);
  });

  it("沒有 window（伺服器端 render）時回空陣列", () => {
    g.window = undefined;
    try {
      storage.setItem("sproutly_cart_shop", JSON.stringify([{ productId: "p", qty: 1 }]));
      assert.deepEqual(getCart("shop"), []);
    } finally {
      g.window = fakeWindow;
    }
  });
});

describe("cart：加、改、刪、數、清", () => {
  it("setCart 存成 JSON 並對 window 廣播 sproutly-cart-changed", () => {
    let fired = 0;
    const onChange = () => {
      fired += 1;
    };
    fakeWindow.addEventListener("sproutly-cart-changed", onChange);
    try {
      setCart("shop", [{ productId: "p1", qty: 1 }]);
      assert.equal(fired, 1);
      assert.deepEqual(rawJson("sproutly_cart_shop"), [{ productId: "p1", qty: 1 }]);
    } finally {
      fakeWindow.removeEventListener("sproutly-cart-changed", onChange);
    }
  });

  it("setCart 寫入失敗時安靜吞掉，不丟例外", () => {
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    assert.doesNotThrow(() => setCart("shop", [{ productId: "p1", qty: 1 }]));
  });

  it("addToCart 新商品加一筆、同商品累加數量、預設一件", () => {
    addToCart("shop", "p1");
    addToCart("shop", "p2", 3);
    addToCart("shop", "p1", 2);
    assert.deepEqual(getCart("shop"), [
      { productId: "p1", qty: 3 },
      { productId: "p2", qty: 3 },
    ]);
  });

  it("addToCart 累加或單次超過 99 都卡在 99", () => {
    addToCart("shop", "p1", 98);
    addToCart("shop", "p1", 5);
    addToCart("shop", "p2", 500);
    assert.deepEqual(getCart("shop"), [
      { productId: "p1", qty: QTY_MAX },
      { productId: "p2", qty: QTY_MAX },
    ]);
  });

  it("addToCart 傳 0、負數、NaN 存進去的就是 1（入口就夾，存的跟讀回的一樣）", () => {
    addToCart("shop", "p1", 0);
    addToCart("shop", "p2", -5);
    addToCart("shop", "p3", Number.NaN);
    assert.deepEqual(rawJson("sproutly_cart_shop"), [
      { productId: "p1", qty: 1 },
      { productId: "p2", qty: 1 },
      { productId: "p3", qty: 1 },
    ]);
    assert.deepEqual(getCart("shop"), rawJson("sproutly_cart_shop"));
  });

  it("addToCart 小數往下取整、累加時傳負數不會把既有數量扣掉", () => {
    addToCart("shop", "p1", 2.9);
    assert.deepEqual(getCart("shop"), [{ productId: "p1", qty: 2 }]);
    addToCart("shop", "p1", -3);
    assert.deepEqual(rawJson("sproutly_cart_shop"), [{ productId: "p1", qty: 3 }]);
  });

  it("updateQty 改數量、超量卡 99、0 或負數等於移除", () => {
    setCart("shop", [
      { productId: "p1", qty: 1 },
      { productId: "p2", qty: 1 },
      { productId: "p3", qty: 1 },
    ]);
    updateQty("shop", "p1", 5);
    updateQty("shop", "p2", 500);
    updateQty("shop", "p3", 0);
    assert.deepEqual(getCart("shop"), [
      { productId: "p1", qty: 5 },
      { productId: "p2", qty: QTY_MAX },
    ]);
    updateQty("shop", "p1", -1);
    assert.deepEqual(getCart("shop"), [{ productId: "p2", qty: QTY_MAX }]);
  });

  // 小數與 NaN：以前 updateQty 只卡上限，2.5 會原樣寫進 localStorage（讀回被夾成 2，
  // 存的跟畫面上的不一樣）、NaN 因為「NaN <= 0」是 false 也被當有效數量寫進去，
  // JSON 存成 null、讀回變成 1。這兩條把修好的口徑寫死。
  it("updateQty 小數往下取整後才存，存進去的跟讀回來的一樣", () => {
    setCart("shop", [{ productId: "p1", qty: 1 }]);
    updateQty("shop", "p1", 2.9);
    assert.deepEqual(rawJson("sproutly_cart_shop"), [{ productId: "p1", qty: 2 }]);
    assert.deepEqual(getCart("shop"), [{ productId: "p1", qty: 2 }]);
  });

  it("updateQty 收到 0 到 1 之間的小數當成移除", () => {
    setCart("shop", [{ productId: "p1", qty: 3 }]);
    updateQty("shop", "p1", 0.5);
    assert.deepEqual(getCart("shop"), []);
  });

  it("updateQty 收到不是數字的值時什麼都不做，也不廣播", () => {
    setCart("shop", [{ productId: "p1", qty: 3 }]);
    let fired = 0;
    const onChange = () => {
      fired += 1;
    };
    fakeWindow.addEventListener("sproutly-cart-changed", onChange);
    try {
      updateQty("shop", "p1", NaN);
      updateQty("shop", "p1", Number.POSITIVE_INFINITY);
      updateQty("shop", "p1", "三" as unknown as number);
      assert.equal(fired, 0);
      assert.deepEqual(rawJson("sproutly_cart_shop"), [{ productId: "p1", qty: 3 }]);
      assert.deepEqual(getCart("shop"), [{ productId: "p1", qty: 3 }]);
    } finally {
      fakeWindow.removeEventListener("sproutly-cart-changed", onChange);
    }
  });

  it("updateQty 找不到商品時什麼都不做，也不廣播", () => {
    setCart("shop", [{ productId: "p1", qty: 1 }]);
    let fired = 0;
    const onChange = () => {
      fired += 1;
    };
    fakeWindow.addEventListener("sproutly-cart-changed", onChange);
    try {
      updateQty("shop", "ghost", 5);
      assert.equal(fired, 0);
      assert.deepEqual(getCart("shop"), [{ productId: "p1", qty: 1 }]);
    } finally {
      fakeWindow.removeEventListener("sproutly-cart-changed", onChange);
    }
  });

  it("removeFromCart 只移除指名的那一筆，不存在的 id 不影響其他", () => {
    setCart("shop", [
      { productId: "p1", qty: 1 },
      { productId: "p2", qty: 2 },
    ]);
    removeFromCart("shop", "p1");
    removeFromCart("shop", "ghost");
    assert.deepEqual(getCart("shop"), [{ productId: "p2", qty: 2 }]);
  });

  it("getCartCount 是各筆數量加總，空車是 0", () => {
    assert.equal(getCartCount("shop"), 0);
    setCart("shop", [
      { productId: "p1", qty: 2 },
      { productId: "p2", qty: 3 },
    ]);
    assert.equal(getCartCount("shop"), 5);
  });

  it("clearCart 清成空陣列且只清這家店", () => {
    setCart("a", [{ productId: "p1", qty: 1 }]);
    setCart("b", [{ productId: "p1", qty: 1 }]);
    clearCart("a");
    assert.deepEqual(getCart("a"), []);
    assert.deepEqual(rawJson("sproutly_cart_a"), []);
    assert.deepEqual(getCart("b"), [{ productId: "p1", qty: 1 }]);
  });
});

describe("favorites：per-store key 與舊全站 key 的播種", () => {
  it("沒存過回空陣列；壞 JSON、不是陣列也回空陣列", () => {
    assert.deepEqual(getFavoriteIds("shop"), []);
    storage.setItem("sproutly_favorites_shop", "{bad");
    assert.deepEqual(getFavoriteIds("shop"), []);
    storage.setItem("sproutly_favorites_shop", JSON.stringify("p1"));
    assert.deepEqual(getFavoriteIds("shop"), []);
  });

  it("只留字串 id，其他型別丟掉", () => {
    storage.setItem(
      "sproutly_favorites_shop",
      JSON.stringify(["p1", 2, null, { id: "p3" }, "p4"])
    );
    assert.deepEqual(getFavoriteIds("shop"), ["p1", "p4"]);
  });

  it("第一次讀某家店時，per-store key 不存在就整份抄舊的全站 key，舊 key 保留", () => {
    storage.setItem("sproutly_favorites", JSON.stringify(["p1", "other-store-p9"]));
    assert.deepEqual(getFavoriteIds("shop"), ["p1", "other-store-p9"]);
    assert.deepEqual(rawJson("sproutly_favorites_shop"), ["p1", "other-store-p9"]);
    assert.deepEqual(rawJson("sproutly_favorites"), ["p1", "other-store-p9"]);
    // 第二家店第一次讀也還能靠舊 key 播種
    assert.deepEqual(getFavoriteIds("shop2"), ["p1", "other-store-p9"]);
  });

  it("per-store key 已存在（哪怕是空陣列）就不再看舊 key", () => {
    storage.setItem("sproutly_favorites", JSON.stringify(["legacy"]));
    storage.setItem("sproutly_favorites_shop", JSON.stringify([]));
    assert.deepEqual(getFavoriteIds("shop"), []);
  });

  it("舊 key 也沒有時回空陣列，且不會憑空建 per-store key", () => {
    assert.deepEqual(getFavoriteIds("shop"), []);
    assert.equal(storage.getItem("sproutly_favorites_shop"), null);
  });

  it("A 店存收藏後 B 店讀不到（各店隔離）", () => {
    setFavoriteIds("a", ["p1"]);
    assert.deepEqual(getFavoriteIds("a"), ["p1"]);
    assert.deepEqual(getFavoriteIds("b"), []);
  });

  it("setFavoriteIds 對 window 廣播 FAVORITES_CHANGED_EVENT", () => {
    let fired = 0;
    const onChange = () => {
      fired += 1;
    };
    fakeWindow.addEventListener(FAVORITES_CHANGED_EVENT, onChange);
    try {
      setFavoriteIds("shop", ["p1"]);
      assert.equal(fired, 1);
    } finally {
      fakeWindow.removeEventListener(FAVORITES_CHANGED_EVENT, onChange);
    }
  });

  it("沒有 window 時回空陣列", () => {
    g.window = undefined;
    try {
      storage.setItem("sproutly_favorites_shop", JSON.stringify(["p1"]));
      assert.deepEqual(getFavoriteIds("shop"), []);
    } finally {
      g.window = fakeWindow;
    }
  });
});

const sample = {
  id: "p1",
  name: "龜背芋",
  priceCents: 45000,
  currency: "TWD",
  image: "https://example.com/p1.jpg",
};

describe("recent-products：最近看過小抄", () => {
  it("沒存過、壞 JSON、不是陣列回空陣列", () => {
    assert.deepEqual(getRecentProducts("shop"), []);
    storage.setItem("sproutly_recent_products_shop", "nope");
    assert.deepEqual(getRecentProducts("shop"), []);
    storage.setItem("sproutly_recent_products_shop", JSON.stringify({}));
    assert.deepEqual(getRecentProducts("shop"), []);
  });

  it("缺欄位或型別不對的項目丟掉；priceCents 是數字字串轉回數字、image 缺省變 null", () => {
    storage.setItem(
      "sproutly_recent_products_shop",
      JSON.stringify([
        { ...sample, viewedAt: "2026-09-09T00:00:00.000Z" },
        { ...sample, id: "p2", priceCents: "1200", image: null, viewedAt: "2026-09-08T00:00:00.000Z" },
        { ...sample, id: "p3", priceCents: "abc", viewedAt: "x" },
        { ...sample, id: "p4", image: 42, viewedAt: "x" },
        { ...sample, id: "p5", viewedAt: 123 },
        { ...sample, id: 6, viewedAt: "x" },
        null,
      ])
    );
    const got = getRecentProducts("shop");
    assert.deepEqual(
      got.map((p) => p.id),
      ["p1", "p2"]
    );
    assert.equal(got[1].priceCents, 1200);
    assert.equal(typeof got[1].priceCents, "number");
    assert.equal(got[1].image, null);
  });

  it("rememberProduct 最新看的排最前、同一株重看去重、寫入 viewedAt", () => {
    rememberProduct("shop", sample);
    rememberProduct("shop", { ...sample, id: "p2", name: "虎尾蘭" });
    rememberProduct("shop", sample);
    const got = getRecentProducts("shop");
    assert.deepEqual(
      got.map((p) => p.id),
      ["p1", "p2"]
    );
    assert.equal(typeof got[0].viewedAt, "string");
    assert.ok(!Number.isNaN(Date.parse(got[0].viewedAt)));
  });

  it("最多只留 12 筆，舊的從尾端掉出去", () => {
    for (let i = 1; i <= 15; i += 1) {
      rememberProduct("shop", { ...sample, id: `p${i}` });
    }
    const ids = getRecentProducts("shop").map((p) => p.id);
    assert.equal(ids.length, 12);
    assert.equal(ids[0], "p15");
    assert.equal(ids[11], "p4");
  });

  it("removeRecentProducts 只清指名的 id，回傳有沒有真的改到；空清單與沒中都回 false", () => {
    rememberProduct("shop", { ...sample, id: "p1" });
    rememberProduct("shop", { ...sample, id: "p2" });
    rememberProduct("shop", { ...sample, id: "p3" });
    assert.equal(removeRecentProducts("shop", []), false);
    assert.equal(removeRecentProducts("shop", ["ghost"]), false);
    assert.equal(removeRecentProducts("shop", ["p2", "ghost"]), true);
    assert.deepEqual(
      getRecentProducts("shop").map((p) => p.id),
      ["p3", "p1"]
    );
  });

  it("各店隔離：A 店的最近看過不會出現在 B 店", () => {
    rememberProduct("a", sample);
    assert.equal(getRecentProducts("a").length, 1);
    assert.deepEqual(getRecentProducts("b"), []);
  });

  it("沒有 window 時 getRecentProducts 回空陣列、removeRecentProducts 回 false", () => {
    g.window = undefined;
    try {
      storage.setItem(
        "sproutly_recent_products_shop",
        JSON.stringify([{ ...sample, viewedAt: "x" }])
      );
      assert.deepEqual(getRecentProducts("shop"), []);
      assert.equal(removeRecentProducts("shop", ["p1"]), false);
    } finally {
      g.window = fakeWindow;
    }
  });
});

// lib/recent-orders：成功頁只給客人看一次訂單編號，抄不到就只能回頭問店家。這支把
// 短碼＋查單電話記在客人自己的裝置上，查訂單頁才能一鍵帶入。壞法跟前三支同一類，
// 但後果更痛：清洗放鬆，totalCents 是字串就流到 formatPrice 顯示「NT$ 0」；
// 去重壞掉，成功頁一重整同一筆訂單就疊一列；上限或順序反了，最舊的單擠掉最新的那筆。
describe("recent-orders：這台裝置上的最近訂單小抄", () => {
  const sample = {
    shortId: "A1B2C3D4",
    phone: "0912345678",
    totalCents: 199000,
    currency: "TWD",
    createdAt: "2026-09-10T02:00:00.000Z",
  };

  it("沒存過、空字串、壞 JSON、不是陣列，一律回空陣列", () => {
    assert.deepEqual(getRecentOrders("shop"), []);
    storage.setItem("sproutly_recent_orders_shop", "");
    assert.deepEqual(getRecentOrders("shop"), []);
    storage.setItem("sproutly_recent_orders_shop", "{not json");
    assert.deepEqual(getRecentOrders("shop"), []);
    storage.setItem("sproutly_recent_orders_shop", JSON.stringify(sample));
    assert.deepEqual(getRecentOrders("shop"), []);
  });

  it("記一筆、讀回來一模一樣，並且存進 per-store key", () => {
    rememberOrder("shop", sample);
    assert.deepEqual(getRecentOrders("shop"), [sample]);
    assert.deepEqual(rawJson("sproutly_recent_orders_shop"), [sample]);
  });

  it("各店隔離：A 店記的單不會出現在 B 店的查單頁", () => {
    rememberOrder("a", sample);
    assert.equal(getRecentOrders("a").length, 1);
    assert.deepEqual(getRecentOrders("b"), []);
  });

  it("缺欄位或型別不對的整筆丟掉（短碼、電話、幣別、時間都必須是字串）", () => {
    storage.setItem(
      "sproutly_recent_orders_shop",
      JSON.stringify([
        null,
        { ...sample, shortId: 12345678 },
        { ...sample, phone: 912345678 },
        { ...sample, currency: null },
        { ...sample, createdAt: 1757462400000 },
        { ...sample, totalCents: undefined },
        sample,
      ])
    );
    assert.deepEqual(getRecentOrders("shop"), [sample]);
  });

  it("totalCents 是數字字串就轉回真數字，算不出數字的整筆丟掉（金額不顯示 NT$ 0）", () => {
    storage.setItem(
      "sproutly_recent_orders_shop",
      JSON.stringify([
        { ...sample, shortId: "STR", totalCents: "199000" },
        { ...sample, shortId: "NAN", totalCents: "免費" },
        { ...sample, shortId: "OBJ", totalCents: { cents: 199000 } },
      ])
    );
    const got = getRecentOrders("shop");
    assert.deepEqual(
      got.map((o) => o.shortId),
      ["STR"]
    );
    assert.equal(got[0].totalCents, 199000);
    assert.equal(typeof got[0].totalCents, "number");
  });

  it("totalCents 是 null 會被當成 0 存活下來（Number(null) 有限，現況如此）", () => {
    storage.setItem(
      "sproutly_recent_orders_shop",
      JSON.stringify([{ ...sample, totalCents: null }])
    );
    assert.deepEqual(getRecentOrders("shop"), [{ ...sample, totalCents: 0 }]);
  });

  it("同一筆訂單重複記（成功頁重整、查單頁再查）只留一列，且提到最前面", () => {
    rememberOrder("shop", sample);
    rememberOrder("shop", { ...sample, shortId: "OTHER123" });
    rememberOrder("shop", { ...sample, totalCents: 250000 });
    const got = getRecentOrders("shop");
    assert.equal(got.length, 2);
    assert.deepEqual(
      got.map((o) => o.shortId),
      [sample.shortId, "OTHER123"]
    );
    assert.equal(got[0].totalCents, 250000);
  });

  it("最新記的排最前面", () => {
    rememberOrder("shop", { ...sample, shortId: "FIRST" });
    rememberOrder("shop", { ...sample, shortId: "SECOND" });
    assert.deepEqual(
      getRecentOrders("shop").map((o) => o.shortId),
      ["SECOND", "FIRST"]
    );
  });

  it("最多留 10 筆，滿了之後掉的是最舊那筆", () => {
    for (let i = 1; i <= 13; i += 1) {
      rememberOrder("shop", { ...sample, shortId: `ORDER${i}` });
    }
    const got = getRecentOrders("shop");
    assert.equal(got.length, 10);
    assert.equal(got[0].shortId, "ORDER13");
    assert.equal(got[9].shortId, "ORDER4");
  });

  it("localStorage 讀或寫丟例外都安靜吞掉，不擋下單也不讓查單頁整頁掛掉", () => {
    const readBoom = makeStorage();
    readBoom.getItem = () => {
      throw new Error("SecurityError");
    };
    g.localStorage = readBoom;
    assert.deepEqual(getRecentOrders("shop"), []);

    const writeBoom = makeStorage();
    writeBoom.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    g.localStorage = writeBoom;
    assert.doesNotThrow(() => rememberOrder("shop", sample));
  });

  it("沒有 window 時 getRecentOrders 回空陣列", () => {
    g.window = undefined;
    try {
      storage.setItem("sproutly_recent_orders_shop", JSON.stringify([sample]));
      assert.deepEqual(getRecentOrders("shop"), []);
    } finally {
      g.window = fakeWindow;
    }
  });
});
