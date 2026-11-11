"use client";
import Link from "next/link";
import {
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { api } from "@/lib/client";
import { brand } from "@/lib/config";
import { messages } from "@/lib/i18n";
import { ArrowUpRight, Menu, X } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label={`${brand.displayName} — home`}>
      {brand.name}
      <span>.</span>
    </Link>
  );
}
export function Header() {
  const t = messages();
  const [user, setUser] = useState<{ email: string; role: string } | null>(
      null,
    ),
    [open, setOpen] = useState(false);
  useEffect(() => {
    api<{ user: typeof user }>("auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, []);
  return (
    <header className="site-header">
      <Brand />
      <button
        className="icon-button menu-toggle"
        aria-label="Menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav className={open ? "open" : ""}>
        <Link href="/#doswiadczenia" onClick={() => setOpen(false)}>
          {t.experiences}
        </Link>
        <Link href="/#jak-to-dziala" onClick={() => setOpen(false)}>
          {t.how}
        </Link>
        <Link href="/#pakiety" onClick={() => setOpen(false)}>
          {t.packages}
        </Link>
        <Link href="/demo">{t.demo}</Link>
        {user?.role === "admin" ? <Link href="/admin">{t.admin}</Link> : null}
        <Link className="button small" href={user ? "/dashboard" : "/auth"}>
          {user ? t.gifts : t.create}
          <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Brand />
        <p>Memories worth coming back to.</p>
      </div>
      <div>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/contact">Contact & complaints</Link>
        <span>© {new Date().getFullYear()} WebsiteGift</span>
      </div>
    </footer>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ id?: string; "aria-describedby"?: string }>,
        { id, "aria-describedby": hint ? `${id}-hint` : undefined },
      )
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <span className="spinner" />
      One moment…
    </div>
  );
}
export function LocalNotice() {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    api<{ local: boolean }>("auth/me")
      .then((r) => setLocal(r.local))
      .catch(() => {});
  }, []);
  return local ? (
    <div className="local-banner">
      Local demo · accounts and files stay on this computer · test payments only
    </div>
  ) : null;
}
