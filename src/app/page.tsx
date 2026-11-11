import Link from "next/link";
import { ArrowRight, ArrowUpRight, Play, Check } from "lucide-react";
import { Header, Footer, LocalNotice } from "@/components/ui";
import TemplateArt from "@/components/template-art";
import { catalog } from "@/lib/service";
import { price } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Home() {
  const c = await catalog();
  return (
    <>
      <LocalNotice />
      <Header />
      <main>
        <section className="hero page-container">
          <div className="hero-copy">
            <h1>{c.headline}</h1>
            <p>{c.intro}</p>
            <div className="hero-actions">
              <Link className="button" href="/auth">
                Create a gift
                <ArrowUpRight size={18} />
              </Link>
              <Link className="button secondary" href="/demo">
                Explore the demo
                <Play size={16} />
              </Link>
            </div>
          </div>
          <Link
            href="/demo"
            className="hero-product"
            aria-label="Explore the Our story demo"
          >
            <div className="hero-product-stars" />
            <div className="hero-print">
              <img
                src="/demo-coast.webp"
                alt="Fictional couple watching the sunset — AI-generated demonstration"
                fetchPriority="high"
              />
              <span className="hero-print-title">Our story</span>
              <span className="hero-play">
                <Play size={28} />
              </span>
            </div>
            <span className="hero-product-note">
              A story only you could give.
            </span>
          </Link>
        </section>
        <section
          className="experiences-section page-container"
          id="doswiadczenia"
        >
          <div className="section-heading">
            <h2>
              One gift.
              <br className="mobile-only" /> So many ways to say it.
            </h2>
            <span>Personal by nature.</span>
          </div>
          <div className="experience-products">
            {c.templates
              .filter((t) => t.enabled)
              .map((t) => (
                <article key={t.id}>
                  <Link href={`/products/${t.id}`}>
                    <TemplateArt type={t.id} />
                    <div className="product-title">
                      <h3>{t.name}</h3>
                      <ArrowUpRight size={22} />
                    </div>
                  </Link>
                  <p>{t.description}</p>
                </article>
              ))}
          </div>
        </section>
        <section className="how-section page-container" id="jak-to-dziala">
          <h2>
            From a memory
            <br />
            to a smile.
          </h2>
          <div className="process-steps">
            {[
              [
                "Choose your experience.",
                "A film, a letter, a whole universe. Start with the experience that feels like them.",
              ],
              [
                "Make it yours.",
                "Add your words, photos and moments. Preview every detail before you buy.",
              ],
              [
                "Give it with one link.",
                "Purchase, publish and send it when the time feels right. No app to download.",
              ],
            ].map(([title, body], i) => (
              <div key={title}>
                <span>0{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="pricing-section" id="pakiety">
          <div className="page-container">
            <div className="section-heading">
              <h2>
                One gift.
                <br />
                Yours to keep shaping.
              </h2>
              <p>
                One payment. No subscription.
                <br />
                Edit and republish during your hosting period.
              </p>
            </div>
            <div className="pricing-table">
              <div className="pricing-labels">
                <div className="pricing-intro">
                  A little room
                  <br />
                  for a lot of feeling.
                </div>
                <span>Memories across all sections</span>
                <span>Media files</span>
                <span>Private storage</span>
                <span>Hosting from payment</span>
                <span>Editing & republishing</span>
                <span>Files up to 25 MB</span>
              </div>
              {c.plans.map((p) => (
                <div className="pricing-column" key={p.id}>
                  <div className="plan-heading">
                    <h3>{p.name}</h3>
                    <strong>{price(p.price)}</strong>
                    <small>One-time purchase</small>
                  </div>
                  <span>{p.maxItems}</span>
                  <span>{p.maxFiles}</span>
                  <span>{Math.round(p.maxBytes / 1048576)} MB</span>
                  <span>{p.days} days</span>
                  <span>
                    <Check size={17} />
                    Included
                  </span>
                  <span>
                    <Check size={17} />
                    Included
                  </span>
                  <Link href="/auth" className="button secondary">
                    Create a gift
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="faq-section page-container">
          <h2>
            A few things
            <br />
            you might be
            <br />
            <em>wondering.</em>
          </h2>
          <div>
            {c.faq.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <span>+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing-section page-container">
          <span>✳</span>
          <h2>
            Give them a place
            <br />
            to feel close to you.
          </h2>
          <Link href="/auth" className="button">
            Start your story
            <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
