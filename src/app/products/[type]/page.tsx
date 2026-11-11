import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";
import { Header, Footer } from "@/components/ui";
import TemplateArt from "@/components/template-art";
import { catalog } from "@/lib/service";
import { price } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Product({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params,
    c = await catalog(),
    template = c.templates.find((t) => t.id === type && t.enabled);
  if (!template) notFound();
  const features: Record<string, string[]> = {
    film: [
      "Write, reorder and time every scene",
      "Add photos, video and audio you have rights to use",
      "Set photo crops, colours and typography",
      "Play, pause and explore with keyboard controls",
    ],
    archive: [
      "Build a timeline of moments",
      "Write letters, reasons and personal messages",
      "Add media and categories to every entry",
      "Open each memory like a personal letter",
    ],
    cosmos: [
      "Create your own stars and planets",
      "Add names, dates, stories and media",
      "Explore an interactive 3D universe",
      "Accessible memory list when WebGL is unavailable",
    ],
    surprise: [
      "Write clues and hidden messages",
      "Choose an answer or reveal with a click",
      "Add photos, video and personal recordings",
      "Create as many surprises as your package allows",
    ],
  };
  return (
    <>
      <Header />
      <main className="page-container product-page">
        <Link href="/#doswiadczenia" className="text-link">
          ← All experiences
        </Link>
        <section className="product-detail">
          <div>
            <h1>
              {template.name}
              <span className="accent">.</span>
            </h1>
            <p className="product-description">{template.description}</p>
            <ul>
              {features[type].map((f) => (
                <li key={f}>
                  <Check size={18} />
                  {f}
                </li>
              ))}
            </ul>
            <p className="product-price">
              From{" "}
              <strong>{price(Math.min(...c.plans.map((p) => p.price)))}</strong>
              <span>One-time purchase · {c.plans[0].days} days of hosting</span>
            </p>
            <div className="hero-actions">
              <Link className="button" href="/auth">
                Create your gift
                <ArrowUpRight size={17} />
              </Link>
              <Link
                className="button secondary"
                href={`/demo?experience=${type}`}
              >
                Explore the demo
              </Link>
            </div>
          </div>
          <TemplateArt type={type} />
        </section>
        <section className="product-terms">
          <h2>Make it yours. Keep it personal.</h2>
          <p>
            Preview before purchase. The recipient opens your gift without an
            account. Your draft stays separate from the published version, and
            republishing keeps the same link. Unlisted links can be forwarded;
            add an optional password for extra protection.
          </p>
          <p>
            Package limits apply across all sections, not per section. Media
            files can be up to 25 MB each. Upload only content you have the
            right to use. Audio starts through a user action; browser autoplay
            restrictions apply.
          </p>
          <Link className="text-link" href="/legal/terms">
            Service terms & withdrawal information
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
