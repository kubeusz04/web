"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Play,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Monitor,
  Smartphone,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Link2,
  Lock,
} from "lucide-react";
import QRCode from "qrcode";
import Experience from "./experience";
import { Brand, Field, Notice, Loading, LocalNotice } from "./ui";
import { api } from "@/lib/client";
import {
  giftSchema,
  blankItem,
  type Gift,
  type GiftItem,
  type GiftSection,
} from "@/lib/schema";
import { price, type Catalog } from "@/lib/config";
import type { Project } from "@/lib/service";
import {GiftSettings,SectionSettings,ItemSettings} from './original-settings';
const titles = {
  film: "Film scenes",
  archive: "Archive",
  cosmos: "Stars & planets",
  surprise: "Surprises",
};
interface MediaInfo {
  id: string;
  mime: string;
  bytes: number;
  state?: string;
}
export default function Editor({ id }: { id: string }) {
  const router = useRouter(),
    [project, setProject] = useState<Project | null>(null),
    [draft, setDraft] = useState<Gift | null>(null),
    [cat, setCat] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Loading…"),
    [tab, setTab] = useState(1),
    [sectionIndex, setSectionIndex] = useState(0),
    [itemIndex, setItemIndex] = useState(0),
    [mobile, setMobile] = useState(false),
    [preview, setPreview] = useState(false),
    [files, setFiles] = useState<MediaInfo[]>([]),
    [rights, setRights] = useState(false),
    [uploading, setUploading] = useState(false),
    [info, setInfo] = useState(""),
    [password, setPassword] = useState(""),
    [plan, setPlan] = useState("essential"),
    [consents, setConsents] = useState({
      terms: false,
      immediate: false,
      acknowledge: false,
    }),
    [busy, setBusy] = useState(false),
    [qr, setQr] = useState("");
  const revision = useRef(1),
    saved = useRef(""),
    sequence = useRef(0),
    queue = useRef<Promise<void>>(Promise.resolve()),
    current = useRef<Gift | null>(null);
  current.current = draft;
  useEffect(() => {
    Promise.all([
      api<{ project: Project }>(`projects/${id}`),
      api<{ catalog: Catalog }>("catalog"),
      api<{ media: MediaInfo[] }>(`projects/${id}/media`),
    ])
      .then(([p, c, m]) => {
        setProject(p.project);
        revision.current = p.project.revision;
        saved.current = JSON.stringify(p.project.draft);
        let recovered: Gift | null = null;
        try {
          const backup = JSON.parse(
            localStorage.getItem(`blisko-draft:${id}`) || "null",
          );
          if (backup?.revision === p.project.revision)
            recovered = giftSchema.parse(backup.draft);
        } catch {}
        setDraft(recovered || p.project.draft);
        setCat(c.catalog);
        setFiles(m.media);
        setStatus(recovered ? "Recovered changes…" : "Saved");
      })
      .catch((e) => {
        setError(e.message);
        if (e.message.includes("Sign in")) router.replace("/auth");
      });
  }, [id, router]);
  const save = useCallback(
    (value: Gift) => {
      const serialized = JSON.stringify(value);
      if (serialized === saved.current) return queue.current;
      const seq = ++sequence.current;
      setStatus("Saving…");
      try {
        localStorage.setItem(
          `blisko-draft:${id}`,
          JSON.stringify({ draft: value, revision: revision.current }),
        );
      } catch {}
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          try {
            giftSchema.parse(value);
            const result = await api<{ revision: number }>(
              `projects/${id}`,
              "PUT",
              { draft: value, revision: revision.current },
            );
            revision.current = result.revision;
            saved.current = serialized;
            setProject((p) => (p ? { ...p, revision: result.revision } : p));
            if (
              seq === sequence.current &&
              JSON.stringify(current.current) === serialized
            ) {
              setStatus("Saved");
              localStorage.removeItem(`blisko-draft:${id}`);
            } else setStatus("Unsaved changes");
            setError("");
          } catch (e) {
            setStatus("Save failed");
            setError((e as Error).message);
            throw e;
          }
        });
      return queue.current;
    },
    [id],
  );
  useEffect(() => {
    if (!draft || JSON.stringify(draft) === saved.current) return;
    setStatus("Unsaved changes");
    try {
      localStorage.setItem(
        `blisko-draft:${id}`,
        JSON.stringify({ draft, revision: revision.current }),
      );
    } catch {}
    const timer = setTimeout(() => {
      void save(draft).catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, id, save]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (current.current && JSON.stringify(current.current) !== saved.current)
        event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  const shareLink = project?.published
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/g/${project.token}`
    : "";
  useEffect(() => {
    if (shareLink)
      QRCode.toDataURL(shareLink, {
        width: 240,
        margin: 2,
        color: { dark: "#29251f", light: "#f8f5ef" },
      }).then(setQr);
    else setQr("");
  }, [shareLink]);
  function update<K extends keyof Gift>(key: K, value: Gift[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function mutateSection(fn: (s: GiftSection) => GiftSection) {
    setDraft((d) =>
      d
        ? {
            ...d,
            sections: d.sections.map((s, i) =>
              i === sectionIndex ? fn(s) : s,
            ),
          }
        : d,
    );
  }
  function mutateItem(change: Partial<GiftItem>) {
    mutateSection((s) => ({
      ...s,
      items: s.items.map((item, i) =>
        i === itemIndex ? { ...item, ...change } : item,
      ),
    }));
  }
  function moveItem(delta: number) {
    mutateSection((s) => {
      const a = [...s.items],
        next = itemIndex + delta;
      if (next < 0 || next >= a.length) return s;
      [a[itemIndex], a[next]] = [a[next], a[itemIndex]];
      setItemIndex(next);
      return { ...s, items: a };
    });
  }
  async function refreshProject() {
    const { project: p } = await api<{ project: Project }>(`projects/${id}`);
    setProject(p);
    return p;
  }
  async function action(fn: () => Promise<void>) {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (draft) await save(draft);
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadFile(file: File) {
    if (!rights) {
      setError("Confirm that you have the right to use this material.");
      return;
    }
    const targetSection = draft?.sections[sectionIndex]?.id;
    const targetItem = draft?.sections[sectionIndex]?.items[itemIndex]?.id;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("rights", "true");
      const result = await api<MediaInfo>(`projects/${id}/media`, "POST", form);
      setFiles((m) => [...m, result]);
      setDraft((value) =>
        value
          ? {
              ...value,
              sections: value.sections.map((section) =>
                section.id === targetSection
                  ? {
                      ...section,
                      items: section.items.map((item) =>
                        item.id === targetItem
                          ? {
                              ...item,
                              mediaId: result.id,
                              mediaKind: result.mime.startsWith("video")
                                ? "video"
                                : result.mime.startsWith("audio")
                                  ? "audio"
                                  : "image",
                            }
                          : item,
                      ),
                    }
                  : section,
              ),
            }
          : value,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  if (!draft || !project || !cat)
    return (
      <>
        <LocalNotice />
        <div className="page-container">
          {error ? <Notice error>{error}</Notice> : <Loading />}
          <Link href="/dashboard">Back to your gifts</Link>
        </div>
      </>
    );
  const section =
      draft.sections[Math.min(sectionIndex, draft.sections.length - 1)],
    item = section.items[itemIndex];
  return (
    <div className="editor-page">
      <LocalNotice />
      <header className="editor-header">
        <Brand />
        <Link href="/dashboard" className="back-link">
          <ArrowLeft size={16} />
          My gifts
        </Link>
        <div className="editor-header-actions">
          <span
            className={`save-status ${status === "Saved" ? "saved" : ""}`}
            role="status"
          >
            {status === "Saved" ? <Check size={15} /> : <RefreshCw size={14} />}
            <span>{status}</span>
          </span>
          <button
            className="button small"
            onClick={() => action(async () => setPreview(!preview))}
            disabled={busy}
          >
            <Play size={15} />
            {preview ? "Back to editing" : "Preview"}
          </button>
        </div>
      </header>
      <div className="editor-project-title">
        <h1>{draft.title}</h1>
        <span>
          A gift for{" "}
          {draft.occasion === "inna"
            ? "a special occasion"
            : draft.occasion === "urodziny"
              ? "a birthday"
              : draft.occasion === "walentynki"
                ? "Valentine day"
                : "an anniversary"}
        </span>
      </div>
      {error ? (
        <Notice error>
          {error}
          {status === "Save failed" ? (
            <button onClick={() => save(draft).catch(() => {})}>
              Retry save
            </button>
          ) : null}
        </Notice>
      ) : null}
      {info ? <Notice>{info}</Notice> : null}
      {preview ? (
        <main className="full-preview">
          <button className="text-link" onClick={() => setPreview(false)}>
            <ArrowLeft size={16} />
            Back to editing
          </button>
          <Experience gift={draft} />
        </main>
      ) : (
        <main className="editor-layout">
          <aside className="editor-nav" aria-label="Editing steps">
            {["The basics", "Your story", "Look & feel", "Sharing"].map(
              (name, i) => (
                <button
                  key={name}
                  className={tab === i ? "active" : ""}
                  onClick={() => setTab(i)}
                >
                  <span>0{i + 1}</span>
                  {name}
                </button>
              ),
            )}
            <div className="editor-note">
              <Lock size={16} />
              <p>
                Your draft is private. Recipients only see changes after you
                publish.
              </p>
            </div>
          </aside>
          <section className="editor-fields" aria-label="Personalisation">
            {tab === 0 ? (
              <>
                <h2>Your story starts here.</h2>
                <p className="muted">A few words that make this gift yours.</p>
                <Field label="Gift title">
                  <input
                    value={draft.title}
                    maxLength={120}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </Field>
                <div className="form-row">
                  <Field label="From">
                    <input
                      value={draft.from}
                      maxLength={80}
                      onChange={(e) => update("from", e.target.value)}
                    />
                  </Field>
                  <Field label="To">
                    <input
                      value={draft.to}
                      maxLength={80}
                      onChange={(e) => update("to", e.target.value)}
                    />
                  </Field>
                </div>
                <GiftSettings gift={draft} files={files} onChange={change=>setDraft(d=>d?{...d,...change}:d)}/>
                <Field label="Occasion">
                  <select
                    value={draft.occasion}
                    onChange={(e) =>
                      update("occasion", e.target.value as Gift["occasion"])
                    }
                  >
                    <option value="rocznica">Anniversary</option>
                    <option value="urodziny">Birthday</option>
                    <option value="walentynki">Valentine’s Day</option>
                    <option value="inna">Another occasion</option>
                  </select>
                </Field>
                <Field label="Your date">
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => update("date", e.target.value)}
                  />
                </Field>
                <Field label="Language">
                  <select value="en" onChange={() => {}}>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label="Dedication">
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={draft.dedication}
                    onChange={(e) => update("dedication", e.target.value)}
                  />
                </Field>
                <Field label="A few final words">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={draft.finale}
                    onChange={(e) => update("finale", e.target.value)}
                  />
                </Field>
              </>
            ) : null}
            {tab === 1 ? (
              <>
                <div className="section-toolbar">
                  <select
                    aria-label="Choose a section"
                    value={sectionIndex}
                    onChange={(e) => {
                      setSectionIndex(Number(e.target.value));
                      setItemIndex(0);
                    }}
                  >
                    {draft.sections.map((s, i) => (
                      <option key={s.id} value={i}>
                        {i + 1}. {s.title}
                        {s.enabled ? "" : " (hidden)"}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    title="Show or hide section"
                    aria-label="Show or hide section"
                    onClick={() =>
                      mutateSection((s) => ({ ...s, enabled: !s.enabled }))
                    }
                  >
                    {section.enabled ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                </div>
                <h2>{titles[section.type]}</h2>
                <p className="muted">Every moment has its place.</p>
                <Field label="Section name">
                  <input
                    value={section.title}
                    maxLength={120}
                    onChange={(e) =>
                      mutateSection((s) => ({ ...s, title: e.target.value }))
                    }
                  />
                </Field>
                <SectionSettings section={section} onChange={change=>mutateSection(s=>({...s,...change}))}/>
                <div className="item-list">
                  {section.items.map((s, i) => (
                    <button
                      key={s.id}
                      className={i === itemIndex ? "active" : ""}
                      onClick={() => setItemIndex(i)}
                    >
                      <span className="grip">⠿</span>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <strong>{s.title || "Untitled"}</strong>
                      {s.hidden ? (
                        <EyeOff size={13} />
                      ) : (
                        <ArrowRight size={15} />
                      )}
                    </button>
                  ))}
                  <button
                    className="add-row"
                    disabled={section.items.length >= 100}
                    onClick={() => {
                      mutateSection((s) => ({
                        ...s,
                        items: [...s.items, blankItem()],
                      }));
                      setItemIndex(section.items.length);
                    }}
                  >
                    <Plus size={16} />
                    Add {section.type === "film" ? "scene" : "memory"}
                  </button>
                </div>
                {item ? (
                  <div className="item-form">
                    <div className="item-tools">
                      <span>Item {itemIndex + 1}</span>
                      <button
                        className="icon-button"
                        aria-label="Move earlier"
                        disabled={itemIndex === 0}
                        onClick={() => moveItem(-1)}
                      >
                        <ChevronUp size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Move later"
                        disabled={itemIndex === section.items.length - 1}
                        onClick={() => moveItem(1)}
                      >
                        <ChevronDown size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={item.hidden ? "Show item" : "Hide item"}
                        onClick={() => mutateItem({ hidden: !item.hidden })}
                      >
                        {item.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label="Delete item"
                        onClick={() => {
                          mutateSection((s) => ({
                            ...s,
                            items: s.items.filter((_, i) => i !== itemIndex),
                          }));
                          setItemIndex(Math.max(0, itemIndex - 1));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <Field
                      label={section.type === "surprise" ? "Clue" : "Heading"}
                    >
                      <input
                        value={item.title}
                        maxLength={160}
                        onChange={(e) => mutateItem({ title: e.target.value })}
                      />
                    </Field>
                    <Field
                      label={
                        section.type === "surprise"
                          ? "Hidden message"
                          : "Description"
                      }
                    >
                      <textarea
                        value={item.body}
                        maxLength={12000}
                        rows={5}
                        onChange={(e) => mutateItem({ body: e.target.value })}
                      />
                    </Field>
                    {section.type === "film" ? (
                      <Field label="Scene duration (seconds)">
                        <input
                          type="number"
                          min={3}
                          max={60}
                          value={item.duration}
                          onChange={(e) =>
                            mutateItem({ duration: Number(e.target.value) })
                          }
                        />
                      </Field>
                    ) : (
                      <>
                        <Field label="Date">
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) =>
                              mutateItem({ date: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Category">
                          <select
                            value={item.category}
                            onChange={(e) =>
                              mutateItem({ category: e.target.value })
                            }
                          >
                            {[
                              ...new Set([
                                "Memory",
                                "Letter",
                                "Reason",
                                "Gallery",
                                "Message", "Joke",
                                item.category,
                              ]),
                            ].map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                    <ItemSettings item={item} type={section.type} files={files} onChange={mutateItem}/>
                    {section.type === "cosmos" ? (
                      <Field label="Object type">
                        <select
                          value={item.kind}
                          onChange={(e) =>
                            mutateItem({
                              kind: e.target.value as GiftItem["kind"],
                            })
                          }
                        >
                          <option value="star">Star</option>
                          <option value="planet">Planet</option>
                        </select>
                      </Field>
                    ) : null}
                    {section.type === "surprise" ? (
                      <Field
                        label="Unlock answer"
                        hint="Leave blank to reveal with a click. This is a game, not a security feature."
                      >
                        <input
                          value={item.answer}
                          maxLength={120}
                          onChange={(e) =>
                            mutateItem({ answer: e.target.value })
                          }
                        />
                      </Field>
                    ) : null}
                    <Field label="Photo, video or audio">
                      <select
                        value={item.mediaId || ""}
                        onChange={(e) => {
                          const media = files.find(
                            (m) => m.id === e.target.value,
                          );
                          mutateItem({
                            mediaId: media?.id || null,
                            mediaKind: media?.mime.startsWith("video")
                              ? "video"
                              : media?.mime.startsWith("audio")
                                ? "audio"
                                : "image",
                          });
                        }}
                      >
                        <option value="">No media</option>
                        {files
                          .filter((m) => !m.state || m.state === "ready")
                          .map((m, i) => (
                            <option key={m.id} value={m.id}>
                              File {i + 1} · {m.mime} ·{" "}
                              {(m.bytes / 1024 / 1024).toFixed(1)} MB
                            </option>
                          ))}
                      </select>
                    </Field>
                    {item.mediaId && item.mediaKind === "image" ? (
                      <div className="crop-controls">
                        <Field label={`Horizontal crop: ${item.x}%`}>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={item.x}
                            onChange={(e) =>
                              mutateItem({ x: Number(e.target.value) })
                            }
                          />
                        </Field>
                        <Field label={`Vertical crop: ${item.y}%`}>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={item.y}
                            onChange={(e) =>
                              mutateItem({ y: Number(e.target.value) })
                            }
                          />
                        </Field>
                      </div>
                    ) : null}
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={rights}
                        onChange={(e) => setRights(e.target.checked)}
                      />
                      I have the right to use these files, including music and
                      images of people.
                    </label>
                    <label
                      className={`upload-area ${uploading ? "disabled" : ""}`}
                    >
                      <Upload size={20} />
                      <strong>
                        {uploading ? "Uploading…" : "Upload a file"}
                      </strong>
                      <span>JPG, PNG, WebP, MP4, MP3, WAV · up to 25 MB</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,audio/mpeg,audio/wav"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <Notice>Add an item to this section.</Notice>
                )}
                <details className="section-management">
                  <summary>Manage sections and media</summary>
                  <div className="form-row">
                    <button
                      className="button secondary small"
                      disabled={sectionIndex === 0}
                      onClick={() => {
                        const s = [...draft.sections];
                        [s[sectionIndex - 1], s[sectionIndex]] = [
                          s[sectionIndex],
                          s[sectionIndex - 1],
                        ];
                        update("sections", s);
                        setSectionIndex(sectionIndex - 1);
                      }}
                    >
                      Move section earlier
                    </button>
                    <button
                      className="button secondary small"
                      disabled={sectionIndex === draft.sections.length - 1}
                      onClick={() => {
                        const s = [...draft.sections];
                        [s[sectionIndex + 1], s[sectionIndex]] = [
                          s[sectionIndex],
                          s[sectionIndex + 1],
                        ];
                        update("sections", s);
                        setSectionIndex(sectionIndex + 1);
                      }}
                    >
                      Move section later
                    </button>
                  </div>
                  <Field label="Add a section">
                    <select
                      value=""
                      disabled={draft.sections.length >= 12}
                      onChange={(e) => {
                        const type = e.target.value as GiftSection["type"];
                        update("sections", [
                          ...draft.sections,
                          {
                            id: crypto.randomUUID(),
                            type,
                            title: titles[type],
                            enabled: true,
                            items: [blankItem()],
                          },
                        ]);
                        setSectionIndex(draft.sections.length);
                        setItemIndex(0);
                      }}
                    >
                      <option value="" disabled>
                        Choose a type…
                      </option>
                      {Object.entries(titles).map(([type, title]) => (
                        <option key={type} value={type}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    className="text-link danger"
                    disabled={draft.sections.length === 1}
                    onClick={() => {
                      update(
                        "sections",
                        draft.sections.filter((_, i) => i !== sectionIndex),
                      );
                      setSectionIndex(0);
                      setItemIndex(0);
                    }}
                  >
                    <Trash2 size={15} />
                    Delete selected section
                  </button>
                  <p className="muted">
                    Delete unused files to free up storage. Published files must
                    first be detached and the gift republished.
                  </p>
                  {files.map((m, i) => (
                    <div className="file-row" key={m.id}>
                      <span>
                        File {i + 1} · {(m.bytes / 1048576).toFixed(1)} MB
                      </span>
                      <button
                        className="icon-button danger"
                        aria-label={`Delete file ${i + 1}`}
                        onClick={() =>
                          action(async () => {
                            await api(`projects/${id}/media/${m.id}`, "DELETE");
                            setFiles((f) => f.filter((x) => x.id !== m.id));
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </details>
              </>
            ) : null}
            {tab === 2 ? (
              <>
                <h2>Make it feel like you.</h2>
                <p className="muted">
                  Choose the colours and type that tell your story.
                </p>
                <Field label="Palette">
                  <select
                    value={draft.theme}
                    onChange={(e) =>
                      update("theme", e.target.value as Gift["theme"])
                    }
                  >
                    <option value="clay">Original — rose, gold & midnight</option>
                    <option value="rose">Rose & plum</option>
                    <option value="forest">Sage & forest</option>
                  </select>
                </Field>
                <div className={`palette-preview palette-${draft.theme}`}>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <Field label="Typography">
                  <select
                    value={draft.font}
                    onChange={(e) =>
                      update("font", e.target.value as Gift["font"])
                    }
                  >
                    <option value="editorial">Original fonts</option>
                    <option value="modern">Modern — Inter</option>
                  </select>
                </Field>
                <p className="small muted">
                  Original fonts are hosted locally. No external font requests or tracking.
                </p>
              </>
            ) : null}
            {tab === 3 ? (
              <>
                <h2>Ready to make their day?</h2>
                <p className="muted">
                  Purchase first. Then decide when to publish.
                </p>
                {project.paid ? (
                  <Notice>
                    Payment confirmed. Your gift is ready to publish.
                  </Notice>
                ) : (
                  <>
                    <Field label="Choose your package">
                      <select
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                      >
                        {cat.plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {price(p.price)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="small muted">
                      {cat.plans.find((p) => p.id === plan)?.maxItems} items,{" "}
                      {cat.plans.find((p) => p.id === plan)?.maxFiles} files,{" "}
                      {Math.round(
                        (cat.plans.find((p) => p.id === plan)?.maxBytes || 0) /
                          1048576,
                      )}{" "}
                      MB. Hosting for{" "}
                      {cat.plans.find((p) => p.id === plan)?.days} days from
                      payment. Up to 25 MB per file.
                    </p>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={consents.terms}
                        onChange={(e) =>
                          setConsents((c) => ({
                            ...c,
                            terms: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        I accept the{" "}
                        <Link href="/legal/terms" target="_blank">
                          terms
                        </Link>{" "}
                        and have read the{" "}
                        <Link href="/legal/privacy" target="_blank">
                          privacy notice
                        </Link>
                        .
                      </span>
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={consents.immediate}
                        onChange={(e) =>
                          setConsents((c) => ({
                            ...c,
                            immediate: e.target.checked,
                          }))
                        }
                      />
                      I expressly consent to delivery of digital content
                      starting before the 14-day withdrawal period ends.
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={consents.acknowledge}
                        onChange={(e) =>
                          setConsents((c) => ({
                            ...c,
                            acknowledge: e.target.checked,
                          }))
                        }
                      />
                      I acknowledge losing my right of withdrawal once
                      performance is completed, as described in the terms.
                    </label>
                    <button
                      className="button full"
                      disabled={busy || !Object.values(consents).every(Boolean)}
                      onClick={() =>
                        action(async () => {
                          const r = await api<{ url: string }>(
                            `projects/${id}/checkout`,
                            "POST",
                            { plan, consent: consents },
                          );
                          window.location.assign(r.url);
                        })
                      }
                    >
                      Order & pay{" "}
                      {price(cat.plans.find((p) => p.id === plan)?.price || 0)}
                      <ArrowRight size={17} />
                    </button>
                    <p className="small muted">
                      Stripe test mode only. Checkout requires configured keys.
                      Demo accounts do not receive paid entitlements.
                    </p>
                  </>
                )}
                <div className="publication-box">
                  <h3>
                    {project.published ? "Published version" : "Your gift link"}
                  </h3>
                  <p className="small muted">
                    {project.published
                      ? `Your recipient sees revision ${project.published_revision}. Draft: ${project.revision}.`
                      : "Your link is available after confirmed payment and publication."}
                  </p>
                  <button
                    className="button full"
                    disabled={!project.paid || busy}
                    onClick={() =>
                      action(async () => {
                        await api(`projects/${id}/publish`, "POST", {});
                        await refreshProject();
                        setInfo(
                          "Your gift is published. You can share the link.",
                        );
                      })
                    }
                  >
                    {project.published ? "Publish changes" : "Publish gift"}
                    <ArrowUpIcon />
                  </button>
                  {shareLink ? (
                    <>
                      <Field label="Recipient link">
                        <input readOnly value={shareLink} />
                      </Field>
                      <div className="form-row">
                        <button
                          className="button secondary small"
                          onClick={() =>
                            action(async () => {
                              await navigator.clipboard.writeText(shareLink);
                              setInfo("Link copied.");
                            })
                          }
                        >
                          <Copy size={15} />
                          Copy
                        </button>
                        <Link
                          className="button secondary small"
                          href={shareLink}
                          target="_blank"
                        >
                          Open
                          <ExternalLink size={15} />
                        </Link>
                      </div>
                      {qr ? (
                        <a
                          href={qr}
                          download="websitegift-qr.png"
                          className="qr-download"
                        >
                          <img
                            src={qr}
                            alt="QR code for your gift"
                            width={120}
                            height={120}
                          />
                          <span>Download QR code</span>
                        </a>
                      ) : null}
                    </>
                  ) : null}
                  <p className="small muted">
                    Anyone with the link can open or forward it. Add a password
                    for extra protection.
                  </p>
                  {project.expires_at ? (
                    <p className="small">
                      Available until:{" "}
                      {new Date(project.expires_at).toLocaleDateString("en-GB")}
                    </p>
                  ) : null}
                </div>
                <Field
                  label={
                    project.hasPassword
                      ? "Change gift password"
                      : "Optional gift password"
                  }
                  hint="At least 8 characters. Share the password separately."
                >
                  <input
                    type="password"
                    value={password}
                    minLength={8}
                    autoComplete="new-password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <button
                  className="button secondary small"
                  disabled={busy || password.length < 8}
                  onClick={() =>
                    action(async () => {
                      await api(`projects/${id}/sharing`, "POST", { password });
                      setPassword("");
                      await refreshProject();
                      setInfo("Password saved.");
                    })
                  }
                >
                  <Lock size={14} />
                  Save password
                </button>
                {project.hasPassword ? (
                  <button
                    className="text-link"
                    onClick={() =>
                      action(async () => {
                        await api(`projects/${id}/sharing`, "POST", {
                          password: "",
                        });
                        await refreshProject();
                        setInfo("Password removed.");
                      })
                    }
                  >
                    Remove password
                  </button>
                ) : null}
                <hr />
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "The old link will stop working. Generate a new one?",
                      )
                    )
                      void action(async () => {
                        await api(`projects/${id}/sharing`, "POST", {
                          rotate: true,
                        });
                        await refreshProject();
                        setInfo(
                          "New link generated. The old link has been revoked.",
                        );
                      });
                  }}
                >
                  <RefreshCw size={15} />
                  Generate a new link
                </button>
                <button
                  className="text-link danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Revoke recipient access? You can publish again later.",
                      )
                    )
                      void action(async () => {
                        await api(`projects/${id}/sharing`, "POST", {
                          revoke: true,
                        });
                        await refreshProject();
                        setInfo("Recipient access has been revoked.");
                      });
                  }}
                >
                  <Link2 size={15} />
                  Revoke link and unpublish
                </button>
              </>
            ) : null}
          </section>
          <section className="live-preview">
            <div className="preview-toolbar">
              <h2>Live preview</h2>
              <div className="device-toggle">
                <button
                  aria-label="Desktop view"
                  className={!mobile ? "active" : ""}
                  onClick={() => setMobile(false)}
                >
                  <Monitor size={17} />
                  <span>Desktop view</span>
                </button>
                <button
                  aria-label="Mobile view"
                  className={mobile ? "active" : ""}
                  onClick={() => setMobile(true)}
                >
                  <Smartphone size={17} />
                  <span>Mobile view</span>
                </button>
              </div>
            </div>
            <div className={mobile ? "preview-frame mobile" : "preview-frame"}>
              <Experience gift={draft} compact />
            </div>
            <p className="preview-disclaimer">
              The preview and published gift use the same renderer. Photos
              appear once you add them.
            </p>
          </section>
        </main>
      )}
      <footer className="editor-footer">
        <RefreshCw size={14} />
        Your changes save automatically.{" "}
        <span>
          Draft · {draft.sections.reduce((a, s) => a + s.items.length, 0)} items
        </span>
      </footer>
    </div>
  );
}
function ArrowUpIcon() {
  return <ArrowRight size={16} />;
}
