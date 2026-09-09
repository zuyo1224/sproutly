// lib/format-date.ts 台灣時區日期口徑的行為固定測試。
//
// 為什麼要有這份：分日統計 key、訂單篩選「今天／本週／本月」切點、「幾天前」、
// 各種給人看的時間戳全走這一檔。伺服器（Vercel）跑 UTC，最容易壞的是「凌晨 0-8 點
// 的單被算進前一天」——壞了不會噴錯，只是統計差一天、卡片上的日期跟「今天」標籤
// 互相打臉。這裡把「以台灣午夜切日」跟每種版面的長相寫死，改壞哪一支馬上看得到。
//
// 吃 now 的三支（taipeiStartOfMonth／taipeiDaysAgo／taipeiRangeSince）用 node:test 的
// mock.timers 把 Date 釘在固定時間點，跑完 reset，不影響其他測試檔。
import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  taipeiDateKey,
  taipeiStampShort,
  taipeiDateNumeric,
  taipeiStampLong,
  taipeiStampFull,
  taipeiStampNumeric,
  taipeiDateMonthDay,
  taipeiStampMonthDay,
  taipeiDateLong,
  taipeiStartOfMonth,
  taipeiDaysAgo,
  taipeiRangeSince,
} from "./format-date.ts";

// UTC 3/1 20:30:45 = 台灣 3/2 凌晨 04:30:45，剛好是「UTC 還在前一天」的那種時間點。
const LATE = "2026-03-01T20:30:45Z";
// UTC 3/1 06:05 = 台灣 3/1 下午 14:05，同一天，用來看上午／下午標示。
const AFTERNOON = "2026-03-01T06:05:00Z";

function freezeNow(iso: string) {
  mock.timers.enable({ apis: ["Date"], now: new Date(iso).getTime() });
}

afterEach(() => {
  mock.timers.reset();
});

describe("taipeiDateKey", () => {
  it("用台灣時區切日：UTC 晚上 8 點半已經是台灣隔天", () => {
    assert.equal(taipeiDateKey(new Date(LATE)), "2026-03-02");
  });

  it("台灣午夜前一秒與後一秒分屬兩天", () => {
    assert.equal(taipeiDateKey(new Date("2026-03-01T15:59:59Z")), "2026-03-01");
    assert.equal(taipeiDateKey(new Date("2026-03-01T16:00:00Z")), "2026-03-02");
  });

  it("格式是 YYYY-MM-DD，月日補零，可以直接拼 T00:00:00+08:00", () => {
    const key = taipeiDateKey(new Date(LATE));
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(
      new Date(`${key}T00:00:00+08:00`).toISOString(),
      "2026-03-01T16:00:00.000Z"
    );
  });
});

// 注意：zh-TW 的純數字版面（Short／Full／Numeric）日期與時間之間是 U+2009 thin space，
// 長名版面（Long／MonthDay）才是普通空白。這是 Intl 的既定輸出，斷言照實寫。
describe("給人看的時間戳（zh-TW、台灣時區）", () => {
  it("taipeiStampShort 月/日 時:分，不帶年份，台灣時區", () => {
    assert.equal(taipeiStampShort(LATE), "03/02\u2009上午04:30");
    assert.equal(taipeiStampShort(AFTERNOON), "03/01\u2009下午02:05");
  });

  it("taipeiDateNumeric 年/月/日純數字補零、不含時間", () => {
    assert.equal(taipeiDateNumeric(LATE), "2026/03/02");
  });

  it("taipeiStampLong 年 月（長名）日 時:分", () => {
    assert.equal(taipeiStampLong(LATE), "2026年3月2日 上午04:30");
  });

  it("taipeiStampFull 帶秒的完整日期時間（瀏覽器預設版面）", () => {
    assert.equal(taipeiStampFull(LATE), "2026/3/2\u2009上午4:30:45");
  });

  it("taipeiStampNumeric 年/月/日 時:分 純數字補零（CSV 排序用）", () => {
    assert.equal(taipeiStampNumeric(LATE), "2026/03/02\u2009上午04:30");
  });

  it("taipeiDateMonthDay 月（長名）日，不含年份與時間", () => {
    assert.equal(taipeiDateMonthDay(LATE), "3月2日");
  });

  it("taipeiStampMonthDay 月（長名）日 時:分，不含年份", () => {
    assert.equal(taipeiStampMonthDay(LATE), "3月2日 上午04:30");
  });

  it("taipeiDateLong 年 月（長名）日，不含時間", () => {
    assert.equal(taipeiDateLong(LATE), "2026年3月2日");
  });

  it("八種版面全部吃同一個台灣時區：UTC 前一天的時間點沒有一支印出 3/1", () => {
    const outs = [
      taipeiStampShort(LATE),
      taipeiDateNumeric(LATE),
      taipeiStampLong(LATE),
      taipeiStampFull(LATE),
      taipeiStampNumeric(LATE),
      taipeiDateMonthDay(LATE),
      taipeiStampMonthDay(LATE),
      taipeiDateLong(LATE),
    ];
    for (const s of outs) {
      assert.ok(!/3\/0?1(?!\d)|3月1日/.test(s), `不該印出 3/1：${s}`);
    }
  });
});

