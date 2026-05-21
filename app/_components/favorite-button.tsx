"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sproutly_favorites";

function readFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeFavorites(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    // notify other tabs / same-tab listeners
    window.dispatchEvent(new Event("sproutly-favorites-changed"));
  } catch {
    /* ignore */
  }
}

export function FavoriteButton({
  productId,
  className,
  size = "md",
}: {
  productId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    setFavorited(readFavorites().has(productId));
    const onChange = () => setFavorited(readFavorites().has(productId));
    window.addEventListener("sproutly-favorites-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sproutly-favorites-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [productId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const favs = readFavorites();
    if (favs.has(productId)) favs.delete(productId);
    else favs.add(productId);
    writeFavorites(favs);
    setFavorited(favs.has(productId));
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
  className,
  href,
}: {
  className?: string;
  href: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(readFavorites().size);
    const onChange = () => setCount(readFavorites().size);
    window.addEventListener("sproutly-favorites-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sproutly-favorites-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  if (count === 0) return null;

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm transition hover:opacity-70 ${className ?? ""}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      <span>{count}</span>
    </a>
  );
}
