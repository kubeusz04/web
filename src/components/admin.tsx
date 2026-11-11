"use client";
import { useEffect, useState } from "react";
import { Header, Footer, Notice, Loading } from "./ui";
import { api } from "@/lib/client";
import type { Catalog } from "@/lib/config";
import { price } from "@/lib/config";
import CatalogForm from "./catalog-form";
type AdminData = {
  catalog: Catalog;
  orders: {
    id: string;
    project_id: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
  jobs: {
    id: string;
    order_id: string;
    status: string;
    attempts: number;
    last_error: string | null;
  }[];
  projects: {
    id: string;
    owner_id: string;
    blocked: number;
    published_revision: number | null;
    updated_at: string;
  }[];
  audit: {
    id: string;
    actor_id: string;
    action: string;
    target_id: string;
    created_at: string;
  }[];
};
export default function Admin() {
  const [data, setData] = useState<AdminData | null>(null),
    [editor, setEditor] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("overview"),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await api<AdminData>("admin");
    setData(d);
    setEditor(JSON.stringify(d.catalog, null, 2));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main className="page-container admin-page">
        <div className="page-heading">
          <div>
            <p className="step-label">OPERATIONS</p>
            <h1>Behind the moments.</h1>
            <p className="muted">
              Server-enforced administrator access. Customer content stays
              private by default.
            </p>
          </div>
        </div>
        {error ? <Notice error>{error}</Notice> : null}
        {message ? <Notice>{message}</Notice> : null}
        {!data ? (
          !error ? (
            <Loading />
          ) : null
        ) : (
          <>
            <nav className="dashboard-tabs">
              {[
                "overview",
                "catalog",
                "orders",
                "delivery",
                "projects",
                "audit",
              ].map((t) => (
                <button
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </nav>
            {tab === "overview" ? (
              <section className="admin-metrics">
                <div>
                  <span>Confirmed revenue · displayed orders</span>
                  <strong>
                    {price(
                      data.orders
                        .filter((o) => o.status === "paid")
                        .reduce((a, o) => a + o.amount, 0),
                    )}
                  </strong>
                </div>
                <div>
                  <span>Orders · latest 100</span>
                  <strong>{data.orders.length}</strong>
                </div>
                <div>
                  <span>Unsent confirmations · latest 100</span>
                  <strong>
                    {data.jobs.filter((j) => j.status !== "sent").length}
                  </strong>
                </div>
              </section>
            ) : null}
            {tab === "catalog" ? (
              <section>
                <h2>Storefront, templates and packages</h2>
                <p className="muted">
                  Edit your storefront using the fields below. Changes apply to
                  new orders; existing orders retain their price and limits.
                </p>
                <CatalogForm value={editor} onChange={setEditor} />
                <details className="advanced-config">
                  <summary>Advanced configuration</summary>
                  <p className="small muted">
                    Raw configuration uses grosze for prices and bytes for
                    storage.
                  </p>
                  <textarea
                    className="code-editor"
                    aria-label="Storefront configuration JSON"
                    value={editor}
                    onChange={(e) => setEditor(e.target.value)}
                    spellCheck={false}
                  />
                </details>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api("admin/catalog", "PUT", JSON.parse(editor));
                      setMessage("Configuration saved.");
                    })
                  }
                >
                  Save configuration
                </button>
              </section>
            ) : null}
            {tab === "orders" ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{price(o.amount)}</td>
                        <td>{o.status}</td>
                        <td>{o.created_at.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">
                  Issue test refunds in Stripe Dashboard. Verified refund
                  webhooks revoke publication. No refund action is initiated
                  here.
                </p>
              </div>
            ) : null}
            {tab === "delivery" ? (
              <section>
                <h2>Confirmation delivery</h2>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const r = await api<{
                        sent: number;
                        configured: boolean;
                      }>("admin/retry-mail", "POST", {});
                      setMessage(
                        r.configured
                          ? `${r.sent} confirmations sent.`
                          : "Configure the email provider first.",
                      );
                    })
                  }
                >
                  Retry due emails
                </button>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.jobs.map((j) => (
                        <tr key={j.id}>
                          <td>{j.order_id}</td>
                          <td>{j.status}</td>
                          <td>{j.attempts}</td>
                          <td>{j.last_error || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            {tab === "projects" ? (
              <section>
                <h2>Publication support</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Published revision</th>
                        <th>Access</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.published_revision || "Draft"}</td>
                          <td>{p.blocked ? "Blocked" : "Active"}</td>
                          <td>
                            <button
                              className="text-link"
                              disabled={busy}
                              onClick={() =>
                                act(async () => {
                                  await api("admin/block", "POST", {
                                    id: p.id,
                                    blocked: !p.blocked,
                                  });
                                })
                              }
                            >
                              {p.blocked ? "Unblock" : "Block"}
                            </button>
                            <button
                              className="text-link"
                              disabled={busy}
                              onClick={() => {
                                const reason = prompt(
                                  "Explain the support need for viewing this customer’s private content (at least 10 characters). This access is audited.",
                                );
                                if (reason)
                                  void act(async () => {
                                    const result = await api<{
                                      project: unknown;
                                    }>("admin/inspect", "POST", {
                                      id: p.id,
                                      reason,
                                    });
                                    alert(
                                      JSON.stringify(result.project, null, 2),
                                    );
                                  });
                              }}
                            >
                              Inspect with reason
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            {tab === "audit" ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((a) => (
                      <tr key={a.id}>
                        <td>{a.created_at}</td>
                        <td>{a.actor_id}</td>
                        <td>{a.action}</td>
                        <td>{a.target_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
