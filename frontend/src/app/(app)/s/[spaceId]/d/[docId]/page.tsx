import { notFound } from "next/navigation";
import { DocEditor } from "@/components/editor/doc-editor";

export const metadata = { title: "Document · Wayfind" };

export default async function DocumentPage({ params }: { params: Promise<{ spaceId: string; docId: string }> }) {
  const { spaceId, docId } = await params;
  if (!/^\d+$/.test(spaceId) || !/^\d+$/.test(docId)) notFound();
  return <DocEditor spaceId={Number(spaceId)} docId={Number(docId)} />;
}
