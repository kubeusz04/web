"use client";
import {applyAppearance} from "@/lib/appearance";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import OriginalSky from "./original-sky";
import type { Gift, GiftSection } from "@/lib/schema";
import OriginalFilm from "./original-film";
import OriginalArchive from "./original-archive";
import { ItemMedia } from "./media-view";
import OriginalVoiceSeal from './original-voice-seal';
import OriginalDuet from './original-duet';
function Surprise({ gift, section }: { gift: Gift; section: GiftSection }) {
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [opened, setOpened] = useState<Record<string, boolean>>({}),
    [takes,setTakes]=useState<Record<string,Blob>>({}),
    [wrong, setWrong] = useState(false);
  const items = section.items.filter((i) => !i.hidden),
    item = items[Math.min(index, items.length - 1)];
  const panel=useRef<HTMLElement>(null), revealed=!!(item&&opened[item.id]);
  useEffect(()=>{panel.current?.ownerDocument.defaultView?.scrollTo(0,0);},[item?.id,revealed]);
  if (!item) return <div className="panel">Add a surprise to begin.</div>;
  return (
    <>
      <div className="wash" />
      <div className="grain" />
      <nav className="secret-selector" style={{ paddingTop: 65 }}>
        {items.map((i, n) => (
          <button
            key={i.id}
            onClick={() => {
              setIndex(n);
              setWrong(false);
              setAnswer("");
            }}
          >
            {n + 1} · {i.title}
          </button>
        ))}
      </nav>
      <section ref={panel} className={`panel${opened[item.id]?' reveal':''}`} style={{ minHeight: "80vh", paddingTop: 25 }}>
        {opened[item.id] ? (
          <>
            <p className="eyebrow">{section.gateButton || "Form accepted"}</p>
            <h1 className="reveal__title">{item.subtitle || "Together"}</h1>
            <p className="lede">
              {gift.from} &amp; {gift.to}
            </p>
            <div className="reward-body">{item.body}</div>
            {(section.voiceEnabled??true)?<OriginalDuet key={item.id} gift={gift} item={item} take={takes[item.id]} onRecordAgain={()=>setOpened(v=>({...v,[item.id]:false}))}/>:null}
            {item.mediaId && (!(section.voiceEnabled??true)||item.mediaKind!=='audio') ? (
              <div className="reward-media">
                <ItemMedia item={item} muted={false} />
              </div>
            ) : null}
            <div className="actions">
              <button
                className="pill"
                onClick={() => setOpened((v) => ({ ...v, [item.id]: false }))}
              >
                Start again
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">
              {section.subtitle || "Secret form"} · {index + 1}
            </p>
            <h1>{item.title}</h1>
            <p className="lede">
              {section.introduction ||
                "This page stays sealed until you discover the words."}
            </p>
            <div className="script">
              {(item.quote || item.subtitle || "A little secret.\nOnly ours.").split('\n').map((line,i,lines)=><p key={i} className={i===lines.length-1?'script__punch':''}>{line}</p>)}
            </div>
            {(section.voiceEnabled??true)?<OriginalVoiceSeal key={item.id} onAccept={blob=>{setTakes(v=>({...v,[item.id]:blob}));setOpened(v=>({...v,[item.id]:true}));}}/>:<>
            <button
              className="seal"
              aria-label="Reveal the message"
              onClick={() => {
                if (!item.answer) setOpened((v) => ({ ...v, [item.id]: true }));
                else setWrong(true);
              }}
            >
              <span className="seal__ring" />
              <span className="seal__wax">{section.gateButton || "open"}</span>
            </button>
            </>}
            <p className="status" role="status">
              {wrong ? "Type the words below to open your surprise." : ""}
            </p>
            <form
              className="type-seal"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !item.answer ||
                  answer.trim().toLowerCase() ===
                    item.answer.trim().toLowerCase()
                ) {
                  setOpened((v) => ({ ...v, [item.id]: true }));
                  setWrong(false);
                } else setWrong(true);
              }}
            >
              {item.answer ? (
                <>
                  <label className="type-seal__label" htmlFor="secret-answer">
                    Your answer to the clue
                  </label>
                  <input
                    id="secret-answer"
                    className="type-seal__input"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    maxLength={120}
                  />
                </>
              ) : null}
              <button className="pill solid">Seal it in →</button>
            </form>
          </>
        )}
      </section>
    </>
  );
}
export default function OriginalExperience({
  gift,
  demo = false,
  compact = false,
}: {
  gift: Gift;
  demo?: boolean;
  compact?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    [doc, setDoc] = useState<Document | null>(null),
    [active, setActive] = useState(""),
    [ready, setReady] = useState(false),
    [music, setMusic] = useState(false);
  const audio = useRef<HTMLAudioElement>(null),
    sections = gift.sections.filter((s) => s.enabled),
    section =
      sections.find((s) => s.id === active) ||
      (sections.length === 1 ? sections[0] : undefined),
    view = section?.type || "home";
  useEffect(() => {
    if (!doc) return;
    doc.body.className = `original-${view === "home" ? "menu" : view}`;
    doc.body.dataset.font=gift.font;
    const link = doc.getElementById("view-style") as HTMLLinkElement;
    link.href = `/original/${view}.css`;
    doc.body.style.overflow = ["archive", "surprise", "home"].includes(view)
      ? "auto"
      : "hidden";
    applyAppearance(doc,gift,section,view === "home");
  }, [doc, view, section,gift.theme,gift.font,gift.appearance]);
  useEffect(()=>{doc?.defaultView?.scrollTo(0,0);},[doc,view,section?.id]);
  useEffect(() => {
    const attach = () => {
      const document = frame.current?.contentDocument;
      if (
        document?.getElementById("gift-root") &&
        (document.defaultView as Window & { SHOTS?: unknown })?.SHOTS
      ) {
        setDoc(document);
        setReady(true);
      }
    };
    attach();
    const timer = setInterval(attach, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (audio.current) {
      if (music) void audio.current.play().catch(() => setMusic(false));
      else audio.current.pause();
    }
  }, [music, gift.musicId,view]);
  return (
    <div className={`original-experience ${compact ? "is-compact" : ""}`}>
      <iframe
        ref={frame}
        src="/original/frame.html"
        title="Personal gift experience"
        className="original-gift-frame"
        allow="fullscreen; microphone"
      />
      {doc && ready
        ? createPortal(
            <div className={`original-shell original-${view === 'home'?'menu':view}`}>
              <div
                className="original-switch"
                role="navigation"
                aria-label="Gift sections"
              >
                {sections.map((s) => (
                  <button
                    key={s.id}
                    aria-current={s.id === section?.id}
                    onClick={() => setActive(s.id)}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
              {sections.length > 1 ? (
                <button
                  className="original-home"
                  onClick={() => setActive("home")}
                >
                  ← {gift.title}
                </button>
              ) : null}
              {section ? (
                section.type === "film" ? (
                  <OriginalFilm
                    key={section.id}
                    gift={gift}
                    section={section}
                    demo={demo}
                    win={doc.defaultView!}
                  />
                ) : section.type === "archive" ? (
                  <OriginalArchive
                    key={`${section.id}-${section.revealEnabled!==false}`}
                    gift={gift}
                    section={section}
                    demo={demo}
                    win={doc.defaultView!}
                  />
                ) : section.type === "cosmos" ? (
                  <OriginalSky
                    key={JSON.stringify({gift, section})}
                    gift={gift}
                    section={section}
                  />
                ) : (
                  <Surprise key={section.id} gift={gift} section={section} />
                )
              ) : (
                <main className="gift-menu">
                  <nav className="topbar" aria-label="Your gift"><span className="brand">{gift.from} &amp; {gift.to}</span></nav>
                  <header className="holiday-hero">
                    <p className="eyebrow">{gift.from} &amp; {gift.to} · {gift.date}</p>
                    <h1>{gift.title.slice(0,gift.title.lastIndexOf(' ')+1)}<em>{gift.title.slice(gift.title.lastIndexOf(' ')+1)}</em></h1>
                    <p className="intro">{gift.dedication}</p>
                  </header>
                  <section className="holiday-list" aria-label="Your gift">
                    {sections.map((s, index) => (
                      <button className="holiday-row" key={s.id} onClick={() => setActive(s.id)}>
                        <span className="holiday-number" aria-hidden="true">{String(index + 1).padStart(2,"0")}</span>
                        <div className="holiday-copy">
                          <h2>{s.title}</h2>
                          <p>{s.subtitle || s.introduction}</p>
                        </div>
                        <span className="arrow" aria-hidden="true">›</span>
                      </button>
                    ))}
                  </section>
                  <p className="signoff">{gift.signature || gift.finale}</p>
                </main>
              )}
              {gift.musicId && view!=='cosmos' ? (
                <>
                  <audio
                    id="music"
                    ref={audio}
                    src={`/api/media/${gift.musicId}`}
                    loop
                    preload="none"
                  />
                  <button
                    className="original-audio"
                    aria-label={music ? "Mute music" : "Play music"}
                    onClick={() => setMusic(!music)}
                  >
                    {music ? "♫" : "♪"}
                  </button>
                </>
              ) : null}
            </div>,
            doc.getElementById("gift-root")!,
          )
        : null}
    </div>
  );
}
