// lib/business-hours-schema.ts 的行為固定測試。
//
// 為什麼要有這份：parseBusinessHoursToSpec 是「商家後台一格自由文字的營業時間」變成「餵給
// Google 的 OpeningHoursSpecification」那條線唯一的口徑來源（store-schema.ts 的 Store JSON-LD
// 直接吃它的輸出）。它是整條結構化資料線最複雜的純函式：中文數字鐘點、上午下午換算、
// AM/PM、點分隔時間、午休拆段、24 小時店、中英文公休、星期區間跨週尾……每一條規則都是
// 為了多接住一種台灣店家真的會打的寫法，而它的態度是「判不可靠就整段回 null、寧可不放
// 也不放錯」。這種東西改一條 regex 很容易「接住新寫法、順便把舊寫法判錯」，而頁面上完全
// 看不出來（給人看的原始文字不受影響，只有 Google 收到壞值）。這裡把每條規則的「認得出
// 什麼、什麼要回 null」寫死，之後動任何一段 regex 跑 `npm test` 就知道有沒有踩到別條。
//
// 同 image-url.test.ts 那套：Node 內建 node:test + node:assert，不裝框架，import 寫 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBusinessHoursToSpec, type OpeningHoursSpec } from "./business-hours-schema.ts";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const ALL = [...WEEKDAYS, "Saturday", "Sunday"];

// 組一筆期望值，讓每條測試的 assert 讀起來是「哪幾天、幾點到幾點」而不是一坨物件。
function spec(dayOfWeek: string[], opens: string, closes: string): OpeningHoursSpec {
  return { "@type": "OpeningHoursSpecification", dayOfWeek, opens, closes };
}

describe("parseBusinessHoursToSpec：空值與判不出就回 null", () => {
  it("null／undefined／空字串／純空白都回 null", () => {
    assert.equal(parseBusinessHoursToSpec(null), null);
    assert.equal(parseBusinessHoursToSpec(undefined), null);
    assert.equal(parseBusinessHoursToSpec(""), null);
    assert.equal(parseBusinessHoursToSpec("   "), null);
  });

  it("非字串（手打請求塞數字／物件）回 null，不丟例外", () => {
    assert.equal(parseBusinessHoursToSpec(123 as unknown as string), null);
    assert.equal(parseBusinessHoursToSpec({} as unknown as string), null);
  });

  it("有時間但完全沒寫星期、也沒寫公休 → 判不出營業日回 null", () => {
    assert.equal(parseBusinessHoursToSpec("10:00-18:00"), null);
  });

  it("有星期但沒有時間區間 → 回 null", () => {
    assert.equal(parseBusinessHoursToSpec("週一至週五營業"), null);
  });

  it("時間不合法（25 點、60 分、24:00 收班）→ 回 null，不亂修正", () => {
    assert.equal(parseBusinessHoursToSpec("每日 10:00-25:00"), null);
    assert.equal(parseBusinessHoursToSpec("每日 10:60-18:00"), null);
    assert.equal(parseBusinessHoursToSpec("每日 14:00-24:00"), null);
  });

  it("「14:00-24:00」裡的 24 不會被誤判成 24 小時店", () => {
    assert.equal(parseBusinessHoursToSpec("週一至週五 14:00-24:00"), null);
  });
});

describe("parseBusinessHoursToSpec：基本格式與正規化", () => {
  it("週一至週五 10:00-18:00 → 五個平日一筆", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週一至週五 10:00-18:00"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
  });

  it("全形數字／全形冒號／各種破折號與「到／～」都正規化", () => {
    const expected = [spec(WEEKDAYS, "10:00", "18:00")];
    assert.deepEqual(parseBusinessHoursToSpec("週一到週五 １０：００～１８：００"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("週一—週五 10:00–18:00"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("星期一至星期五 10:00〜18:00"), expected);
  });

  it("個位數小時補零（9:00 → 09:00）", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日 9:00-5:30"), [spec(ALL, "09:00", "05:30")]);
  });

  it("點當分隔的時間（10.00-18.00、9.30）換成冒號；「100.00」不會被誤切", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日 9.30-18.00"), [spec(ALL, "09:30", "18:00")]);
    assert.equal(parseBusinessHoursToSpec("每日 100.00-18.00"), null);
  });

  it("前後多餘空白與多重空白不影響", () => {
    assert.deepEqual(parseBusinessHoursToSpec("  週一至週五   10:00 - 18:00  "), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
  });
});

