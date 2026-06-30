"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addToCart, getCart, getCartCount } from "@/lib/cart";

type Props = {
  slug: string;
  productId: string;
  qty?: number;
  /**
   * 若帶入頁面上數量選單（<select> / <input>）的 id，點擊時改讀它的當前值，
   * 而非寫死的 qty。商品頁的數量下拉跟「加入購物車」原本沒接上，
   * 客人選 5 件按加入只會進 1 件，靠這個把選的數量帶進購物車。
   */
  qtyInputId?: string;
  /**
   * 商品庫存（null 視為不限）。詳情頁的數量下拉只 cap 在庫存，
   * 但「加入購物車」是累加：車裡已有 2 件、又選 3 件加進來會變 5 件，
   * 超過只剩 3 件的庫存。客人當下不會發現，要等排到購物車才看到紅字。
   * 帶進來後就能在加入當下把「已在車裡 + 想加」一起 cap 住、並說明原因。
   */
  stock?: number | null;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function AddToCartButton({
  slug,
  productId,
  qty = 1,
  qtyInputId,
  stock = null,
  className,
  style,
  children,
}: Props) {
  const [added, setAdded] = useState(false);
  // 加入時若因庫存被攔（只加到上限、或車裡已有全部庫存）給客人一句說明。
  const [notice, setNotice] = useState<string | null>(null);
  // 購物車裡目前共幾件。原本按下「加入」只閃 1.5 秒「✓ 已加入」就消失，
  // 客人加完不知道車在哪、也沒去向（nav 徽章在頁頂很小，視線正盯著底部按鈕），
  // 等於加了卻不知下一步。車裡只要有東西就在按鈕下持續給一條「去購物車」連結。
  const [count, setCount] = useState(0);

  // 「✓ 已加入」閃 1.5 秒、notice 顯示 4 秒，各自一條計時器。比照 CopyButton
  // 的 timerRef 做法：設新的前先清舊的，連點兩次「加入」第一次的計時器才不會
  // 把第二次該續顯的回饋提早關掉；卸載時一併清掉，免得對已卸載的元件 setState。
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashAdded() {
    setAdded(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setAdded(false), 1500);
  }

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }

  function clearNotice() {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setNotice(null);
  }

  // 掛載先讀一次（可能先前頁面已加過），並跟著購物車變動同步——
  // addToCart / updateQty / remove 都會 dispatch 這個事件，數字才不會過時。
  useEffect(() => {
    const sync = () => setCount(getCartCount(slug));
    sync();
    window.addEventListener("sproutly-cart-changed", sync);
    return () =>
      window.removeEventListener("sproutly-cart-changed", sync);
  }, [slug]);

  // 卸載時清掉還沒觸發的回饋計時器（離開商品頁、popover 關閉等）。
  useEffect(
    () => () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    []
  );

  function resolveQty() {
    if (!qtyInputId) return qty;
    const el = document.getElementById(qtyInputId) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    const parsed = el ? parseInt(el.value, 10) : NaN;
    // 選單的 option 本來就被 maxQty（庫存上限）約束，這裡只做基本防呆。
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : qty;
  }

  function handleClick() {
    const wanted = resolveQty();
    // 庫存不限就照常加。有上限時看車裡已有多少，只補到上限為止。
    if (stock != null) {
      const already =
        getCart(slug).find((i) => i.productId === productId)?.qty ?? 0;
      const canAdd = Math.max(0, stock - already);
      if (canAdd <= 0) {
        showNotice(`購物車已有全部 ${stock} 件庫存`);
        return;
      }
      const toAdd = Math.min(wanted, canAdd);
      addToCart(slug, productId, toAdd);
      flashAdded();
      if (toAdd < wanted) {
        showNotice(`庫存只剩 ${stock} 件，已幫你加到上限`);
      } else {
        clearNotice();
      }
      return;
    }
    addToCart(slug, productId, wanted);
    flashAdded();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={className}
        style={style}
      >
        {added ? "✓ 已加入" : children ?? "加入購物車"}
      </button>
      {/* 按鈕文字閃「✓ 已加入」只給看得到畫面的人。庫存被夾的情形下面
          notice（role=status）會念，但一般成功（庫存不限）這條沒人念。
          補一條 sr-only 即時區，只在成功且沒有 notice 時念，免得跟 notice
          兩邊重複播。 */}
      <span className="sr-only" role="status" aria-live="polite">
        {added && !notice ? "已加入購物車" : ""}
      </span>
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="text-center text-[0.75rem]"
          style={{
            color: "var(--store-text-muted, rgba(0,0,0,0.6))",
            letterSpacing: "0.04em",
            lineHeight: 1.5,
          }}
        >
          {notice}
        </p>
      )}
      {count > 0 && (
        <Link
          href={`/${slug}/cart`}
          className="block text-center text-[0.8125rem] transition hover:opacity-70"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.04em",
          }}
        >
          去購物車（{count} 件）→
        </Link>
      )}
    </>
  );
}
