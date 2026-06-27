// 把商家自由打的營業時間文字（如「週一至週五 10:00–18:00」「每日 11:00-19:00」
// 「週三公休，其餘 10:00-18:00」）盡量轉成 schema.org 合法的 OpeningHoursSpecification。
//
// 為什麼要這層轉換：店家在後台是用一個純文字欄位打營業時間，但 schema.org 的
// openingHours / openingHoursSpecification 規格只吃結構化的星期 + 24 小時時間。
// 把中文自由文字直接塞進 openingHours，Google Search Console 會判為無效值、
// 連同整段結構化資料一起忽略甚至報錯。所以這裡做一個保守的解析器：
// **只有能可靠判讀的常見格式才輸出**，判讀不出星期或時間就回 null（寧可不放，
// 也不要放錯誤的營業時間誤導搜尋結果）。頁面上給人看的原始文字不受影響。

export type OpeningHoursSpec = {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string[];
  opens: string;
  closes: string;
};

// schema.org DayOfWeek 列舉值，index 0 = 週一 … 6 = 週日。
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// 中文星期字 → DAY_NAMES 的 index。一=週一 … 六=週六，日／天／七=週日。
const CN_DAY_INDEX: Record<string, number> = {
  一: 0,
  二: 1,
  三: 2,
  四: 3,
  五: 4,
  六: 5,
  日: 6,
  天: 6,
  七: 6,
};

// 把全形數字／冒號、各種破折號統一成 ASCII，方便後面用單一 regex 抓。
function normalize(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .replace(/[–—～〜~至到]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// 把 "9:00" 補成 "09:00"，並驗證是合法的 24 小時時間，不合法回 null。
function pad(hhmm: string): string | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// 找出文字裡所有「HH:MM-HH:MM」時間區間。
function findTimeRanges(text: string): { opens: string; closes: string }[] {
  const ranges: { opens: string; closes: string }[] = [];
  const re = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const opens = pad(m[1]);
    const closes = pad(m[2]);
    if (opens && closes) ranges.push({ opens, closes });
  }
  return ranges;
}

// 判斷文字是否在講「24 小時 / 全天候」營業。商家很常只寫「24小時營業」「全年無休 24小時」
// 「全天候」「24/7」而不打出 HH:MM 區間，findTimeRanges 抓不到時間就整段回 null——明明是
// 可靠的格式卻什麼都不餵給 Google，等於白白少一段正確的營業時間（正是這支想避免的相反面）。
// 所以這裡單獨認 24 小時關鍵字，命中就用 Google 對 24 小時的建議寫法 opens 00:00 / closes 23:59。
// 只認明確字樣（24 後接「小時／時／h／hr」、「二十四小時」、「全天(候)」、「24/7」），不認單獨
// 的「24」，免得把「14:00-24:00」這種寫錯的收班時間（24:00 會被 pad 擋掉）誤判成全天 24 小時。
function is24Hours(text: string): boolean {
  return /24\s*\/\s*7|24\s*(?:小時|時|h|hr)|二十四\s*小時|全天候?/i.test(text);
}

// 收集「週X公休／週X休／週X店休」這種明講休息的星期，後面要從營業日扣掉。
function findClosedDays(text: string): Set<number> {
  const closed = new Set<number>();
  // 星期字後面接公休/店休/休館/休息/休 → 視為該日休息。
  // 一個前綴帶一串星期字（「週六日公休」「週一二三公休」）是台灣最常見的併寫法，
  // 星期字之間還常用頓號／逗號／斜線隔開（「週六、日公休」「週一,三公休」），所以這串
  // 不只抓連續字，分隔符（、，,／/ 與空白）也算同一串、一起往前掃。以前只認單一字，
  // 「週六日公休」會漏掉週六、「週六、日公休」更只扣到逗號後沒前綴的週日（六被當成有
  // 營業），等於餵錯的營業時間給搜尋引擎（正是這支要避免的事）。
  //
  // 還有一種更常見的寫法：每個星期都各帶一個前綴（「週六、週日公休」「週日、週一店休」
  // 「禮拜二、禮拜四公休」）。前綴字（週周星期禮拜）若不算進這串，碰到第二個「週」就斷掉，
  // 只剩「必須緊接公休」這條件，結果只扣到貼著公休的最後一天（「週六、週日公休」只扣週日、
  // 週六被當成有營業）——跟 findOpenDays 用全域重複比對、整串都認得起來的行為對不上。
  // 所以把前綴字也納入這串的字元集合，重複前綴的整串一次擷取；下面 for…of 用 CN_DAY_INDEX
  // 查表，前綴字與分隔符查不到自然略過，所以擴大擷取範圍就夠（公／店／休 不在集合內，整串
  // 仍然停在「公休」前，不會吃進後面其他段落）。
  const re =
    /(?:週|周|星期|禮拜|拜)?([一二三四五六日天七][一二三四五六日天七週周星期禮拜、，,／/\s]*)(?:公休|店休|休館|休息|休)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    for (const ch of m[1]) {
      const idx = CN_DAY_INDEX[ch];
      if (idx !== undefined) closed.add(idx);
    }
  }
  // 「週末／週末／假日／例假日 + 公休/休」也很常見，但上面只認單一星期字，抓不到。
  // 漏掉的話「每日 10:00-18:00，週末公休」會被當成全週營業，反而把錯的營業時間
  // 丟給搜尋引擎（週六日明明休卻標有開）。週末＝週六(5)＋週日(6)，明講休才扣，
  // 中間只允許空白（「週末 10-18 公休」這種前後矛盾的就不視為休、保持保守）。
  const weekendClosed =
    /(?:週末|周末|假日|例假日?|國定假日)\s*(?:公休|店休|休館|休息|休|不營業|不開)/.test(
      text
    );
  if (weekendClosed) {
    closed.add(5);
    closed.add(6);
  }
  return closed;
}

