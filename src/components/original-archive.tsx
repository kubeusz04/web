"use client";
import { useState, useEffect, useRef } from "react";
import type { Gift, GiftSection, GiftItem } from "@/lib/schema";
import { ItemMedia } from "./media-view";
import OriginalVeil from './original-veil';
import {archiveStatistics} from '@/lib/presentation';
const category = (item: GiftItem) =>
  (
    ({
      Wspomnienie: "Memory",
      List: "Letter",
      Powód: "Reason",
      Galeria: "Gallery",
      Wiadomość: "Message",
    })[item.category] || item.category
  ).toLowerCase();
export default function OriginalArchive({
  gift,
  section,
  demo,
  win,
}: {
  gift: Gift;
  section: GiftSection;
  demo: boolean;
  win: Window;
}) {
  const normal = gift.relationshipMode === "normal";
  const momentCategories = normal ? ["letter", "moment", "date", "shared moment"] : ["letter"];
  const revealEnabled=section.revealEnabled!==false;
  const [gate, setGate] = useState(true),
    [revealing, setRevealing] = useState(false),
    [readerSelection, setReader] = useState<GiftItem | null>(null),
    [reason, setReason] = useState(0),
    [allReasons, setAllReasons] = useState(false),
    [lit, setLit] = useState(0);
  const close = useRef<HTMLButtonElement>(null),
    lastFocus = useRef<HTMLElement | null>(null);
  const visible = section.items.filter((i) => !i.hidden),
    letters = visible.filter((i) => momentCategories.includes(category(i))),
    reasons = visible.filter((i) => category(i) === "reason"),
    jokes = visible.filter((i) =>
      ["joke", "inside joke"].includes(category(i)),
    ),
    gallery = visible.filter((i) => category(i) === "gallery"),
    timeline = visible.filter(
      (i) =>
        ![...momentCategories, "reason", "joke", "inside joke", "gallery"].includes(
          category(i),
        ),
    );
  const labels = {
    timeline: "How it actually began",
    letters: `${letters.length} ${normal ? (letters.length === 1 ? 'shared moment' : 'shared moments') : (letters.length === 1 ? 'letter' : 'letters')}`,
    reasons: `${reasons.length} ${reasons.length === 1 ? 'reason' : 'reasons'}`,
    jokes: "Inside jokes",
    gallery: "Every single one",
  };
  const reader=visible.find(item=>item.id===readerSelection?.id)||null;
  for(const key of Object.keys(labels) as (keyof typeof labels)[])if(section.headingLabels?.[key])labels[key]=section.headingLabels[key];
  useEffect(() => {
    if (reader) {
      lastFocus.current = win.document.activeElement as HTMLElement;
      close.current?.focus();
    } else lastFocus.current?.focus();
  }, [reader?.id,win]);
  useEffect(()=>{
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReader(null);
      if (reader && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const i = letters.findIndex((l) => l.id === reader.id);
        if (i >= 0)
          setReader(
            letters[
              Math.max(
                0,
                Math.min(
                  letters.length - 1,
                  i + (e.key === "ArrowRight" ? 1 : -1),
                ),
              )
            ],
          );
      }
      if (reader && e.key === "Tab") {
        const dialog = win.document.querySelector(".reader");
        const controls = dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),audio,video,[tabindex="0"]',
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && win.document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && win.document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    win.addEventListener("keydown", key);
    return () => win.removeEventListener("keydown", key);
  }, [reader, win, letters]);
  const open = (item: GiftItem) => setReader(item);
  const title = (name: string, kicker: string) => (
    <div className="sec__head">
      <p className="kicker">{kicker}</p>
      <h2>{name}</h2>
    </div>
  );
  return (
    <>
      <div className="wash" />
      <div className="grain" />
      <nav id="nav" aria-label="Archive sections">
        <ul id="navList">
          {[
            [timeline, "beginning", "Start"],
            [letters, "letters", normal ? "Moments" : "Letters"],
            [reasons, "reasons", "Reasons"],
            [jokes, "inside", "Jokes"],
            [gallery, "photos", "Photos"],
          ]
            .filter(([items]) => (items as GiftItem[]).length)
            .map(([, id, label]) => (
              <li key={id as string}>
                <a href={`#${id}`}>{label as string}</a>
              </li>
            ))}
        </ul>
        <a className="nav__top" href="#top" aria-label="Back to top">
          ↑
        </a>
      </nav>
      <header id="top" className="hero">
        <div className="hero__inner">
          <p className="eyebrow">
            {gift.from} &amp; {gift.to} · {gift.date}
          </p>
          <h1 className="hero__title">{section.title}</h1>
          <p className="hero__sign">{gift.signature || gift.subtitle}</p>
          <p className="hero__gloss">{section.subtitle || gift.dedication}</p>
          {gift.fromPortraitId || gift.toPortraitId ? (
            <div className="hero__faces">
              {[
                {
                  id: gift.fromPortraitId,
                  name: gift.from,
                  place: gift.fromLocation,
                },
                {
                  id: gift.toPortraitId,
                  name: gift.to,
                  place: gift.toLocation,
                },
              ].map((p,index) => (
                <figure key={index}>
                  {p.id ? (
                    <img src={`/api/media/${p.id}?preview=1`} alt={p.name} />
                  ) : null}
                  <figcaption>{p.place || p.name}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <div className="stats">
            {archiveStatistics(gift,section).map(({value,label},index) => (
              <div key={index}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="hero__scroll">scroll</p>
        </div>
      </header>
      <main>
        {timeline.length ? (
          <section id="beginning" className="sec">
            {title(labels.timeline, "Chapter one")}
            <ol className="timeline">
              {timeline.map((i) => (
                <li className="tl rise seen" key={i.id}>
                  <p className="tl__when">{i.date}</p>
                  <p className="tl__where">{i.location}</p>
                  <h3>{i.title}</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>{i.body}</p>
                  {i.quote ? (
                    <blockquote>
                      “{i.quote}”<cite>{i.author || gift.from}</cite>
                    </blockquote>
                  ) : null}
                  {i.mediaId ? (
                    <button
                      aria-label={`Open ${i.title}`}
                      onClick={() => open(i)}
                    >
                      <ItemMedia item={i} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {letters.length ? (
          <section id="letters" className="sec sec--wide">
            {title(labels.letters, "The archive")}
            <p
              className="lede"
              style={{ textAlign: "center", margin: "0 auto 40px" }}
            >
              {normal ? `${letters.length} shared moments. Dates, little rituals and memories worth keeping.` : `${letters.length} personal letters. Every word, yours.`}
            </p>
            <div className="letters">
              {letters.map((l, i) => (
                <button
                  key={l.id}
                  className={`lt rise seen ${!l.author || l.author === gift.from ? "lt--from" : "lt--to"}`}
                  onClick={() => open(l)}
                >
                  <p className="lt__no">{String(i + 1).padStart(2, "0")}</p>
                  <p className="lt__who">
                    <i />
                    {l.author || gift.from}
                  </p>
                  <h3>{l.title}</h3>
                  <p className="lt__note">{l.subtitle || l.date}</p>
                  <div className="lt__foot">
                    <span>
                      {normal ? l.date || "Together" : `${l.body.trim().split(/\s+/).filter(Boolean).length} words`}
                    </span>
                    <span className="lt__open">{normal ? "Revisit" : "Read"}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {reasons.length ? (
          <section id="reasons" className="sec">
            {title(labels.reasons, "Only you")}
            <div className="spotlight">
              <blockquote>{reasons[reason % reasons.length].body}</blockquote>
              <div className="spotlight__no">
                <span>{(reason % reasons.length) + 1}</span>
                <i>/{reasons.length}</i>
              </div>
              <button className="btn" onClick={() => setReason((v) => v + 1)}>
                Another reason
              </button>
            </div>
            <div className="reasons">
              {reasons
                .slice(0, allReasons ? reasons.length : 12)
                .map((i, n) => (
                  <div
                    className={`rs rise seen ${n === reasons.length - 1 ? "rs--finale" : ""}`}
                    key={i.id}
                  >
                    <b>{String(n + 1).padStart(3, "0")}</b>
                    <p>{i.body}</p>
                  </div>
                ))}
            </div>
            {reasons.length > 12 && !allReasons ? (
              <div className="sec__more">
                <button
                  className="btn btn--ghost"
                  onClick={() => setAllReasons(true)}
                >
                  Show all {reasons.length}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
        {jokes.length ? (
          <section id="inside" className="sec sec--wide">
            {title(labels.jokes, "Only ours")}
            <div className="jokes">
              {jokes.map((i) => (
                <button
                  className="lt rise seen"
                  key={i.id}
                  onClick={() => open(i)}
                >
                  <h3>{i.title}</h3>
                  <p className="lt__note">{i.subtitle || i.body}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {gallery.length ? (
          <section id="photos" className="sec sec--wide">
            {title(labels.gallery, "A little closer")}
            <div className="memory-gallery">
              {gallery.map((i) => (
                <button key={i.id} onClick={() => open(i)}>
                  <ItemMedia item={i} demo={demo} />
                  <p>{i.title}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {!visible.length ? (
          <section className="sec section-empty">
            Add your first memory in the editor.
          </section>
        ) : null}
      </main>
      <footer className="foot">
        <p className="foot__sign">{gift.signature || gift.finale}</p>
        <p className="foot__note">
          {gift.from} &amp; {gift.to} · {gift.date}
        </p>
        {revealEnabled ? <div className="foot__actions">
          <button
            className="btn btn--maxima"
            onClick={() => {
              setLit(100);
              setRevealing(false);
            }}
          >
            Light up everything
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setGate(true);
              setLit(0);
            }}
          >
            Start again
          </button>
        </div> : null}
      </footer>
      {revealEnabled && gate ? (
        <section
          className="archive-gate"
          role="dialog"
          aria-label="Before you look"
        >
          <div>
            <p className="eyebrow">For {gift.to}</p>
            <h1>{section.gateTitle || "Before you look"}</h1>
            <p>
              {section.introduction ||
                "I wanted to put all our favourite things in one place. There are many surprises waiting for you here."}
            </p>
            <p className="hero__sign">— {gift.from}</p>
            <button
              className="btn btn--pink"
              onClick={() => {
                setGate(false);
                setRevealing(true);
              }}
            >
              {" "}
              {section.gateButton || "Reveal our story"}{" "}
            </button>
            <p style={{ fontSize: 12, marginTop: 24 }}>
              Move your cursor or finger to reveal the page. What you light
              stays lit.
            </p>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setGate(false);
                setLit(100);
              }}
            >
              Open without the reveal effect
            </button>
          </div>
        </section>
      ) : null}
      {revealEnabled && revealing && lit < 100 ? (
        <>
          <OriginalVeil win={win}/>
          <div className="reveal-hint">
            <button
              onClick={() => {
                setLit(100);
                setRevealing(false);
              }}
            >
              Reveal everything
            </button>
          </div>
        </>
      ) : null}
      {reader ? (
        <div
          className="reader"
          role="dialog"
          aria-modal="true"
          aria-label={reader.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setReader(null);
          }}
        >
          <button
            ref={close}
            className="reader__close"
            aria-label={normal ? "Close memory" : "Close letter"}
            onClick={() => setReader(null)}
          >
            ×
          </button>
          {letters.includes(reader) ? (
            <>
              <button
                className="reader__nav reader__nav--prev"
                aria-label={normal ? "Previous memory" : "Previous letter"}
                disabled={letters.indexOf(reader) === 0}
                onClick={() => setReader(letters[letters.indexOf(reader) - 1])}
              >
                ‹
              </button>
              <button
                className="reader__nav reader__nav--next"
                aria-label={normal ? "Next memory" : "Next letter"}
                disabled={letters.indexOf(reader) === letters.length - 1}
                onClick={() => setReader(letters[letters.indexOf(reader) + 1])}
              >
                ›
              </button>
            </>
          ) : null}
          <article className="paper" tabIndex={0}>
            <header className="paper__head">
              <span className="paper__no">{reader.date}</span>
              <span className="paper__who">
                {reader.author || gift.from} → {gift.to}
              </span>
              <h2 className="paper__title">{reader.title}</h2>
              <p className="paper__note">{reader.subtitle}</p>
            </header>
            <div className="paper__body">
              {reader.body.split(/\n\n/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
              {reader.mediaId ? <ItemMedia item={reader} muted={false} /> : null}
              {reader.extraMediaIds?.map((id,index) => (
                <img
                  key={`${id}-${index}`}
                  src={`/api/media/${id}?preview=1`}
                  alt={reader.title}
                  loading="lazy"
                />
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}

