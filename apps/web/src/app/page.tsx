import Link from "next/link";
import { listGuides } from "../lib/appview";
import { parseAtUri } from "../lib/aturi";

function shortDid(did: string): string {
  return did.length > 18 ? did.slice(0, 17) + "…" : did;
}

export default async function Home() {
  const guides = await listGuides();
  return (
    <main>
      <h1>Guides</h1>
      <p>A place-based, collaborative recommendation tool on AT Protocol.</p>
      <h2>Recent guides</h2>
      {guides.length === 0 ? (
        <p>
          No guides yet — <Link href="/compose">compose the first one</Link>.
        </p>
      ) : (
        <ul>
          {guides.map((g) => {
            const parts = parseAtUri(g.uri);
            const href = parts ? `/guide/${parts.did}/${parts.rkey}` : "#";
            const title = String(g.record.title ?? "Untitled guide");
            return (
              <li key={g.uri}>
                <Link href={href}>{title}</Link>{" "}
                <Link href={`/profile/${g.did}`} className="byline">by {shortDid(g.did)}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
