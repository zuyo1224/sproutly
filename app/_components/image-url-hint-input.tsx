"use client";

import { useState } from "react";
import { isPastedRemoteImageUrl } from "@/lib/image-url";

// 商品新增頁「貼網路圖片 URL」那格用的輸入框：輸入時就用寫入端同一支
// isPastedRemoteImageUrl 判一次（只認 https:// 開頭的完整網址），判不過立刻在框下提示。
//
// 為什麼要這層：這格原本是 type="url"，瀏覽器內建驗證只擋「不是網址」，不擋 http://。
// 店面本身是 https，http:// 的圖會被瀏覽器當混合內容擋掉，那張一定開天窗；漏了 https://
// 的字串（「imgur.com/abc.jpg」）與根本不是網址的字（「照片1」）更是連抓都不會去抓。
// 以前這些字串一存進 DB 還會讓整個店面首頁打不開（見 lib/image-url.ts 的說明），現在
// 首頁不會炸了，但那張圖一樣看不到，而且錯在店面、商家回後台看不出哪裡壞。
// 所以比照視覺編輯器相簿那格（editor-workspace.tsx）與電話／Email 那支 ContactHintInput
// 的做法：改 type="text" 搭 inputMode="url" 讓手機一樣跳網址鍵盤，輸入時就講清楚。
// 寫入端 products/actions.ts 用同一支判斷擋，這裡只是讓商家不用送出才知道。
// 不用渲染端那支 isOptimizableImageSrc：它連「/photo.jpg」站內路徑都放行，但商家手貼的
// 站內路徑多半是漏了網域的半截網址，店面抓不到，提示文案講「要 https://」也對不上。
export function ImageUrlHintInput({
  id,
  name,
  placeholder,
  maxLength,
  className,
}: {
  id?: string;
  name: string;
  placeholder: string;
  maxLength: number;
  className: string;
}) {
  const [value, setValue] = useState("");
  const showHint = value.trim() !== "" && !isPastedRemoteImageUrl(value);
  const hintId = `${id ?? name}-hint`;

  return (
    <div className="space-y-1.5">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="url"
        aria-label="商品圖片網址"
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
          這格要貼 https:// 開頭的完整圖片網址（例如 {placeholder}），現在這串店面會顯示不出這張圖，送出時也會被擋下。
        </p>
      )}
    </div>
  );
}
