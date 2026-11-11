"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Gift, GiftSection, GiftItem } from "@/lib/schema";
import OriginalFinale from './original-finale';
type Context = {
  dur: number;
  raf: (fn: (time: number) => boolean | void) => void;
  onEnter: (fn: () => void) => void;
  onExit: (fn: () => void) => void;
};
type EngineWindow = Window & {
  SHOTS: Record<
    string,
    (root: HTMLElement, data: Record<string, unknown>, ctx: Context) => void
  >;
  P: {
    all: unknown[];
    count: number;
    get: (index: number) => unknown;
    src: (index: number, size?: string) => string;
  };
};
const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
export function sceneData(item: GiftItem, gift: Gift, indices: number[]) {
  const body = item.body.split("\n").filter(Boolean),
    details = item.details || [];
  const safeLines = body.map(escape);
  const data: Record<string, unknown> = {
    title: escape(item.title),
    roman: escape(item.chapter || `${gift.from} & ${gift.to}`),
    sub: escape(item.subtitle || item.body),
    date: escape(item.date),
    lines: safeLines,
    body: safeLines,
    to: escape(item.author || gift.to),
    stamp: escape(
      item.location ||
        `${gift.fromLocation || gift.from}\n→\n${gift.toLocation || gift.to}`,
    ),
    cap: escape(item.subtitle || item.title),
    caption: escape(item.subtitle || item.body),
    name: escape(gift.from),
    when: escape(item.date),
    vows: safeLines,
    idx: indices[0] ?? 0,
    photos: indices,
    channel: escape(item.title),
    initialFrom: escape(Array.from(gift.from)[0] || ""),
    initialTo: escape(Array.from(gift.to)[0] || ""),
    messages: details.length
      ? details.map((d, i) => [
          i % 2 ? "you" : "me",
          escape(d.value),
          escape(d.label),
        ])
      : body.map((line, i) => [i % 2 ? "you" : "me", escape(line), ""]),
    clocks: details.map((d) => ({
      city: escape(d.label),
      time: escape(d.value),
      h: Number(d.value.split(":")[0] || 0) * 30,
      m: Number(d.value.split(":")[1] || 0) * 6,
    })),
    toPoint: item.mapTo || [48.8566, 2.3522],
    from: item.mapFrom || [51.5074, -0.1278],
    leftLabel: escape(gift.fromLocation || gift.from),
    rightLabel: escape(gift.toLocation || gift.to),
    plane: true,
    stats: details.map((d) => [escape(d.value), escape(d.label)]),
    over: escape(item.title),
    under: escape(item.body),
    rows: details.map((d) => [escape(d.value), Number(d.label) || 700]),
    delay: 300,
    gap: 1500,
    capAt: 700,
    capCenter: true,
  };
  if(item.emphasis&&item.title.includes(item.emphasis))data.title=escape(item.title).replace(escape(item.emphasis),`<em>${escape(item.emphasis)}</em>`);
  if (item.sceneType === "count") data.to = item.counter ?? 0;
  if (item.sceneType === "duo") data.idx = indices;
  if (!details.length && item.sceneType === "clocks")
    data.clocks = [
      {
        city: escape(gift.fromLocation || gift.from),
        time: "12:00",
        h: 0,
        m: 0,
      },
      { city: escape(gift.toLocation || gift.to), time: "12:00", h: 0, m: 0 },
    ];
  if (!details.length && item.sceneType === "ticker")
    data.rows = body.map((line) => [escape(line), 900]);
  if (item.mediaId && item.mediaKind === "video") {
    data.src = `/api/media/${item.mediaId}`;
    data.sound = false;
    data.loop = true;
  }
  return data;
}
export default function OriginalFilm({
  gift,
  section,
  demo = false,
  win,
}: {
  gift: Gift;
  section: GiftSection;
  demo?: boolean;
  win: Window;
}) {
  const items = section.items.filter((item) => !item.hidden),
    [opened, setOpened] = useState(false),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [progress, setProgress] = useState(0),
    [ended, setEnded] = useState(false),
    [finaleComplete,setFinaleComplete]=useState(false),
    [gallery, setGallery] = useState(false),
    [photo, setPhoto] = useState<string | null>(null),
    [muted, setMuted] = useState(true);
  const stage = useRef<HTMLElement>(null),
    dimensions = useRef(new Map<string,{ratio:number;w:number;h:number;rgb:number[]}>()),
    clock = useRef(0),
    exit = useRef<(() => void)[]>([]);
  const item = items[Math.min(index, Math.max(0, items.length - 1))];
  const pictureItems = items.flatMap((i) => [
    ...(i.mediaId && i.mediaKind === "image"
      ? [{ id: i.mediaId, item: i }]
      : []),
    ...(i.extraMediaIds || []).map((id) => ({ id, item: i })),
  ]).filter((picture,index,list)=>list.findIndex(other=>other.id===picture.id)===index);
  const go = (next: number) => {
    exit.current.forEach((fn) => fn());
    clock.current = 0;
    setProgress(0);
    setEnded(false);
    setFinaleComplete(false);
    setIndex(Math.max(0, Math.min(items.length - 1, next)));
  };
  useEffect(() => {
    const doc = win.document;
    doc.body.classList.toggle("paused", paused);
    return () => doc.body.classList.remove("paused");
  }, [paused, win]);
  useEffect(() => {
    if (!opened || !item || ended || !stage.current) return;
    const engine = win as EngineWindow;
    if (!engine.SHOTS) return;
    const root = stage.current;
    root.replaceChildren();
    exit.current = [];
    clock.current = 0;
    setProgress(0);
    const node = win.document.createElement("div");
    node.className = "shot";
    root.appendChild(node);
    const list = pictureItems.length ? pictureItems : [{ id: "demo", item }];
    engine.P.all = list;
    engine.P.count = list.length;
    engine.P.get = (i) => dimensions.current.get(list[i]?.id) || ({ ratio: 1.5, w: 1500, h: 1000, rgb: [40, 35, 45] });
    engine.P.src = (i, size) =>
      list[i]?.id === "demo"
        ? demo
          ? "/demo-coast.webp"
          : ""
        : list[i]
          ? `/api/media/${list[i].id}${size==='thumb'?'?preview=1':''}`
          : "";
    const ids = [item.mediaId, ...(item.extraMediaIds || [])].filter(Boolean);
    const indices = ids
      .map((id) => list.findIndex((p) => p.id === id))
      .filter((i) => i >= 0);
    if (!indices.length && demo) indices.push(0);
    let type =
      item.sceneType ||
      (item.mediaKind === "video" && item.mediaId
        ? "video"
        : item.mediaId || demo
          ? "solo"
          : "title");
    if (gift.relationshipMode === "normal" && type === "letter") type = indices.length ? "split" : "lines";
    if (
      [
        "solo",
        "duo",
        "split",
        "grid",
        "scatter",
        "mosaic",
        "strip",
        "stack",
        "booth",
      ].includes(type) &&
      !indices.length
    )
      type = "title";
    const tasks: ((now: number) => boolean | void)[] = [],
      enters: (() => void)[] = [];
    const context: Context = {
      dur: item.duration * 1000,
      raf: (fn) => tasks.push(fn),
      onEnter: (fn) => enters.push(fn),
      onExit: (fn) => exit.current.push(fn),
    };
    try {
      const data=sceneData(item, gift, indices);
      data.sound=!muted;
      engine.SHOTS[type](node, data, context);
    } catch {
      const h = win.document.createElement("h2");
      h.className = "headline";
      h.textContent = item.title;
      node.replaceChildren(h);
    }
    node.style.setProperty("--crop-x", `${item.x}%`);
    node.style.setProperty("--crop-y", `${item.y}%`);
    node.querySelectorAll('video').forEach(video=>{video.autoplay=false;});
    node.querySelectorAll('img').forEach(image=>{
      image.alt=item.title;image.style.objectPosition=`${item.x}% ${item.y}%`;
      const size=()=>{if(!image.naturalWidth||!image.naturalHeight)return;const ratio=image.naturalWidth/image.naturalHeight;const picture=list.find(p=>image.src.includes(p.id));if(picture)dimensions.current.set(picture.id,{ratio,w:image.naturalWidth,h:image.naturalHeight,rgb:[40,35,45]});if(image.style.aspectRatio)image.style.aspectRatio=String(ratio);image.closest<HTMLElement>('.ph')?.style.setProperty('--ar',String(ratio));};
      if(image.complete)size();else image.addEventListener('load',size,{once:true});
      if(item.x!==50||item.y!==50){image.style.objectFit='cover';image.style.width='100%';image.style.height='100%';}
    });
    if(item.mediaId&&item.mediaKind==='audio'){const audio=win.document.createElement('audio');audio.src=`/api/media/${item.mediaId}`;audio.controls=true;audio.preload='metadata';audio.className='scene-audio';audio.setAttribute('aria-label',item.title);node.append(audio);exit.current.push(()=>{audio.pause();audio.removeAttribute('src');audio.load();});}
    let frame = 0,previous=performance.now(),elapsed=0;
    const animate = (now: number) => {
      if (!win.document.body.classList.contains("paused")) {
        elapsed+=now-previous;
        for (let i = tasks.length - 1; i >= 0; i--)
          if (tasks[i](elapsed) === false) tasks.splice(i, 1);
      }
      previous=now;
      frame = win.requestAnimationFrame(animate);
    };
    frame = win.requestAnimationFrame(animate);
    const enterFrame=win.requestAnimationFrame(() => {
      node.classList.add("in");
      enters.forEach((fn) => fn());
      node.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media=>{media.muted=muted;if(paused)media.pause();});
    });
    return () => {
      win.cancelAnimationFrame(frame);
      win.cancelAnimationFrame(enterFrame);
      exit.current.forEach((fn) => fn());
      root.replaceChildren();
    };
  }, [opened, index, item, gift, demo, ended, win]);
  useEffect(() => {
    if (!opened || paused || ended || !item) return;
    let previous = performance.now();
    const timer = win.setInterval(() => {
      const now = performance.now();
      clock.current += (now - previous) / 1000;
      previous = now;
      setProgress(Math.min(1, clock.current / item.duration));
      if (clock.current >= item.duration) {
        clock.current = 0;
        if (index < items.length - 1) setIndex((v) => v + 1);
        else setEnded(true);
      }
    }, 80);
    return () => win.clearInterval(timer);
  }, [opened, paused, ended, item, index, items.length, win]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName))
        return;
      if (event.key === "Escape") {
        setPhoto(null);
        setGallery(false);
      }
      if (event.key === "Enter" && !opened) setOpened(true);
      if (event.code === "Space") {
        event.preventDefault();
        if (!opened) setOpened(true);
        else setPaused((v) => !v);
      }
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key.toLowerCase() === "m") setMuted((v) => !v);
    };
    win.addEventListener("keydown", key);
    return () => win.removeEventListener("keydown", key);
  }, [index, opened, win, items.length]);
  useEffect(() => {
    stage.current?.querySelectorAll("video,audio").forEach((el) => {
      const media = el as HTMLMediaElement;
      media.muted = muted;
      if (paused) media.pause();
      else void media.play().catch(() => {media.controls=true;});
    });
  }, [muted, paused, index]);
  if (!items.length)
    return (
      <div className="original-frame-status">
        Add a scene to begin your film.
      </div>
    );
  return (
    <div className="film-content">
      <div id="backdrop">
        <div
          className="backdrop__wash"
          style={{
            background:
              "radial-gradient(48% 42% at 22% 18%, rgba(194,64,92,.15), transparent 66%),radial-gradient(46% 46% at 82% 76%, rgba(70,70,140,.22), transparent 66%)",
          }}
        />
      </div>
      <main
        id="stage"
        ref={stage}
        aria-live="polite"
        onClick={(event) => {
          if((event.target as HTMLElement).closest('audio,video,button,a,input,select'))return;
          if (opened && !ended)
            index < items.length - 1 ? go(index + 1) : setEnded(true);
        }}
      />
      {!opened ? (
        <section id="gate">
          <div className="gate__inner">
            <h1 className="gate__name">{section.gateTitle || gift.title}</h1>
            <button
              className="seal"
              onClick={() => setOpened(true)}
              aria-label={gift.relationshipMode === "normal" ? "Begin our story" : "Open the letter and begin"}
            >
              <span className="seal__ring" />
              <span className="seal__wax">
                {Array.from(gift.from)[0]}
                <i>&amp;</i>
                {Array.from(gift.to)[0]}
              </span>
            </button>
            <p className="gate__hint">
              {section.introduction ||
                "press to open · click to skip a scene · best with sound and full screen"}
            </p>
          </div>
        </section>
      ) : null}
      <div id="vignette" aria-hidden="true" />
      <div id="grain" aria-hidden="true" />
      <div id="letterbox" aria-hidden="true">
        <i />
        <i />
      </div>
      {opened && !ended ? (
        <>
          <div id="hud">
            <div className="hud__top">
              <span className="hud__chapter">{item.chapter || item.title}</span>
            </div>
            <div className="hud__bar">
              <i
                style={{
                  transform: `scaleX(${(index + progress) / items.length})`,
                  width: `${((index + progress) / items.length) * 100}%`,
                }}
              />
            </div>
            <div className="hud__controls">
              <button
                className="ctl"
                aria-label={muted ? "Enable sound" : "Mute"}
                onClick={() => setMuted(!muted)}
              >
                {muted ? "♫" : "♪"}
              </button>
              <button
                className="ctl"
                aria-label={paused ? "Play" : "Pause"}
                onClick={() => setPaused(!paused)}
              >
                {paused ? "▶" : "Ⅱ"}
              </button>
              <button
                className="ctl"
                aria-label="Previous scene"
                disabled={!index}
                onClick={() => go(index - 1)}
              >
                ‹
              </button>
              <button
                className="ctl"
                aria-label="Next scene"
                onClick={() =>
                  index < items.length - 1 ? go(index + 1) : setEnded(true)
                }
              >
                ›
              </button>
              <button
                className="ctl"
                aria-label="Fullscreen"
                onClick={() =>
                  void win.document.documentElement
                    .requestFullscreen?.()
                    .catch(() => {})
                }
              >
                ⛶
              </button>
            </div>
          </div>
          <select
            className="scene-selector"
            aria-label="Jump to scene"
            value={index}
            onChange={(e) => go(Number(e.target.value))}
          >
            {items.map((i, n) => (
              <option key={i.id} value={n}>
                {n + 1}. {i.title}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {ended&&!finaleComplete&&(pictureItems.length||demo)?<OriginalFinale gift={gift} win={win} onDone={()=>setFinaleComplete(true)}/>:null}
      {ended&&(finaleComplete||(!pictureItems.length&&!demo)) ? (
        <div className="shot s-end in">
          <div className="wrap">
            <h2 className="end-title">{gift.title}</h2>
            <p className="end-message">{gift.finale}</p>
            <p className="datestamp">
              {gift.from} &amp; {gift.to} · {gift.date}
            </p>
            <div className="endbtns">
              <button className="pill" onClick={() => go(0)}>
                Replay our story
              </button>
              <button className="pill" onClick={() => setGallery(true)}>
                See all {pictureItems.length} photos
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {gallery ? (
        <section id="gallery">
          <header className="gallery__head">
            <h2>{section.subtitle || "Every single one"}</h2>
            <p>{pictureItems.length} photographs</p>
            <button
              className="gallery__close"
              onClick={() => setGallery(false)}
            >
              Back to the ending
            </button>
          </header>
          <div className="gallery__grid">
            {pictureItems.map((p, i) => (
              <button key={`${p.id}-${i}`} onClick={() => setPhoto(p.id)}>
                <img
                  src={`/api/media/${p.id}?preview=1`}
                  alt={p.item.title}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {photo ? (
        <div className="photo-viewer">
          <button aria-label="Close photo" onClick={() => setPhoto(null)}>
            ×
          </button>
          <img src={`/api/media/${photo}`} alt="Selected memory" />
        </div>
      ) : null}
    </div>
  );
}
