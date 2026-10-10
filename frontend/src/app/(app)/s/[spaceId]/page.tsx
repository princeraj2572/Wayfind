import { notFound } from "next/navigation";
import { SpaceDocuments } from "@/components/docs/space-documents";

export const metadata = { title: "Documents · Wayfind" };

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!/^\d+$/.test(spaceId)) notFound();
  return <SpaceDocuments spaceId={Number(spaceId)} />;
}
