import { DocumentRenderer } from "relational-text-react";
import { ensureInit, documentFromWire } from "../lib/rt";
import type { HydratedGuide, ResolvedRef } from "../lib/appview";

function chip(kind: "place" | "event", refs: Record<string, ResolvedRef>) {
  return function Chip({
    attrs,
    children,
  }: {
    name: string;
    attrs: Record<string, unknown>;
    children: React.ReactNode;
  }) {
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

export async function GuideView({ guide }: { guide: HydratedGuide }) {
  await ensureInit();
  const wire = {
    text: String(guide.record.text ?? ""),
    facets: (guide.record.facets as unknown[]) ?? [],
  };
  const hir = documentFromWire(wire).toHIR();
  const components = {
    place: chip("place", guide.references),
    event: chip("event", guide.references),
  };
  return <DocumentRenderer hir={hir} components={components} />;
}
