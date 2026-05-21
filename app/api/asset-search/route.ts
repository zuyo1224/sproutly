// Asset 庫 API proxy（對標 Wix Asset Library）
// GET /api/asset-search?q=plant&page=1 → 從 Pexels free API 拉圖
// 需 PEXELS_API_KEY env var（free tier 200 req/hr，去 https://pexels.com/api/ 拿）

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_QUERIES = ["plant", "interior", "minimal", "nature", "shop"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(
    1,
    Math.min(20, parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
  );
  const perPage = 18;

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "PEXELS_API_KEY 沒設。去 https://pexels.com/api/ 申請 free key，加進 Vercel env vars",
        photos: [],
        next: false,
      },
      { status: 500 }
    );
  }

  // 驗證商家
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "需登入", photos: [] }, { status: 401 });
  }
  const { count: storeCount } = await supabase
    .from("sproutly_merchants")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userData.user.id);
  if (!storeCount || storeCount === 0) {
    return NextResponse.json({ error: "你不是商家", photos: [] }, { status: 403 });
  }

  const endpoint = q
    ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}&orientation=landscape`
    : `https://api.pexels.com/v1/curated?page=${page}&per_page=${perPage}`;

  try {
    const r = await fetch(endpoint, {
      headers: { Authorization: apiKey },
      next: { revalidate: 60 * 60 }, // cache 1 hour
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `Pexels API ${r.status}`, photos: [] },
        { status: 502 }
      );
    }
    const data = await r.json();
    type PexelsPhoto = {
      id: number;
      src: { medium: string; large: string; original: string };
      alt: string | null;
      photographer: string;
      photographer_url: string;
      width: number;
      height: number;
    };
    const photos = ((data.photos ?? []) as PexelsPhoto[]).map((p) => ({
      id: p.id,
      thumb: p.src.medium,
      large: p.src.large,
      original: p.src.original,
      alt: p.alt ?? "",
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      width: p.width,
      height: p.height,
    }));
    return NextResponse.json({
      photos,
      next: photos.length === perPage,
      page,
      suggestions: q ? null : FALLBACK_QUERIES,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: `fetch error: ${msg}`, photos: [] },
      { status: 500 }
    );
  }
}
