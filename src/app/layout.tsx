import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "WebsiteGift — A little more than a gift",
    template: "%s · WebsiteGift",
  },
  description:
    "Turn your memories into a personal, interactive gift. Create, preview, and share your story with one link.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
