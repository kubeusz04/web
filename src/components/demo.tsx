"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Experience from "./experience";
import { Header, Footer } from "./ui";
import { demoGift, type GiftSection } from "@/lib/schema";
const demos = {
  film: demoGift("film"),
  archive: demoGift("archive"),
  cosmos: demoGift("cosmos"),
  surprise: demoGift("surprise"),
};
// Stable public demo IDs keep server and client markup identical, including clue labels.
Object.values(demos).forEach((gift, index) => {
  gift.sections[0].id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  gift.sections[0].items.forEach((item, i) => {
    item.id = `00000000-0000-4000-8000-${String((index + 1) * 100 + i).padStart(12, "0")}`;
  });
});
export default function Demo({
  initial = "film",
}: {
  initial?: GiftSection["type"];
}) {
  const [type, setType] = useState(initial);
  return (
    <>
      <Header />
      <main className="demo-page page-container">
        <div className="page-heading">
          <div>
            <p className="step-label">TAKE A LITTLE LOOK</p>
            <h1>A feeling, in a link.</h1>
            <p className="muted">
              Fictional stories. Real possibilities. Make your own version in
              the editor.
            </p>
            <Link href="/demo/original" className="text-link">Open the complete original gift →</Link>
          </div>
          <Link href="/auth" className="button">
            Make it yours
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <nav className="demo-tabs" aria-label="Demo experiences">
          {(["film", "archive", "cosmos", "surprise"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={t === type ? "active" : ""}
            >
              {
                {
                  film: "Our story",
                  archive: "Letters to you",
                  cosmos: "You are my universe",
                  surprise: "One more thing",
                }[t]
              }
            </button>
          ))}
        </nav>
        <Experience key={type} gift={demos[type]} demo />
        <p className="demo-note">
          Demo stories and names are fictional. The coast image was generated
          with AI. No private material from the original gift is used. Surprise
          answer: “tea”.
        </p>
      </main>
      <Footer />
    </>
  );
}
