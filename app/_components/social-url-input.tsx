"use client";

import { useState } from "react";
import { socialUrl } from "@/lib/contact-href";

// 店面設定頁三個社群連結（Instagram / Facebook / LINE）共用的輸入框。
//
// 存檔端只把原文存進 theme，真正決定「頁尾要不要掛連結」的是公開頁 layout 用的
// socialUrl：只收 http(s):// 開頭、或漏了 https:// 但形狀是真網域的字串，其餘回 null、
// 那個社群連結就安靜不顯示。商家存檔成功卻在店面看不到連結，不知道是哪裡填錯。
// 所以這格輸入時就用同一支 socialUrl 先判一次，判不過立刻在框下提示，跟視覺編輯器
// 合作夥伴那格（editor-workspace.tsx）同一套做法。
//
// 刻意不用 type="url"：瀏覽器的 url 驗證會擋掉「instagram.com/foo」這種漏 https://
// 但 socialUrl 會補回的好連結（網址列複製常少了開頭的 https://），卻放行「ftp://…」這種
// socialUrl 判不過的字串，兩邊標準對不上。改用 text + inputMode="url" 讓手機一樣跳網址鍵盤。
export function SocialUrlInput({
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
  const showHint = value.trim() !== "" && !socialUrl(value);

  return (
    <div className="flex-1 space-y-1.5">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="url"
        maxLength={maxLength}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-describedby={showHint ? `${id}-hint` : undefined}
        className={className}
      />
      {showHint && (
        <p
          id={`${id}-hint`}
          className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
        >
          這串存檔後頁尾不會顯示成連結。請貼完整網址，例如 {placeholder}。
        </p>
      )}
    </div>
  );
}
