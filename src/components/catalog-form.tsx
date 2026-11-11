"use client";
import { Field, Notice } from "./ui";
import type { Catalog } from "@/lib/config";
export default function CatalogForm({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  let config: Catalog;
  try {
    config = JSON.parse(value);
  } catch {
    return (
      <Notice error>
        Correct the JSON in Advanced configuration before editing these fields.
      </Notice>
    );
  }
  if (!config?.templates || !config.plans || !config.faq)
    return <Notice error>The configuration is incomplete.</Notice>;
  function change(fn: (c: Catalog) => void) {
    const copy = structuredClone(config);
    fn(copy);
    onChange(JSON.stringify(copy, null, 2));
  }
  return (
    <div className="catalog-form">
      <section>
        <h3>Homepage</h3>
        <Field label="Main headline">
          <input
            value={config.headline}
            maxLength={200}
            onChange={(e) =>
              change((c) => {
                c.headline = e.target.value;
              })
            }
          />
        </Field>
        <Field label="Introduction">
          <textarea
            value={config.intro}
            maxLength={600}
            rows={3}
            onChange={(e) =>
              change((c) => {
                c.intro = e.target.value;
              })
            }
          />
        </Field>
      </section>
      <section>
        <h3>Experiences and product pages</h3>
        <div className="admin-catalog-columns">
          {config.templates.map((t, i) => (
            <div className="catalog-group" key={t.id}>
              <span className="step-label">{t.id}</span>
              <Field label={`Product name · ${t.id}`}>
                <input
                  value={t.name}
                  maxLength={100}
                  onChange={(e) =>
                    change((c) => {
                      c.templates[i].name = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label={`Product description · ${t.id}`}>
                <textarea
                  value={t.description}
                  maxLength={300}
                  rows={3}
                  onChange={(e) =>
                    change((c) => {
                      c.templates[i].description = e.target.value;
                    })
                  }
                />
              </Field>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={(e) =>
                    change((c) => {
                      c.templates[i].enabled = e.target.checked;
                    })
                  }
                />
                Available for new gifts
              </label>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Packages</h3>
        <p className="small muted">
          Limits apply to the whole gift. Updating these values never rewrites
          an existing order.
        </p>
        <div className="admin-catalog-columns">
          {config.plans.map((p, i) => (
            <div className="catalog-group" key={p.id}>
              <Field label={`Package name · ${p.id}`}>
                <input
                  value={p.name}
                  maxLength={100}
                  onChange={(e) =>
                    change((c) => {
                      c.plans[i].name = e.target.value;
                    })
                  }
                />
              </Field>
              <div className="form-row">
                <Field label={`Price (PLN) · ${p.id}`}>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step="0.01"
                    value={p.price / 100}
                    onChange={(e) =>
                      change((c) => {
                        c.plans[i].price = Math.round(
                          Number(e.target.value) * 100,
                        );
                      })
                    }
                  />
                </Field>
                <Field label={`Hosting days · ${p.id}`}>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={p.days}
                    onChange={(e) =>
                      change((c) => {
                        c.plans[i].days = Number(e.target.value);
                      })
                    }
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label={`Memory limit · ${p.id}`}>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={p.maxItems}
                    onChange={(e) =>
                      change((c) => {
                        c.plans[i].maxItems = Number(e.target.value);
                      })
                    }
                  />
                </Field>
                <Field label={`File limit · ${p.id}`}>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={p.maxFiles}
                    onChange={(e) =>
                      change((c) => {
                        c.plans[i].maxFiles = Number(e.target.value);
                      })
                    }
                  />
                </Field>
                <Field label={`Storage (MB) · ${p.id}`}>
                  <input
                    type="number"
                    min={1}
                    max={1024}
                    value={p.maxBytes / 1048576}
                    onChange={(e) =>
                      change((c) => {
                        c.plans[i].maxBytes = Math.round(
                          Number(e.target.value) * 1048576,
                        );
                      })
                    }
                  />
                </Field>
              </div>
              <button
                className="text-link danger"
                disabled={config.plans.length === 1}
                onClick={() =>
                  change((c) => {
                    c.plans.splice(i, 1);
                  })
                }
              >
                Remove package
              </button>
            </div>
          ))}
        </div>
        <button
          className="button secondary small"
          disabled={config.plans.length >= 5}
          onClick={() =>
            change((c) => {
              c.plans.push({
                id: "plan" + crypto.randomUUID().replace(/[^a-z]/g, ""),
                name: "New package",
                price: 4900,
                maxItems: 20,
                maxFiles: 20,
                maxBytes: 100 * 1048576,
                days: 365,
              });
            })
          }
        >
          Add a package
        </button>
      </section>
      <section>
        <h3>Frequently asked questions</h3>
        {config.faq.map((f, i) => (
          <div className="catalog-group" key={i}>
            <Field label={`Question ${i + 1}`}>
              <input
                value={f.q}
                maxLength={200}
                onChange={(e) =>
                  change((c) => {
                    c.faq[i].q = e.target.value;
                  })
                }
              />
            </Field>
            <Field label={`Answer ${i + 1}`}>
              <textarea
                value={f.a}
                maxLength={2000}
                rows={3}
                onChange={(e) =>
                  change((c) => {
                    c.faq[i].a = e.target.value;
                  })
                }
              />
            </Field>
            <button
              className="text-link danger"
              onClick={() =>
                change((c) => {
                  c.faq.splice(i, 1);
                })
              }
            >
              Remove question
            </button>
          </div>
        ))}
        <button
          className="button secondary small"
          disabled={config.faq.length >= 20}
          onClick={() =>
            change((c) => {
              c.faq.push({
                q: "New question",
                a: "Write a clear, honest answer.",
              });
            })
          }
        >
          Add a question
        </button>
      </section>
    </div>
  );
}
