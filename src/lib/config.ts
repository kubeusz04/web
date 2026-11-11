import { locales } from "./i18n";
export const brand = {
  name: "WebsiteGift",
  displayName: "WebsiteGift",
  currency: "pln",
  locale: locales.en.intl,
  languages: ["en"],
  currencies: ["pln"],
} as const;
export const retention = {
  expiredDays: 30,
  unpaidDraftDays: 90,
  backupDays: 30,
};
export const initialCatalog = {
  headline: "Some moments deserve more than a photograph.",
  intro:
    "Turn your memories into a personal, interactive gift. Make it yours and give it with one link.",
  faq: [
    {
      q: "Does the recipient need an account?",
      a: "No. Gifts open in a browser. You can add a password for extra protection.",
    },
    {
      q: "Can I edit my gift after buying it?",
      a: "Yes. Edit your draft and publish again. The recipient link stays the same.",
    },
    {
      q: "Who can see my photos?",
      a: "You and anyone with the published gift link. Unlisted links can be forwarded. A password adds protection.",
    },
    {
      q: "How long will my gift be available?",
      a: "Hosting starts at confirmed payment. The package comparison and your order show the exact hosting period. Hosting is not indefinite.",
    },
  ],
  templates: [
    {
      id: "film",
      name: "Our story",
      description:
        "Cinematic frames. Real feelings. Your memories take the lead.",
      enabled: true,
    },
    {
      id: "archive",
      name: "Letters to you",
      description:
        "A personal archive of letters, photos and little reasons to smile.",
      enabled: true,
    },
    {
      id: "cosmos",
      name: "You are my universe",
      description: "Discover stars and planets made from your shared moments.",
      enabled: true,
    },
    {
      id: "surprise",
      name: "One more thing",
      description: "A hidden message. A little clue. A surprise just for you.",
      enabled: true,
    },
  ],
  plans: [
    {
      id: "essential",
      name: "A close moment",
      price: 4900,
      maxItems: 20,
      maxFiles: 20,
      maxBytes: 100 * 1024 * 1024,
      days: 365,
    },
    {
      id: "collection",
      name: "The whole story",
      price: 8900,
      maxItems: 100,
      maxFiles: 80,
      maxBytes: 500 * 1024 * 1024,
      days: 365,
    },
  ],
};
export type Catalog = typeof initialCatalog;
export function price(value: number) {
  return new Intl.NumberFormat(brand.locale, {
    style: "currency",
    currency: brand.currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}
export const localMode = () => process.env.APP_MODE === "local";
export const appUrl = () => process.env.APP_URL || "http://127.0.0.1:3000";
