// Add locales here, add translated messages, then extend the versioned content schema.
export const locales = {
  en: {
    label: "English",
    htmlLang: "en",
    intl: "en-GB",
    messages: {
      experiences: "Experiences",
      how: "How it works",
      packages: "Packages",
      demo: "Explore the demo",
      create: "Create a gift",
      gifts: "My gifts",
      admin: "Administration",
    },
  },
} as const;
export const currencies = {
  pln: { code: "pln", minorUnits: 2, label: "PLN" },
} as const;
export type Locale = keyof typeof locales;
export function messages(locale: Locale = "en") {
  return locales[locale].messages;
}