// 從文字判斷「營業日」的基底集合。判不出來回 null（呼叫端就整段不輸出）。
function findOpenDays(text: string, closed: Set<number>): number[] | null {
  const all = [0, 1, 2, 3, 4, 5, 6];
  const minusClosed = (days: number[]) => days.filter((d) => !closed.has(d));

  // 1) 星期區間：週一至週五 / 一-五 / 周二到週六。取頭尾兩個星期字之間（含）。
  const rangeMatch = text.match(
    /(?:週|周|星期|禮拜|拜)?([一二三四五六日天七])\s*-\s*(?:週|周|星期|禮拜|拜)?([一二三四五六日天七])/
  );
  if (rangeMatch) {
    const start = CN_DAY_INDEX[rangeMatch[1]];
    const end = CN_DAY_INDEX[rangeMatch[2]];
    if (start !== undefined && end !== undefined) {
      const days: number[] = [];
      // 允許跨週尾（如週六-週一）：start 走到 6 再從 0 接到 end。
      let i = start;
      for (let n = 0; n < 7; n++) {
        days.push(i);
        if (i === end) break;
        i = (i + 1) % 7;
      }
      return minusClosed(days);
    }
  }

  // 2) 平日 = 週一到週五。
  if (/平日|週間|工作日/.test(text)) return minusClosed([0, 1, 2, 3, 4]);

  // 3) 每日／無休／其餘／其他 = 全週（再扣掉明講的公休日）。
  if (/每日|每天|天天|全年無休|年中無休|無休|不打烊|其餘|其他|以外/.test(text)) {
    return minusClosed(all);
  }

  // 4) 逐一列出的星期（週一、週三、週五），排掉被標成休息的那些。
  // 同 findClosedDays：一個前綴帶一串星期字（「週一二三」「週六日」）很常見，星期字之間
  // 也常用頓號／逗號／斜線隔開（「週一、三、五」「週二,四」），所以這串連同分隔符（、，,／/
  // 與空白）一起抓，而非只抓單一字或連續字——否則「週一、三、五 10:00-18:00」逗號後沒前綴
  // 的三、五會掉、只認到週一。下面 for…of 用 CN_DAY_INDEX 查表，分隔符查不到自然略過。
  const singles = new Set<number>();
  const re = /(?:週|周|星期|禮拜|拜)([一二三四五六日天七][一二三四五六日天七、，,／/\s]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    for (const ch of m[1]) {
      const idx = CN_DAY_INDEX[ch];
      if (idx !== undefined && !closed.has(idx)) singles.add(idx);
    }
  }
  if (singles.size > 0) return [...singles].sort((a, b) => a - b);

  // 5) 判不出星期 → 不輸出。
  return null;
}

export function parseBusinessHoursToSpec(
  raw: string | null | undefined
): OpeningHoursSpec[] | null {
  if (!raw || typeof raw !== "string") return null;
  const text = normalize(raw);

  const ranges = findTimeRanges(text);
  // 沒抓到 HH:MM 區間時，先看是不是 24 小時／全天候店——那種寫法本來就沒有時間區間。
  const open24 = ranges.length === 0 && is24Hours(text);

  // 時間：一般取唯一區間；多段（午休拆段、不同日不同時）難可靠對應到星期，與其猜錯不如不放。
  // 24 小時店合成 00:00–23:59（Google 對 24 小時的建議寫法）。其餘（沒時間、多段）都不放。
  let opens: string;
  let closes: string;
  if (ranges.length === 1) {
    opens = ranges[0].opens;
    closes = ranges[0].closes;
  } else if (open24) {
    opens = "00:00";
    closes = "23:59";
  } else {
    return null;
  }

  const closed = findClosedDays(text);
  // 星期：一般判不出就整段不放。但「24 小時」是「天天開」的強訊號（不是天天開的店會寫成
  // 「週一至週五 24小時」，那種 findOpenDays 仍抓得到星期），所以只有 24 小時又判不出星期時，
  // 保守退而取全週、再扣掉明講的公休日；非 24 小時維持原本判不出就不放。
  const openDays =
    findOpenDays(text, closed) ??
    (open24 ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !closed.has(d)) : null);
  if (!openDays || openDays.length === 0) return null;

  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: openDays.map((d) => DAY_NAMES[d]),
      opens,
      closes,
    },
  ];
}
