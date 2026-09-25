import { AskView } from "@/components/ask/ask-view";

export const metadata = { title: "Ask · Wayfind" };

export default async function AskPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const { space } = await searchParams;
  const id = space && /^\d+$/.test(space) ? Number(space) : null;
  return <AskView initialSpaceId={id} />;
}
