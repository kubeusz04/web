"use client";
import {Volume2} from "lucide-react";
import type {GiftItem} from "@/lib/schema";
export function ItemMedia({
  item,
  muted = true,
  demo = false,
}: {
  item: GiftItem;
  muted?: boolean;
  demo?: boolean;
}) {
  if (!item.mediaId)
    return demo ? (
      <img
        src="/demo-coast.webp"
        alt="Fictional couple by the sea at sunset — AI-generated demo image"
        className="scene-photo"
        loading="lazy"
      />
    ) : (
      <div className="empty-photo">
        <span>✦</span>
        <p>Your moment. Your memory.</p>
      </div>
    );
  const src = `/api/media/${item.mediaId}`;
  if (item.mediaKind === "video")
    return (
      <video
        className="scene-photo"
        src={src}
        controls
        muted={muted}
        playsInline
        preload="metadata"
        style={{ objectPosition: `${item.x}% ${item.y}%` }}
      />
    );
  if (item.mediaKind === "audio")
    return (
      <div className="audio-scene">
        <Volume2 size={34} />
        <audio src={src} controls muted={muted} preload="metadata" />
        <p>Your recording</p>
      </div>
    );
  return (
    <img
      className="scene-photo"
      src={`${src}?preview=1`}
      alt={item.title}
      loading="lazy"
      style={{ objectPosition: `${item.x}% ${item.y}%` }}
    />
  );
}
