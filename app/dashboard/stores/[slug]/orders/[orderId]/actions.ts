"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ALLOWED_STATUS = new Set([
  "pending",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
]);
const ALLOWED_PAYMENT = new Set(["unpaid", "paid", "refunded"]);

export async function updateOrderStatus(
  slug: string,
  orderId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) redirect("/dashboard");

  const status = String(formData.get("status") ?? "");
  const paymentStatus = String(formData.get("payment_status") ?? "");

  const updates: Record<string, unknown> = {};
  if (ALLOWED_STATUS.has(status)) {
    updates.status = status;
    if (status === "shipped") updates.shipped_at = new Date().toISOString();
  }
  if (ALLOWED_PAYMENT.has(paymentStatus)) {
    updates.payment_status = paymentStatus;
    if (paymentStatus === "paid" && !updates.paid_at)
      updates.paid_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    redirect(`/dashboard/stores/${slug}/orders/${orderId}`);
  }

  const { error } = await supabase
    .from("sproutly_orders")
    .update(updates)
    .eq("id", orderId)
    .eq("merchant_id", store.id);

  if (error) {
    redirect(
      `/dashboard/stores/${slug}/orders/${orderId}?error=` +
        encodeURIComponent(error.message)
    );
  }

  redirect(`/dashboard/stores/${slug}/orders/${orderId}?saved=1`);
}
