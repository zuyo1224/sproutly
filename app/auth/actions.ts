"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) {
    redirect("/signup?error=" + encodeURIComponent("請填寫 email 與密碼"));
  }
  if (password.length < 6) {
    redirect("/signup?error=" + encodeURIComponent("密碼至少 6 個字"));
  }

  // 用 service_role 直接建 user 並標記 email 已驗證（跳過確認信流程）
  // ⚠️ 未來正式上線時應改回正常 signUp flow + 啟用 Confirm email 防止假帳號
  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  // 開發階段 fallback：如果該 email 已存在（之前測試殘留），
  // 自動找出該 user 並更新密碼 + 確認狀態，讓 user 用新輸入的資料登入
  // ⚠️ 正式上線必須移除這段，否則任何人輸入任何 email 都能蓋過該 user 的密碼
  if (createError && /already.*registered|already.*exists/i.test(createError.message)) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      redirect("/signup?error=" + encodeURIComponent(listError.message));
    }
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) {
      const { error: updateError } = await admin.auth.admin.updateUserById(
        existing.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            name: name || existing.user_metadata?.name || null,
          },
        }
      );
      if (updateError) {
        redirect("/signup?error=" + encodeURIComponent(updateError.message));
      }
    } else {
      redirect(
        "/signup?error=" +
          encodeURIComponent("帳號狀態異常，請換 email 或聯絡管理員")
      );
    }
  } else if (createError) {
    redirect("/signup?error=" + encodeURIComponent(createError.message));
  }

  // 建好之後自動登入
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    redirect("/login?error=" + encodeURIComponent(signInError.message));
  }

  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=" + encodeURIComponent("請填寫 email 與密碼"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
