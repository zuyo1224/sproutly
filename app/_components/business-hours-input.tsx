"use client";

import { useState } from "react";
import { describeOpeningHoursSpec, parseBusinessHoursToSpec } from "@/lib/business-hours-schema";

// 店面設定頁的營業時間輸入框。頁面上給客人看的是原文，但餵給 Google 的結構化營業時間
// 只有 parseBusinessHoursToSpec 判得出來的才會放，判不出就安靜不放——商家完全不知道
// 搜尋結果少了營業時間。所以輸入時就用同一支解析先跑一次，在框下翻回中文告訴商家
// 「Google 讀到的是這樣」，讀不懂時改黃字提示，跟 FaqTextInput 同一套做法。
export function BusinessHoursInput({
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
  const hasText = value.trim() !== "";
  const specs = hasText ? parseBusinessHoursToSpec(value) : null;
  const statusId = `${id}-status`;

  return (
    <div className="space-y-1.5">
      <textarea
        id={id}
        name={name}
        rows={5}
        maxLength={maxLength}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-describedby={hasText ? statusId : undefined}
        className={className}
      />
      {hasText && (
        <div
          id={statusId}
          aria-live="polite"
          className={
            specs
              ? "text-xs text-emerald-900/60"
              : "text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
          }
        >
          {specs ? (
            <>
              <p>Google 搜尋會讀成：</p>
              {specs.map((s, i) => (
                <p key={i} className="font-mono">
                  {describeOpeningHoursSpec(s)}
                </p>
              ))}
            </>
          ) : (
            <p>
              店面頁照樣顯示這段文字，但 Google 讀不懂，搜尋結果不會帶營業時間。照範例一行寫一段「星期 + 時間」就讀得懂。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