describe("parseBusinessHoursToSpec：中文星期規則", () => {
  it("星期區間跨週尾（週六-週一）從六走到日再接回一", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週六至週一 10:00-18:00"), [
      spec(["Saturday", "Sunday", "Monday"], "10:00", "18:00"),
    ]);
  });

  it("「日／天／七」都當週日；「禮拜」「周」前綴都認", () => {
    const expected = [spec(["Saturday", "Sunday"], "10:00", "18:00")];
    assert.deepEqual(parseBusinessHoursToSpec("禮拜六至禮拜天 10:00-18:00"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("周六到周日 10:00-18:00"), expected);
  });

  it("平日／週間／工作日 = 週一到週五", () => {
    assert.deepEqual(parseBusinessHoursToSpec("平日 10:00-18:00"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("工作日 10:00-18:00"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
  });

  it("每日／天天／全年無休 = 全週", () => {
    const expected = [spec(ALL, "11:00", "19:00")];
    assert.deepEqual(parseBusinessHoursToSpec("每日 11:00-19:00"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("天天 11:00-19:00"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("全年無休 11:00-19:00"), expected);
  });

  it("只寫「週末」= 週六日", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週末 10:00-18:00"), [
      spec(["Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });

  it("逐一列出：一個前綴帶一串（週一三五）、頓號逗號斜線隔開都認，輸出照星期排序", () => {
    const expected = [spec(["Monday", "Wednesday", "Friday"], "10:00", "18:00")];
    assert.deepEqual(parseBusinessHoursToSpec("週一三五 10:00-18:00"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("週一、三、五 10:00-18:00"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("週五/週三/週一 10:00-18:00"), expected);
  });

  it("「週六日」併寫兩天都算", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週六日 10:00-18:00"), [
      spec(["Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });
});

describe("parseBusinessHoursToSpec：公休扣除", () => {
  it("「週三公休，其餘 10:00-18:00」→ 全週扣週三", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週三公休，其餘 10:00-18:00"), [
      spec(["Monday", "Tuesday", "Thursday", "Friday", "Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });

  it("只寫公休沒寫其餘（「週一公休 10:00-18:00」）也推定公休以外都開", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週一公休 10:00-18:00"), [
      spec(["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });

  it("「週六、週日公休」每天各帶前綴，兩天都扣；「週六日公休」併寫也兩天都扣", () => {
    const expected = [spec(WEEKDAYS, "10:00", "18:00")];
    assert.deepEqual(parseBusinessHoursToSpec("每日 10:00-18:00，週六、週日公休"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("每日 10:00-18:00，週六日公休"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("每日 10:00-18:00，週六、日店休"), expected);
  });

  it("週末公休／例假日休 扣週六日", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日 10:00-18:00，週末公休"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("每日 10:00-18:00 例假日休"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
  });

  it("星期區間裡標了公休的那天也扣掉", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週一至週日 10:00-18:00，週二公休"), [
      spec(["Monday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });

  it("「週末 10-18 公休」這種夾著時間的不視為休", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週末 10:00-18:00 公休"), [
      spec(["Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });
});

describe("parseBusinessHoursToSpec：午休拆段與多段時間", () => {
  it("同一批營業日的午休拆段 → 同一組星期各輸出一筆", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週一至週五 11:00-14:00、17:00-21:00"), [
      spec(WEEKDAYS, "11:00", "14:00"),
      spec(WEEKDAYS, "17:00", "21:00"),
    ]);
  });

  it("兩段之間夾了星期字（不同日不同時）→ 對不起來，回 null", () => {
    assert.equal(parseBusinessHoursToSpec("週一至週五 09:00-18:00，週六 10:00-15:00"), null);
  });

  it("兩段重疊或順序亂 → 回 null", () => {
    assert.equal(parseBusinessHoursToSpec("每日 11:00-15:00、14:00-21:00"), null);
    assert.equal(parseBusinessHoursToSpec("每日 17:00-21:00、11:00-14:00"), null);
  });

  it("三段拆段也照順序全保留", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日 08:00-10:00, 12:00-14:00, 18:00-20:00"), [
      spec(ALL, "08:00", "10:00"),
      spec(ALL, "12:00", "14:00"),
      spec(ALL, "18:00", "20:00"),
    ]);
  });
});

describe("parseBusinessHoursToSpec：24 小時店", () => {
  it("「24小時營業」沒寫星期 → 全週 00:00-23:59", () => {
    assert.deepEqual(parseBusinessHoursToSpec("24小時營業"), [spec(ALL, "00:00", "23:59")]);
  });

  it("「二十四小時」「全天候」「24/7」「24h」都認", () => {
    const expected = [spec(ALL, "00:00", "23:59")];
    assert.deepEqual(parseBusinessHoursToSpec("二十四小時營業"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("全天候"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("24/7"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("24h"), expected);
  });

  it("有寫星期的 24 小時店只給那幾天", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週一至週五 24小時"), [
      spec(WEEKDAYS, "00:00", "23:59"),
    ]);
  });

  it("24 小時店標公休一樣扣", () => {
    assert.deepEqual(parseBusinessHoursToSpec("24小時營業，週日公休"), [
      spec([...WEEKDAYS, "Saturday"], "00:00", "23:59"),
    ]);
  });

  it("同時有 HH:MM 區間時以區間為準，不因為提到 24 小時就蓋掉", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日 10:00-18:00（非 24 小時）"), [
      spec(ALL, "10:00", "18:00"),
    ]);
  });
});

describe("parseBusinessHoursToSpec：中文「點／時」鐘點", () => {
  it("早上10點到晚上9點 → 10:00-21:00", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日早上10點到晚上9點"), [
      spec(ALL, "10:00", "21:00"),
    ]);
  });

  it("「下午2點到6點」後段沿用前段的下午 → 14:00-18:00", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日下午2點到6點"), [spec(ALL, "14:00", "18:00")]);
  });

  it("後段沒帶時段且不是破折號相連 → 不沿用（各自獨立）", () => {
    // 「下午2點 6點」中間只有空白，6 點照字面當 06:00；findTimeRanges 抓不到區間 → null。
    assert.equal(parseBusinessHoursToSpec("每日下午2點 6點"), null);
  });

  it("「9點半」「10時30分」「18點整」", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日9點半-18點整"), [spec(ALL, "09:30", "18:00")]);
    assert.deepEqual(parseBusinessHoursToSpec("每日 10時30分至18時"), [
      spec(ALL, "10:30", "18:00"),
    ]);
  });

  it("上午 12 點＝00:00、中午 12 點＝12:00、晚上 12 點＝00:00", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日上午12點到中午12點"), [
      spec(ALL, "00:00", "12:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("每日下午6點到晚上12點"), [
      spec(ALL, "18:00", "00:00"),
    ]);
  });

  it("中文數字鐘點：十點、廿一點、兩點半、十一時（後段沿用前段的「下午」→ 23:00）", () => {
    assert.deepEqual(parseBusinessHoursToSpec("每日十點到廿一點"), [spec(ALL, "10:00", "21:00")]);
    assert.deepEqual(parseBusinessHoursToSpec("每日下午兩點半至十一時"), [
      spec(ALL, "14:30", "23:00"),
    ]);
  });

  it("「二十四小時」夾著「小」字不會被當成鐘點吃掉", () => {
    assert.deepEqual(parseBusinessHoursToSpec("週一至週五 二十四小時"), [
      spec(WEEKDAYS, "00:00", "23:59"),
    ]);
  });

  it("「一二點」這種亂湊的中文數字不轉、整段回 null", () => {
    assert.equal(parseBusinessHoursToSpec("每日一二點到六點"), null);
  });

  it("下午 25 點這種不合法的原樣留著 → 回 null", () => {
    assert.equal(parseBusinessHoursToSpec("每日 25點到26點"), null);
  });
});

describe("parseBusinessHoursToSpec：英文 AM/PM 與英文星期", () => {
  it("Mon-Fri 10am-6pm → 平日 10:00-18:00", () => {
    assert.deepEqual(parseBusinessHoursToSpec("Mon-Fri 10am-6pm"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
  });

  it("AM/PM 前綴、a.m./p.m. 帶點、10.30am 點分隔都認", () => {
    assert.deepEqual(parseBusinessHoursToSpec("Daily AM10:00-PM10:00"), [
      spec(ALL, "10:00", "22:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("Daily 10.30 a.m. - 9:00 p.m."), [
      spec(ALL, "10:30", "21:00"),
    ]);
  });

  it("12AM＝00:00、12PM＝12:00；13PM 打錯原樣保留 → 回 null", () => {
    assert.deepEqual(parseBusinessHoursToSpec("Daily 12am-12pm"), [spec(ALL, "00:00", "12:00")]);
    assert.equal(parseBusinessHoursToSpec("Daily 10am-13pm"), null);
  });

  it("時間連接詞 to／till／until／through 都認", () => {
    const expected = [spec(WEEKDAYS, "10:00", "18:00")];
    assert.deepEqual(parseBusinessHoursToSpec("Monday to Friday 10am to 6pm"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("Mon thru Fri 10:00 till 18:00"), expected);
    assert.deepEqual(parseBusinessHoursToSpec("Mon until Fri 10:00 until 18:00"), expected);
  });

  it("英文星期範圍跨週尾（Sat-Mon）、縮寫變體（Tues／Thurs／Weds.）", () => {
    assert.deepEqual(parseBusinessHoursToSpec("Sat-Mon 10:00-18:00"), [
      spec(["Saturday", "Sunday", "Monday"], "10:00", "18:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("Tues, Thurs 10:00-18:00"), [
      spec(["Tuesday", "Thursday"], "10:00", "18:00"),
    ]);
  });

  it("Daily／Everyday／7 days a week 全週；Weekdays 平日；Weekends 週六日", () => {
    assert.deepEqual(parseBusinessHoursToSpec("Everyday 10:00-18:00"), [
      spec(ALL, "10:00", "18:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("7 days a week 10:00-18:00"), [
      spec(ALL, "10:00", "18:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("Weekdays 10:00-18:00"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("Weekends 10:00-18:00"), [
      spec(["Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });

  it("英文公休：closed Sunday／Closed on Sundays／Sat & Sun closed／closed weekends", () => {
    const noSun = [spec([...WEEKDAYS, "Saturday"], "10:00", "18:00")];
    assert.deepEqual(parseBusinessHoursToSpec("Daily 10:00-18:00, closed Sunday"), noSun);
    assert.deepEqual(parseBusinessHoursToSpec("Daily 10:00-18:00. Closed on Sundays"), noSun);
    assert.deepEqual(parseBusinessHoursToSpec("Daily 10:00-18:00, Sat & Sun closed"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
    assert.deepEqual(parseBusinessHoursToSpec("Daily 10:00-18:00, closed weekends"), [
      spec(WEEKDAYS, "10:00", "18:00"),
    ]);
  });

  it("只寫英文公休沒寫營業日 → 推定公休以外都開", () => {
    assert.deepEqual(parseBusinessHoursToSpec("10am-6pm, closed Monday"), [
      spec(["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "10:00", "18:00"),
    ]);
  });

  it("純 24 小時制沒有 AM/PM 的數字不被碰", () => {
    assert.deepEqual(parseBusinessHoursToSpec("Mon-Fri 08:00-20:00"), [
      spec(WEEKDAYS, "08:00", "20:00"),
    ]);
  });
});

describe("parseBusinessHoursToSpec：輸出形狀", () => {
  it("每筆都帶 @type，dayOfWeek 是 schema.org 英文星期字串", () => {
    const out = parseBusinessHoursToSpec("週一至週五 10:00-18:00");
    assert.ok(out);
    for (const s of out) {
      assert.equal(s["@type"], "OpeningHoursSpecification");
      assert.ok(Array.isArray(s.dayOfWeek));
      assert.match(s.opens, /^\d{2}:\d{2}$/);
      assert.match(s.closes, /^\d{2}:\d{2}$/);
    }
  });

  it("拆段的每筆 dayOfWeek 內容相同", () => {
    const out = parseBusinessHoursToSpec("週一至週五 11:00-14:00、17:00-21:00");
    assert.ok(out);
    assert.equal(out.length, 2);
    assert.deepEqual(out[0].dayOfWeek, out[1].dayOfWeek);
  });
});
