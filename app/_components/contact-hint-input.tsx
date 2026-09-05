"use client";

import { useState } from "react";
import { cleanEmail, socialUrl, telDigits } from "@/lib/contact-href";

// 店面設定頁「存了但店面掛不出連結」那幾格共用的輸入框：電話、Email、三個社群連結。
//
// 存檔端只把原文存進 DB / theme，真正決定「店面要不要掛連結」的是公開頁用的那三支清理：
//   - 電話走 telDigits：主號一個數字都沒有（例如「問我」「營業時間再問」）就不掛 tel: 連結
//   - Email 走 cleanEmail：清完不像 email（誤貼電話、亂填字）就不掛 mailto: 連結
//   - 社群走 socialUrl：不是 http(s):// 開頭、也不是漏了 https:// 的真網域就不顯示
// 判不過的情況公開頁一律安靜處理（電話 / Email 只顯示文字不能點、社群整個不顯示），
// 商家存檔成功卻在店面看不到連結，不知道是哪裡填錯。
// 所以這幾格輸入時就用同一支清理先判一次，判不過立刻在框下提示，跟視覺編輯器合作夥伴
// 那格（editor-workspace.tsx）與地圖嵌入那格同一套做法。
//
// 刻意不用 type="url" / type="email"：瀏覽器內建驗證跟這三支清理的標準對不上——
//   - url 驗證會擋掉「instagram.com/foo」這種漏 https:// 但 socialUrl 會補回的好連結
//     （網址列複製常少了開頭的 https://），卻放行「ftp://…」這種 socialUrl 判不過的字串
//   - email 驗證會擋掉全形「ａｂｃ＠ｘ.com」（注音切換誤打）與誤貼的「mailto:abc@x.com」，
//     這兩種 cleanEmail 都清得乾淨、店面能正常掛連結，被瀏覽器擋在存檔前反而讓商家卡住
// 改用 text 搭 inputMode 讓手機一樣跳對應鍵盤（tel 鍵盤 / email 鍵盤 / 網址鍵盤）。
type Kind = "phone" | "email" | "social";

const KIND_CONFIG: Record<
  Kind,
  { inputMode: "tel" | "email" | "url"; ok: (v: string) => boolean; hint: (placeholder: string) => string }
> = {
  phone: {
    inputMode: "tel",
    ok: (v) => telDigits(v) !== "",
    hint: () => "這串裡沒有電話號碼，存檔後店面會照樣顯示這段字，但客人點不了撥號。",
  },
  email: {
    inputMode: "email",
    ok: (v) => cleanEmail(v) !== "",
    hint: (p) => `這串不像 Email，存檔後店面會照樣顯示這段字，但客人點不了寫信。格式像 ${p}。`,
  },
  social: {
    inputMode: "url",
    ok: (v) => socialUrl(v) !== null,
    hint: (p) => `這串存檔後頁尾不會顯示成連結。請貼完整網址，例如 ${p}。`,
  },
};

export function ContactHintInput({
  kind,
  id,
  name,
  defaultValue,
  placeholder,
  maxLength,
  className,
}: {
  kind: Kind;
  id?: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  maxLength: number;
  className: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const cfg = KIND_CONFIG[kind];
  const showHint = value.trim() !== "" && !cfg.ok(value);
  const hintId = `${id ?? name}-hint`;

  return (
    <div className="flex-1 space-y-1.5">
      <input
        id={id}
        name={name}
        type="text"
        inputMode={cfg.inputMode}
        maxLength={maxLength}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-describedby={showHint ? hintId : undefined}
        className={className}
      />
      {showHint && (
        <p
          id={hintId}
          className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
        >
          {cfg.hint(placeholder)}
        </p>
      )}
    </div>
  );
}
