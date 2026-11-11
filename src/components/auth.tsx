"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Brand, Field, Notice, LocalNotice } from "./ui";
import { api } from "@/lib/client";
export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("register"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    router = useRouter();
  return (
    <>
      <LocalNotice />
      <div className="auth-page">
        <aside className="auth-story">
          <Brand />
          <div>
            <span className="large-star">✳</span>
            <h1>
              A little more
              <br />
              than a gift.
            </h1>
            <p>
              A place for everything
              <br />
              that brings you closer.
            </p>
          </div>
          <Link href="/">
            <ArrowLeft size={16} /> Back to WebsiteGift
          </Link>
        </aside>
        <main className="auth-form">
          <div>
            <p className="step-label">YOUR STORY STARTS HERE</p>
            <h1>
              {mode === "register"
                ? "Make something personal."
                : "Welcome back."}
            </h1>
            <p className="muted">
              {mode === "register"
                ? "Create your account. Take your time. Preview before you buy."
                : "Your memories are right where you left them."}
            </p>
            <div className="auth-tabs">
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create an account
              </button>
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
            </div>
            {error ? <Notice error>{error}</Notice> : null}
            {message ? <Notice>{message}</Notice> : null}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const result = await api<{ confirmation?: boolean }>(
                    `auth/${mode}`,
                    "POST",
                    { email, password },
                  );
                  if (result.confirmation)
                    setMessage(
                      "Check your email to confirm your account, then sign in.",
                    );
                  else router.push("/dashboard");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Email address">
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  maxLength={254}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" hint="At least 10 characters.">
                <input
                  type="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  minLength={10}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <button className="button full" disabled={busy}>
                {busy
                  ? "One moment…"
                  : mode === "register"
                    ? "Create my account"
                    : "Sign in"}
                <ArrowRight size={18} />
              </button>
            </form>
            <p className="small muted">
              By creating an account, you agree to the{" "}
              <Link href="/legal/terms">terms</Link>. Read how we protect your
              data in our <Link href="/legal/privacy">privacy notice</Link>.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
