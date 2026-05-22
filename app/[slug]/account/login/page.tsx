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
    <main className="max-w-md mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="text-center mb-14 sm:mb-16">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Account
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          會員登入
        </h1>
        <div
          className="mt-5 mx-auto h-px w-12"
          style={{
            background: "var(--store-accent, currentColor)",
            opacity: 0.5,
          }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{
            color: theme.textMuted,
            lineHeight: 1.7,
          }}
        >
          輸入 email，我們會寄一封登入連結信給你。
          <br />
          不需要密碼。
        </p>
      </header>

      {sent ? (
        <div
          className="rounded-2xl p-7 sm:p-8 text-center"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            boxShadow: "var(--sproutly-elev-2)",
          }}
        >
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.4em",
            }}
          >
            Sent
          </p>
          <div
            className="mt-4 mx-auto h-px w-10"
            style={{
              background: "var(--store-accent, currentColor)",
              opacity: 0.5,
            }}
          />
          <p
            className="mt-5 text-[0.9375rem]"
            style={{ color: theme.text, lineHeight: 1.7 }}
          >
            登入信已寄到
          </p>
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: theme.text, letterSpacing: "-0.01em" }}
          >
            {email}
          </p>
          <p
            className="mt-6 text-[0.9375rem]"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            點信裡的連結即可登入，連結 1 小時內有效。
            <br />
            找不到信？請看垃圾信件夾。
          </p>
          <Link
            href={`/${slug}/account/login`}
            className="sproutly-link inline-block mt-8 text-[0.6875rem] tracking-[0.3em] uppercase font-medium"
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
              className="mb-6 rounded-2xl p-5"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.accent}`,
                boxShadow: "var(--sproutly-elev-2)",
              }}
            >
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: theme.accent,
                  letterSpacing: "0.4em",
                }}
              >
                Notice
              </p>
              <p
                className="mt-3 text-sm"
                style={{ color: theme.text, lineHeight: 1.7 }}
              >
                {error}
              </p>
            </div>
          )}

          <form action={sendCustomerMagicLink} className="space-y-5">
            <input type="hidden" name="slug" value={slug} />
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label
                className="block text-[0.6875rem] uppercase font-medium mb-3"
                style={{
                  color: theme.textMuted,
                  letterSpacing: "0.4em",
                }}
              >
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="sproutly-input"
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
            className="mt-10 text-center text-[0.8125rem]"
            style={{ color: theme.textMuted, lineHeight: 1.85 }}
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
