"use client";
import { useEffect, useRef } from "react";
import {applyAppearance} from "@/lib/appearance";
import type { Gift, GiftSection } from "@/lib/schema";
export default function OriginalSky({
  gift,
  section,
}: {
  gift: Gift;
  section: GiftSection;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const send = () => {
      const doc=iframe.current?.contentDocument;
      if(doc)applyAppearance(doc,gift,section);
      iframe.current?.contentWindow?.postMessage(
        { type: "gift-sky", gift, section },
        location.origin,
      );
    };
    const ready = (event: MessageEvent) => {
      if (
        event.source === iframe.current?.contentWindow &&
        event.origin === location.origin &&
        event.data?.type === "gift-sky-ready"
      )
        send();
    };
    const host=iframe.current?.ownerDocument.defaultView||window;
    host.addEventListener("message", ready);
    send();
    return () => host.removeEventListener("message", ready);
  }, [gift, section]);
  return (
    <iframe
      ref={iframe}
      src="/original/sky.html"
      title="Your original 3D universe"
      style={{ height: "100vh", width: "100%", border: 0, display: "block" }}
      allow="fullscreen"
    />
  );
}
