"use client";

import { useEffect, useState } from "react";
import {
  FAVORITES_CHANGED_EVENT,
  getFavoriteIds,
  setFavoriteIds,
} from "@/lib/favorites";

export function FavoriteButton({
  slug,
  productId,
  className,
  size = "md",
}: {
  slug: string;
  productId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setFavorited(getFavoriteIds(slug).includes(productId));
    onChange();
    window.addEventListener(FAVORITES_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [slug, productId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ids = getFavoriteIds(slug);
    const next = ids.includes(productId)
      ? ids.filter((id) => id !== productId)
      : [...ids, productId];
    setFavoriteIds(slug, next);
    setFavorited(next.includes(productId));
  }

  const dim = size === "sm" ? 16 : size === "lg" ? 26 : 20;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={favorited ? "從收藏移除" : "加入收藏"}
      aria-pressed={favorited}
      className={`inline-flex items-center justify-center rounded-full transition active:scale-90 ${className ?? ""}`}
      style={{
        color: favorited ? "#D45A5A" : "currentColor",
        transitionDuration: "0.35s",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        />
      </svg>
    </button>
  );
}

export function FavoritesCounter({
  slug,
  className,
  href,
}: {
  slug: string;
  className?: string;
  href: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const onChange = () => setCount(getFavoriteIds(slug).length);
    onChange();
    window.addEventListener(FAVORITES_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [slug]);

  if (count === 0) return null;

  return (
    // 導覽列只有一顆愛心配數字，報讀器念到這個連結時只會聽到「14」不知道是什麼——
    // 補 aria-label 把「收藏 N 件」說清楚，裝飾性的愛心 svg 標 aria-hidden 不重複念。
    <a
      href={href}
      aria-label={`查看收藏，目前 ${count} 件`}
      className={`inline-flex items-center gap-1.5 text-sm transition hover:opacity-70 ${className ?? ""}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      <span>{count}</span>
    </a>
  );
}
