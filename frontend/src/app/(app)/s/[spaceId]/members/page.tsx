import { notFound } from "next/navigation";
import { MembersView } from "@/components/members/members-view";

export const metadata = { title: "Members · Wayfind" };

export default async function MembersPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!/^\d+$/.test(spaceId)) notFound();
  return <MembersView spaceId={Number(spaceId)} />;
}
