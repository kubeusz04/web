"use client";
import { useEffect, useState } from "react";
import { Lock, ArrowRight } from "lucide-react";
import Experience from "./experience";
import { Brand, Field, Loading, Notice } from "./ui";
import { api } from "@/lib/client";
import type { Gift } from "@/lib/schema";
export default function Recipient({ token }: { token: string }) {
  const [gift, setGift] = useState<Gift | null>(null),
    [error, setError] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(true);
  async function open(value?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ gift: Gift }>(
        `gift/${token}`,
        value ? "POST" : "GET",
        value ? { password: value } : undefined,
      );
      setGift(result.gift);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void open();
  }, [token]);
  if (gift)
    return (
      <main className="recipient-page">
        <h1 className="sr-only">{gift.title}</h1>
        <Experience gift={gift} />
      </main>
    );
  return (
    <main className="gift-lock">
      <Brand />
      {busy ? (
        <Loading />
      ) : (
        <>
          <Lock size={30} />
          <h1>Something just for you.</h1>
          <Notice error>{error}</Notice>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void open(password);
            }}
          >
            <Field label="Gift password">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
              />
            </Field>
            <button className="button full">
              Open your gift
              <ArrowRight size={17} />
            </button>
          </form>
        </>
      )}
    </main>
  );
}
