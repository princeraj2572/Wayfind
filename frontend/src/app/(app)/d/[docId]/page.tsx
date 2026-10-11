import { notFound } from "next/navigation";
import { DocRedirect } from "@/components/editor/doc-redirect";

export default async function DocumentRedirectPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  if (!/^\d+$/.test(docId)) notFound();
  return <DocRedirect docId={Number(docId)} />;
}
