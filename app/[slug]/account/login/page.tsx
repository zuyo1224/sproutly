import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../../_theme";
import { sendCustomerMagicLink } from "../actions";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{
  error?: string;
  sent?: string;
  email?: string;
  next?: string;
}>;

export default async function CustomerLoginPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { error, sent, email, next } = await searchParams;

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  return (
    <main className="max-w-md mx-auto px-6 py-24 sm:py-32">
      <div className="text-center mb-12">
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-5"
          style={{ color: theme.accent }}
        >
          Account
        </p>
        <h1
          className="text-3xl sm:text-4xl"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          會員登入
        </h1>
        <p
          className="mt-5 text-sm leading-[1.85]"
          style={{ color: theme.textMuted }}
        >
          輸入 email，我們會寄一封登入連結信給你。
          <br />
          不需要密碼。
        </p>
      </div>

      {sent ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
          }}
        >
          <p
            className="text-[10px] tracking-[0.4em] uppercase mb-4"
            style={{ color: theme.accent }}
          >
            Sent
          </p>
          <p
            className="text-base leading-[1.9]"
            style={{ color: theme.text }}
          >
            登入信已寄到
          </p>
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: theme.text }}
          >
            {email}
          </p>
          <p
            className="mt-6 text-sm leading-[1.85]"
            style={{ color: theme.textMuted }}
          >
            點信裡的連結即可登入，連結 1 小時內有效。
            <br />
            找不到信？請看垃圾信件夾。
          </p>
          <Link
            href={`/${slug}/account/login`}
            className="sproutly-link inline-block mt-8 text-xs tracking-[0.3em] uppercase"
            style={{ color: theme.text }}
            data-default-line="true"
          >
            重新寄送
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div
              className="mb-6 rounded-xl px-4 py-3 text-sm"
              style={{
                background: theme.surface,
                color: theme.text,
                border: `1px solid ${theme.accent}`,
              }}
            >
              {error}
            </div>
          )}

          <form action={sendCustomerMagicLink} className="space-y-5">
            <input type="hidden" name="slug" value={slug} />
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label
                className="block text-[10px] tracking-[0.4em] uppercase mb-3"
                style={{ color: theme.textMuted }}
              >
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-full px-5 py-3.5 outline-none transition text-sm"
                style={{
                  background: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                }}
              />
            </div>
            <button
              type="submit"
              className="sproutly-btn sproutly-btn-primary sproutly-btn-lg w-full"
            >
              寄登入連結
            </button>
          </form>

          <p
            className="mt-10 text-center text-xs leading-[1.85]"
            style={{ color: theme.textMuted }}
          >
            這是這家店的客人會員，
            <br />
            和 {store.name} 的商家後台是分開的帳號。
          </p>
        </>
      )}
    </main>
  );
}
