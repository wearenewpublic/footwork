import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchGuide } from "../../../../../lib/appview";
import { GuideView } from "../../../../../components/GuideView";
import { SaveButton } from "../../../../../components/SaveButton";

type Params = { did: string; rkey: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { did, rkey } = await params;
  const guide = await fetchGuide(did, rkey);
  if (!guide) return { title: "Guide not found" };
  const title = String(guide.record.title ?? "Guide");
  // Strip relationaltext block markers (U+FFFC first-block, \n subsequent) for a clean description.
  const description = String(guide.record.text ?? "")
    .replace(/￼/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const canonical = `/guide/${did}/${rkey}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "article", url: canonical },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { did, rkey } = await params;
  const guide = await fetchGuide(did, rkey);
  if (!guide) notFound();
  const title = String(guide.record.title ?? "Guide");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    author: {
      "@type": "Person",
      name: guide.author.handle ?? guide.author.did,
    },
  };
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1>{title}</h1>
      <p className="byline">by {guide.author.handle ?? guide.author.did}</p>
      {/* GuideView is an async server component */}
      <GuideView guide={guide} />
      <SaveButton subjectUri={guide.uri} subjectCid={guide.cid} />
    </main>
  );
}
