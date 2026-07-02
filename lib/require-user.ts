import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 後台每一頁、每個 server action 開頭都是同一件事：
// 建 Supabase client、問「現在是誰登入」、沒登入就送去 /login。
// 這五行以前在十七個檔各抄一份，之後守衛要變（例如登入頁換路徑、加封鎖名單）只改這裡。
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
