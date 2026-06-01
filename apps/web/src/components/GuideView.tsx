import { DocumentRenderer } from "relational-text-react";
import { ensureInit, documentFromWire } from "../lib/rt";
import type { HydratedGuide, ResolvedRef } from "../lib/appview";

// DocumentRenderer renders a mark only if it has a component here — there are no
// default mark elements (unlike blocks). So formatting/link marks must be provided.
type MarkProps = { name: string; attrs: Record<string, unknown>; children: React.ReactNode };

const Bold = ({ children }: MarkProps) => <strong>{children}</strong>;
const Italic = ({ children }: MarkProps) => <em>{children}</em>;
const Anchor = ({ attrs, children }: MarkProps) => (
  <a href={String(attrs.uri ?? attrs.url ?? "#")} rel="noopener noreferrer">
    {children}
  </a>
);

function chip(kind: "place" | "event", refs: Record<string, ResolvedRef>) {
  return function Chip({ attrs, children }: MarkProps) {
    const ref = attrs.ref as { uri?: string } | undefined;
    const value = ref?.uri ? refs[ref.uri]?.value : null;
    const name = (value?.name as string) ?? null;
    const detail =
      kind === "event" ? (value?.startsAt as string) ?? null : name;
    return (
      <span
        className={`chip chip-${kind}`}
        title={name ? `${kind}: ${detail ?? name}` : undefined}
      >
        {children}
      </span>
    );
  };
}

function reviewCard(refs: Record<string, ResolvedRef>) {
  return function ReviewCard({ attrs }: MarkProps) {
    const ref = attrs.ref as { uri?: string } | undefined;
    const review = ref?.uri ? refs[ref.uri]?.value : null;
    if (!review) return null;
    const rating = Number(review.rating) || 0;
    const stars = "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
    const placeRef = review.place as { uri?: string } | undefined;
    const place = placeRef?.uri ? refs[placeRef.uri]?.value : null;
    const placeName = (place?.name as string) ?? null;
    const vibes = Array.isArray(review.vibes) ? (review.vibes as string[]) : [];
    return (
      <div className="review-card">
        <div className="review-card-head">
          <span className="review-stars" aria-label={`${rating} out of 5`}>{stars}</span>
          {placeName && <span className="review-place">{placeName}</span>}
        </div>
        {review.text ? <p className="review-text">{String(review.text)}</p> : null}
        {vibes.length > 0 && (
          <div className="review-vibes">{vibes.map((v) => <span key={v} className="review-vibe">{v}</span>)}</div>
        )}
      </div>
    );
  };
}

export async function GuideView({ guide }: { guide: HydratedGuide }) {
  await ensureInit();
  const wire = {
    text: String(guide.record.text ?? ""),
    facets: (guide.record.facets as unknown[]) ?? [],
  };
  const hir = documentFromWire(wire).toHIR();
  const components = {
    bold: Bold,
    italic: Italic,
    link: Anchor,
    place: chip("place", guide.references),
    event: chip("event", guide.references),
    review: reviewCard(guide.references),
  };
  return <DocumentRenderer hir={hir} components={components} />;
}