describe("taipeiStartOfMonth", () => {
  it("回台灣時區的本月 1 號 00:00（UTC 前一天 16:00）", () => {
    freezeNow("2026-09-15T03:00:00Z");
    assert.equal(
      taipeiStartOfMonth().toISOString(),
      "2026-08-31T16:00:00.000Z"
    );
  });

  it("台灣已經換月、UTC 還在上個月月底：以台灣為準算新月份", () => {
    // UTC 8/31 20:00 = 台灣 9/1 凌晨 4 點
    freezeNow("2026-08-31T20:00:00Z");
    assert.equal(
      taipeiStartOfMonth().toISOString(),
      "2026-08-31T16:00:00.000Z"
    );
  });

  it("台灣還沒換月、UTC 已經是新月份：仍算上個月", () => {
    // UTC 9/1 00:00 = 台灣 9/1 早上 8 點……是同一天；換個真的跨月的：
    // UTC 8/31 15:00 = 台灣 8/31 晚上 11 點，還在 8 月
    freezeNow("2026-08-31T15:00:00Z");
    assert.equal(
      taipeiStartOfMonth().toISOString(),
      "2026-07-31T16:00:00.000Z"
    );
  });
});

describe("taipeiDaysAgo", () => {
  it("同一個台灣日曆日是 0 天，不管相隔幾小時", () => {
    // 台灣 9/9 早上 10 點
    freezeNow("2026-09-09T02:00:00Z");
    assert.equal(taipeiDaysAgo("2026-09-08T16:30:00Z"), 0); // 台灣 9/9 00:30
    assert.equal(taipeiDaysAgo("2026-09-09T01:59:00Z"), 0);
  });

  it("算的是跨了幾個台灣午夜，不是滿不滿 24 小時：昨晚 8 點、今早 10 點看是 1 天", () => {
    freezeNow("2026-09-09T02:00:00Z"); // 台灣 9/9 10:00
    assert.equal(taipeiDaysAgo("2026-09-08T12:00:00Z"), 1); // 台灣 9/8 20:00，才過 14 小時
  });

  it("UTC 同一天、台灣已跨日的時間點算 1 天（不用 UTC 切）", () => {
    freezeNow("2026-09-08T17:00:00Z"); // 台灣 9/9 01:00
    assert.equal(taipeiDaysAgo("2026-09-08T10:00:00Z"), 1); // 台灣 9/8 18:00
  });

  it("跨月、跨年都照日曆天數算", () => {
    freezeNow("2026-01-02T02:00:00Z"); // 台灣 1/2
    assert.equal(taipeiDaysAgo("2025-12-30T02:00:00Z"), 3);
  });

  it("未來時間回負數（不會被夾成 0）", () => {
    freezeNow("2026-09-09T02:00:00Z");
    assert.equal(taipeiDaysAgo("2026-09-10T02:00:00Z"), -1);
  });
});

describe("taipeiRangeSince", () => {
  // 2026-09-09 是星期三。台灣 9/9 早上 10 點。
  const WED = "2026-09-09T02:00:00Z";

  it("today 回台灣今天 00:00", () => {
    freezeNow(WED);
    assert.equal(
      taipeiRangeSince("today")?.toISOString(),
      "2026-09-08T16:00:00.000Z"
    );
  });

  it("today 在台灣凌晨（UTC 還是前一天）也切在台灣午夜", () => {
    freezeNow("2026-09-08T17:00:00Z"); // 台灣 9/9 01:00
    assert.equal(
      taipeiRangeSince("today")?.toISOString(),
      "2026-09-08T16:00:00.000Z"
    );
  });

  it("week 從星期三回推到本週一 00:00", () => {
    freezeNow(WED);
    assert.equal(
      taipeiRangeSince("week")?.toISOString(),
      "2026-09-06T16:00:00.000Z" // 台灣 9/7（一）00:00
    );
  });

  it("week 在星期一就是今天 00:00", () => {
    freezeNow("2026-09-07T02:00:00Z");
    assert.equal(
      taipeiRangeSince("week")?.toISOString(),
      "2026-09-06T16:00:00.000Z"
    );
  });

  it("week 在星期日算上一週的尾巴，回推 6 天到上週一", () => {
    freezeNow("2026-09-13T02:00:00Z"); // 台灣 9/13（日）
    assert.equal(
      taipeiRangeSince("week")?.toISOString(),
      "2026-09-06T16:00:00.000Z" // 9/7（一）
    );
  });

  it("week 的星期幾以台灣日曆為準：UTC 週日晚上、台灣已是週一", () => {
    freezeNow("2026-09-06T17:00:00Z"); // UTC 週日、台灣 9/7（一）01:00
    assert.equal(
      taipeiRangeSince("week")?.toISOString(),
      "2026-09-06T16:00:00.000Z"
    );
  });

  it("month 跟 taipeiStartOfMonth 同一個切點", () => {
    freezeNow(WED);
    assert.equal(
      taipeiRangeSince("month")?.getTime(),
      taipeiStartOfMonth().getTime()
    );
  });

  it("其他 key（all、空字串、亂打）回 null 表不設下界", () => {
    freezeNow(WED);
    assert.equal(taipeiRangeSince("all"), null);
    assert.equal(taipeiRangeSince(""), null);
    assert.equal(taipeiRangeSince("Today"), null);
  });
});
