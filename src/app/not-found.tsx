import Link from "next/link";
import { Brand } from "@/components/ui";
export default function NotFound() {
  return (
    <main className="gift-lock">
      <Brand />
      <h1>This moment isn’t here.</h1>
      <p>The page may have moved, or the link may have expired.</p>
      <Link href="/" className="button">
        Back to WebsiteGift
      </Link>
    </main>
  );
}
