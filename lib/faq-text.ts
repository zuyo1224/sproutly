// 商家在設定頁用純文字打常見問題：問題用「Q:」開頭、答案用「A:」開頭。
// 以前只認半形大寫 Q / A，但中文輸入法開著全形時打出來是「Ｑ：」，手機鍵盤也常自動
// 變小寫「q:」，這些行全部不被當成問題，整段常見問題在「關於我們」頁直接消失、
// 商家也看不出哪裡打錯。現在半形／全形、大小寫都認，冒號前多一個空白也算。
const Q_PREFIX = /^[QqＱｑ]\s*[:：]\s*/;
const A_PREFIX = /^[AaＡａ]\s*[:：]\s*/;

export type FaqItem = { question: string; answer: string };

export function parseFaqText(text: string): FaqItem[] {
  const items: FaqItem[] = [];
  let currentQ: string | null = null;
  let currentA: string[] = [];
  const flush = () => {
    if (currentQ !== null) {
      items.push({ question: currentQ, answer: currentA.join("\n").trim() });
    }
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (Q_PREFIX.test(line)) {
      flush();
      currentQ = line.replace(Q_PREFIX, "");
      currentA = [];
    } else if (A_PREFIX.test(line)) {
      currentA.push(line.replace(A_PREFIX, ""));
    } else if (currentQ !== null) {
      currentA.push(line);
    }
  }
  flush();
  // 只留問題與答案都真的有字的項目 —— 商家可能只打了問題沒接答案（最後一條 Q 後面沒 A），
  // 或誤留一行空白的「Q:」。空問 / 空答畫面上是空殼，餵給 FAQPage 更會讓整段常見問題 rich
  // result 失效（Google 要求每題都要有答案文字）。
  return items.filter((item) => item.question.trim() && item.answer.trim());
}

// 數「看起來想當問題」的行（Q: 開頭，含全形小寫）。設定頁拿來跟 parseFaqText 的結果比：
// 行數比解析出來的題數多，代表有題目沒接答案或問題是空的，存檔後那幾題不會出現。
export function countFaqQuestionLines(text: string): number {
  return text.split(/\r?\n/).filter((raw) => Q_PREFIX.test(raw.trim())).length;
}
