import { createClient } from "@supabase/supabase-js";

// service_role 客戶端：只能在 server side 用
// 用來繞過 RLS 做管理員操作（例如建立 user 並跳過 email 驗證）
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
