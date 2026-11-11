import Recipient from "@/components/recipient";
export const metadata = {
  title: "A gift for you",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <Recipient token={token} />;
}
