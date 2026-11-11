"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUpRight,
  Copy,
  Trash2,
  LogOut,
  Film,
  Mail,
  Orbit,
  Gift as GiftIcon,
} from "lucide-react";
import { Header, Footer, LocalNotice, Notice, Loading } from "./ui";
import { api } from "@/lib/client";
import type { Project } from "@/lib/service";
import type { GiftSection } from "@/lib/schema";
import { price, type Catalog } from "@/lib/config";
interface Order {
  id: string;
  project_id: string;
  amount: number;
  status: string;
  created_at: string;
  plan: string;
}
export default function Dashboard() {
  const router = useRouter(),
    [projects, setProjects] = useState<Project[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState(false),
    [view, setView] = useState<"gifts" | "orders" | "account">("gifts");
  async function load() {
    const [p, o, c] = await Promise.all([
      api<{ projects: Project[] }>("projects"),
      api<{ orders: Order[] }>("orders"),
      api<{ catalog: Catalog }>("catalog"),
    ]);
    setProjects(p.projects);
    setOrders(o.orders);
    setCatalog(c.catalog);
    setLoading(false);
  }
  useEffect(() => {
    load().catch((e) => {
      setError(e.message);
      setLoading(false);
      if (e.message.includes("Sign in")) router.replace("/auth");
    });
  }, [router]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create(type: GiftSection["type"]) {
    await action(async () => {
      const p = await api<{ id: string }>("projects", "POST", { type });
      router.push(`/editor/${p.id}`);
    });
  }
  return (
    <>
      <LocalNotice />
      <Header />
      <main className="dashboard page-container">
        <div className="page-heading">
          <div>
            <p className="step-label">MADE BY YOU. MEANT FOR THEM.</p>
            <h1>
              Your gifts<span className="accent">.</span>
            </h1>
            <p className="muted">
              Small beginnings. Something they’ll remember.
            </p>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() => setPicker(!picker)}
          >
            <Plus size={18} />
            Create a gift
          </button>
        </div>
        <nav className="dashboard-tabs">
          <button
            className={view === "gifts" ? "active" : ""}
            onClick={() => setView("gifts")}
          >
            My gifts <span>{projects.length}</span>
          </button>
          <button
            className={view === "orders" ? "active" : ""}
            onClick={() => setView("orders")}
          >
            Orders
          </button>
          <button
            className={view === "account" ? "active" : ""}
            onClick={() => setView("account")}
          >
            Account
          </button>
        </nav>
        {error ? <Notice error>{error}</Notice> : null}
        {picker || (!loading && !projects.length && view === "gifts") ? (
          <section className="template-picker">
            <h2>What would you like to give?</h2>
            <p className="muted">
              Choose a starting point. You can add other experiences in the
              editor.
            </p>
            <div className="template-options">
              {catalog?.templates
                .filter((t) => t.enabled)
                .map((t, i) => {
                  const Icon = [Film, Mail, Orbit, GiftIcon][i] || Film;
                  return (
                    <button
                      key={t.id}
                      disabled={busy}
                      onClick={() => create(t.id as GiftSection["type"])}
                    >
                      <Icon size={26} />
                      <strong>{t.name}</strong>
                      <span>{t.description}</span>
                      <ArrowUpRight size={18} />
                    </button>
                  );
                })}
            </div>
          </section>
        ) : null}
        {loading ? (
          <Loading />
        ) : view === "gifts" ? (
          <div className="project-grid">
            {projects.map((p) => {
              const paid = orders.some(
                (o) => o.project_id === p.id && o.status === "paid",
              );
              return (
                <article className="project-card" key={p.id}>
                  <Link
                    href={`/editor/${p.id}`}
                    className={`project-art art-${p.draft.sections[0]?.type}`}
                  >
                    <span className="project-art-star">✦</span>
                    <p>
                      {p.draft.from} <i>for</i> {p.draft.to}
                    </p>
                    <h3>{p.draft.title}</h3>
                    <span className="project-open">
                      <ArrowUpRight size={20} />
                    </span>
                  </Link>
                  <div className="project-details">
                    <div>
                      <span
                        className={`project-status ${p.published ? "published" : ""}`}
                      >
                        {p.deleting
                          ? "Deletion pending"
                          : p.blocked
                            ? "Blocked"
                            : p.published
                              ? "Published"
                              : paid
                                ? "Ready to publish"
                                : "Draft"}
                      </span>
                      <small>
                        Edited{" "}
                        {new Date(p.updated_at).toLocaleDateString("en-GB")}
                      </small>
                    </div>
                    <div className="project-card-actions">
                      <Link href={`/editor/${p.id}`} className="text-link">
                        Continue editing
                        <ArrowUpRight size={15} />
                      </Link>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`Duplicate ${p.draft.title}`}
                        title="Duplicate text and settings; upload media again"
                        onClick={() =>
                          action(async () => {
                            const result = await api<{ id: string }>(
                              `projects/${p.id}/duplicate`,
                              "POST",
                              {},
                            );
                            router.push(`/editor/${result.id}`);
                          })
                        }
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        disabled={busy}
                        aria-label={`Delete ${p.draft.title}`}
                        onClick={() => {
                          if (
                            confirm(
                              "Delete this gift and its files? This cannot be undone.",
                            )
                          )
                            void action(async () => {
                              await api(`projects/${p.id}`, "DELETE");
                              await load();
                            });
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {projects.length ? (
              <button
                className="new-project-card"
                onClick={() => setPicker(true)}
              >
                <Plus size={30} />
                <span>Another story to tell?</span>
                <strong>Create a new gift</strong>
              </button>
            ) : null}
          </div>
        ) : view === "orders" ? (
          <section className="orders-view">
            <h2>Your orders</h2>
            {orders.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Package</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id.slice(0, 8)}</td>
                        <td>
                          {new Date(o.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td>{JSON.parse(o.plan).name}</td>
                        <td>{price(o.amount)}</td>
                        <td>{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Notice>
                No orders yet. Preview your gift before purchasing.
              </Notice>
            )}
            <p className="small muted">
              Returning from checkout does not confirm payment. Your order
              updates only after a verified Stripe webhook. Refresh to check its
              status.
            </p>
            <button
              className="button secondary small"
              onClick={() => action(load)}
            >
              Refresh orders
            </button>
          </section>
        ) : (
          <section className="account-view">
            <h2>Your account</h2>
            <p>
              Sign out on shared devices. Private project files are stored
              separately from the public website.
            </p>
            <button
              className="button secondary"
              onClick={() =>
                action(async () => {
                  await api("auth/logout", "POST", {});
                  router.push("/");
                })
              }
            >
              <LogOut size={16} />
              Sign out
            </button>
            <hr />
            <h3>Delete your account</h3>
            <p className="muted">
              This permanently removes your projects, publications and media.
              Minimal order records remain for accounting obligations; seller
              retention periods must be finalised before launch.
            </p>
            <button
              className="text-link danger"
              onClick={() => {
                if (
                  confirm(
                    "Permanently delete your account, all gifts and files?",
                  )
                )
                  void action(async () => {
                    await api("account", "DELETE");
                    router.push("/");
                  });
              }}
            >
              <Trash2 size={16} />
              Permanently delete account
            </button>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
