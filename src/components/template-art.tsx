import { Play, Lock, ArrowUpRight } from "lucide-react";
export default function TemplateArt({ type }: { type: string }) {
  if (type === "film")
    return (
      <div className="template-art template-film">
        <img
          src="/demo-coast.webp"
          alt="AI-generated fictional memory by the sea"
          loading="lazy"
        />
        <span className="art-play">
          <Play size={22} />
        </span>
        <span className="art-caption">a moment, forever.</span>
      </div>
    );
  if (type === "archive")
    return (
      <div className="template-art template-archive">
        <div className="mini-letter">
          <span>To my favourite person,</span>
          <p>
            Of all the places
            <br />I have been,
            <br />
            you feel most
            <br />
            like home.
          </p>
          <span>Always, Alex ♡</span>
        </div>
      </div>
    );
  if (type === "cosmos")
    return (
      <div className="template-art template-cosmos">
        <div className="orbit-ring ring-one" />
        <div className="orbit-ring ring-two" />
        <span className="orbit-planet" />
        <span className="orbit-star">✦</span>
        <span className="cosmos-art-caption">our little universe</span>
      </div>
    );
  return (
    <div className="template-art template-surprise">
      <div className="secret-preview">
        <Lock size={22} />
        <span>One more thing…</span>
        <i />
        <ArrowUpRight size={20} />
      </div>
    </div>
  );
}
