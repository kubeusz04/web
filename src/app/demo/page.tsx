import Demo from "@/components/demo";
export const metadata = { title: "Explore the experiences" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ experience?: string }>;
}) {
  const { experience } = await searchParams;
  const initial =
    experience === "archive" ||
    experience === "cosmos" ||
    experience === "surprise"
      ? experience
      : "film";
  return <Demo initial={initial} />;
}
