import { notFound } from "next/navigation";
import { DocEditor } from "@/components/editor/doc-editor";

export const metadata = { title: "New document · Wayfind" };

export default async function NewDocumentPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!/^\d+$/.test(spaceId)) notFound();
  return <DocEditor spaceId={Number(spaceId)} docId={null} />;
}
