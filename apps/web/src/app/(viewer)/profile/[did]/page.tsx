import { fetchSaves } from "../../../../lib/appview";
import { parseAtUri } from "../../../../lib/aturi";
import Link from "next/link";

type Params = { did: string };

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  const { did } = await params;
  const saves = await fetchSaves(did);
  return (
    <main>
      <h1>Saved guides</h1>
      <p className="byline">{did}</p>
      {saves.length === 0 ? (
        <p>No saved guides yet.</p>
      ) : (
        <ul>
          {saves.map((s) => {
            const parts = parseAtUri(s.subjectUri);
            const href = parts ? `/guide/${parts.did}/${parts.rkey}` : "#";
            return (
              <li key={s.uri}>
                <Link href={href}>{s.subjectUri}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
