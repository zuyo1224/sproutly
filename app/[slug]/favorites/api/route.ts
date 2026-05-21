import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

export async function GET(
  request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) return NextResponse.json([]);

  const { data } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, image_urls")
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .in("id", ids);

  return NextResponse.json(data ?? []);
}
