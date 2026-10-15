import { notFound } from "next/navigation";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const metadata = { title: "Analytics · Wayfind" };

export default async function AnalyticsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!/^\d+$/.test(spaceId)) notFound();
  return <AnalyticsView spaceId={Number(spaceId)} />;
}
