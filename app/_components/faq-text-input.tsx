"use client";

import { useState } from "react";
import { countFaqQuestionLines, parseFaqText } from "@/lib/faq-text";

// 店面設定頁的常見問題輸入框。存檔端只存原文，真正決定「關於我們」頁顯示哪幾題的是
// parseFaqText：不是 Q: 開頭的行不算問題、沒接答案或問題空白的整題丟掉，公開頁都安靜處理，
// 商家存檔成功卻發現少了幾題，不知道哪裡打錯。所以輸入時就用同一支解析先跑一次，
// 在框下即時告訴商家會顯示幾題、有幾題會被漏掉，跟 ContactHintInput 同一套做法。
export function FaqTextInput({
  id,
  name,
  defaultValue,
  placeholder,
  maxLength,
  className,
}: {
  id: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  maxLength: number;
  className: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const shown = parseFaqText(value).length;
  const dropped = Math.max(0, countFaqQuestionLines(value) - shown);
  const hasText = value.trim() !== "";
  const warn = hasText && (shown === 0 || dropped > 0);
  const statusId = `${id}-status`;

  let message = "";
  if (hasText && shown === 0) {
    message =
      dropped > 0
        ? "目前一題都不會顯示：每個問題下面都要接一行 A: 開頭的答案。"
        : "目前一題都不會顯示：問題要用 Q: 開頭，答案用 A: 開頭。";
  } else if (hasText) {
    message = `存檔後會顯示 ${shown} 題。`;
    if (dropped > 0) {
      message += `另有 ${dropped} 題缺答案或問題是空的，不會顯示。`;
    }
  }

  return (
    <div className="space-y-1.5">
      <textarea
        id={id}
        name={name}
        rows={10}
        maxLength={maxLength}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-describedby={hasText ? statusId : undefined}
        className={className}
      />
      {hasText && (
        <p
          id={statusId}
          aria-live="polite"
          className={
            warn
              ? "text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
              : "text-xs text-emerald-900/60"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
