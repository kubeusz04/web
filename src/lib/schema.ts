import { z } from "zod";
const text = (max = 500) => z.string().max(max);
export const sceneTypes = [
  "title",
  "lines",
  "letter",
  "map",
  "clocks",
  "chat",
  "count",
  "ticker",
  "solo",
  "duo",
  "split",
  "grid",
  "scatter",
  "mosaic",
  "strip",
  "stack",
  "video",
  "booth",
  "goodbye",
  "vows",
] as const;
const detailSchema = z.object({ label: text(160), value: text(12000) });
export const itemSchema = z.object({
  id: z.string().uuid(),
  title: text(160),
  body: text(12000),
  date: text(40).default(""),
  mediaId: z.string().uuid().nullable().default(null),
  mediaKind: z.enum(["image", "video", "audio"]).default("image"),
  duration: z.number().int().min(3).max(60).default(7),
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
  category: text(60).default("Memory"),
  kind: z.enum(["star", "planet"]).default("star"),
  answer: text(120).default(""),
  hidden: z.boolean().default(false),
  sceneType: z.enum(sceneTypes).optional(),
  chapter: text(160).optional(),
  subtitle: text(2000).optional(),
  author: text(80).optional(),
  location: text(160).optional(),
  quote: text(4000).optional(),
  extraMediaIds: z.array(z.uuid()).max(100).optional(),
  details: z.array(detailSchema).max(100).optional(),
  counter: z.number().min(0).max(1000000000).optional(),
  emphasis:text(160).optional(),
  mapFrom: z
    .tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])
    .optional(),
  mapTo: z
    .tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])
    .optional(),
  planetColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  planetRadius: z.number().min(0.2).max(3).optional(),
});
export const sectionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["film", "archive", "cosmos", "surprise"]),
  title: text(120),
  enabled: z.boolean(),
  items: z.array(itemSchema).max(100),
  introduction: text(4000).optional(),
  subtitle: text(500).optional(),
  gateTitle: text(160).optional(),
  gateButton: text(80).optional(),
  voiceEnabled:z.boolean().optional(),
  revealEnabled:z.boolean().optional(),
  statistics:z.array(z.object({label:text(300),value:text(160)})).max(12).optional(),
  headingLabels: z
    .object({
      timeline: text(160),
      letters: text(160),
      reasons: text(160),
      jokes: text(160),
      gallery: text(160),
    })
    .optional(),
});
export const giftSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: text(120).min(1),
    from: text(80),
    to: text(80),
    occasion: z.enum(["rocznica", "urodziny", "walentynki", "inna"]),
    date: text(40),
    locale: z.literal("en"),
    dedication: text(2000),
    finale: text(2000),
  finaleWords:z.array(text(300)).max(4).optional(),
    theme: z.enum(["clay", "rose", "forest"]),
    font: z.enum(["editorial", "modern"]),
    subtitle: text(500).optional(),
    fromLocation: text(160).optional(),
    toLocation: text(160).optional(),
    firstMetDate: text(40).optional(),
    firstLetterDate:text(40).optional(),
    visitStartDate:text(40).optional(),
    visitEndDate:text(40).optional(),
    signature: text(500).optional(),
    musicId: z.uuid().nullable().optional(),
    fromPortraitId: z.uuid().nullable().optional(),
    toPortraitId: z.uuid().nullable().optional(),
    sections: z.array(sectionSchema).min(1).max(12),
  })
  .superRefine((gift, ctx) => {
    const ids = new Set<string>();
    gift.sections.forEach((section, s) => {
      if (ids.has(section.id))
        ctx.addIssue({
          code: "custom",
          path: ["sections", s, "id"],
          message: "Content identifiers must be unique.",
        });
      ids.add(section.id);
      section.items.forEach((item, i) => {
        if (ids.has(item.id))
          ctx.addIssue({
            code: "custom",
            path: ["sections", s, "items", i, "id"],
            message: "Content identifiers must be unique.",
          });
        ids.add(item.id);
      });
    });
  });
export type Gift = z.infer<typeof giftSchema>;
export type GiftItem = z.infer<typeof itemSchema>;
export type GiftSection = z.infer<typeof sectionSchema>;
export function migrateGift(value: unknown): Gift {
  return giftSchema.parse(value);
}
export function mediaIds(gift: Gift) {
  return [
    ...new Set([
      ...[gift.musicId, gift.fromPortraitId, gift.toPortraitId].filter(
        (id): id is string => !!id,
      ),
      ...gift.sections.flatMap((s) =>
        s.items.flatMap((i) => [
          ...(i.mediaId ? [i.mediaId] : []),
          ...(i.extraMediaIds || []),
        ]),
      ),
    ]),
  ];
}
export function blankItem(): GiftItem {
  return {
    id: crypto.randomUUID(),
    title: "A new moment",
    body: "Tell the story you want to keep.",
    date: "",
    mediaId: null,
    mediaKind: "image",
    duration: 7,
    x: 50,
    y: 50,
    category: "Memory",
    kind: "star",
    answer: "",
    hidden: false,
  };
}
export function demoGift(type: GiftSection["type"] = "film"): Gift {
  const stories = [
    [
      "The world slowed down",
      "Nothing extraordinary happened that day. We just kept talking until the tea went cold.",
      "2025-06-14",
    ],
    [
      "Little, extraordinary things",
      "Walks with no destination. Sunday breakfasts. Places we want to find again.",
      "2025-09-08",
    ],
    [
      "Only the beginning",
      "Our favourite memories are still ahead of us. Thank you for making them with me.",
      "2026-06-14",
    ],
  ];
  return {
    schemaVersion: 1,
    title: "Our story",
    from: "Alex",
    to: "Sam",
    occasion: "rocznica",
    date: "2025-06-14",
    locale: "en",
    dedication: "For you. For all our little, extraordinary moments.",
    finale: "So much still ahead of us.",
    theme: "clay",
    font: "editorial",
    sections: [
      {
        id: crypto.randomUUID(),
        type,
        title: {
          film: "Memory film",
          archive: "Our archive",
          cosmos: "Our universe",
          surprise: "A little surprise",
        }[type],
        enabled: true,
        items: stories.map(([title, body, date], i) => ({
          ...blankItem(),
          title,
          body,
          date,
          kind: i === 1 ? "planet" : "star",
          answer: type === "surprise" ? "tea" : "",
          ...(type==='film'?{sceneType:(['title','letter','split'] as const)[i],chapter:`Chapter ${i+1}`,subtitle:i===0?'A story that belongs to us.':''}:{}),
          ...(type==='archive'?{category:['Memory','Letter','Reason'][i],author:i===1?'Sam':'Alex'}:{}),
        })),
      },
    ],
  };
}
