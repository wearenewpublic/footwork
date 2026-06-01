# relationaltext Adoption — Live Verification (2026-06-01)

Plan 5 (revised): adopt the `relational-text` library. Live round-trip in the new format.

## Outcome: ✅ FULL ROUND-TRIP VERIFIED (relationaltext format)

Guide: `at://did:plc:3vdrgzr2zybocs45yfhcr6ur/town.roundabout.guide.document/3mn7qyaifnt26`
("Pelmeni", by blaine.bsky.social; 2 paragraphs, bold, a place + an event reference).

- **Write** — composed in the Tiptap editor; `rt.ts` built a `relational-text` `Document` (hub vocab for bold/italic; `town.roundabout.guide.facet#place`/`#event` entities); published to the real PDS.
- **Render** — the SSR guide page reconstructed the Document from `{text, facets}`, ran `toHIR()`, and rendered via `relational-text-react`'s `DocumentRenderer`: prose in `<p>` blocks with **inline place/event chips** (`chip-place "pelmeni castle"`, `chip-event "pelmeni crush"`), resolved names from the AppView `references` map. Title/byline, JSON-LD Article, and OG/Twitter meta all present (search-indexable).
- **Save** — Save button wrote a `town.roundabout.guide.save` record; profile page lists it.
- **CID-compat** — `verify-cid.ts`: place + event refs all MATCH (facet = pds = computed):
  - place `pelmeni castle` → `bafyreieqxew3pkid7orvzygq35hyjhuprjq3no2ucz2zym5o4mobc66mca`
  - event `pelmeni crush` → `bafyreifnrmlzu67v6crvptltboi7u2yjkj2cfxbqhodhwituez7cdsonfy`

## Bug found & fixed during verification

The first attempt rendered **blank**: `rt.ts` built blocks by joining paragraphs with literal `\n\n` and faceting content ranges. relationaltext blocks instead use a single **sentinel marker char per block** (`￼` for the first block, `\n` for subsequent), with the block facet covering only the marker and content following it. `toHIR` therefore mis-extracted (blocks held the separators; the prose was dropped). Fixed `rt.ts` to emit markers + facet only the marker char; `rt.test.ts` now asserts the prose lands in paragraph blocks via `toHIR` (would have caught it). Also stripped block markers from the OG/description metadata.

## Net result

Guides are now first-class relationaltext documents using the library's tested model, HIR, and React renderer — no hand-rolled rich-text stack. place/event remain our own entity vocabulary. The AppView is unchanged (ref-keyed hydration). This completes the five-plan spike: Foundation → AppView → Editor (write) → Editor (UI) → Viewer (relationaltext).
