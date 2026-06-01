"use client";
import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { PlaceRef } from "../lib/tiptap/placeRef";
import { EventRef } from "../lib/tiptap/eventRef";
import { ReviewBlock } from "../lib/tiptap/reviewBlock";
import { AttachHighlight } from "../lib/tiptap/attachHighlight";
import { CreatePlacePopup } from "./CreatePlacePopup";
import { CreateEventPopup } from "./CreateEventPopup";
import { CreateReviewPopup } from "./CreateReviewPopup";
import type { PMDoc } from "../lib/doc";
import type { PlacePayload, EventPayload, ReviewPayload } from "../lib/publish";

type Popup = "none" | "place" | "event" | "review";

export function GuideEditor({
  onPublish,
}: {
  onPublish: (doc: PMDoc, places: Record<string, PlacePayload>, events: Record<string, EventPayload>, reviews: Record<string, ReviewPayload>) => void;
}) {
  const [places, setPlaces] = useState<Record<string, PlacePayload>>({});
  const [events, setEvents] = useState<Record<string, EventPayload>>({});
  const [reviews, setReviews] = useState<Record<string, ReviewPayload>>({});
  const [popup, setPopup] = useState<Popup>("none");
  const [counter, setCounter] = useState(1);
  // Tiptap v3's useEditor does not re-render React on selection/content changes,
  // so the toolbar's `disabled={selection.empty}` would never update. Bump local
  // state on selection/content updates to keep the toolbar in sync.
  const [, setRev] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit, PlaceRef, EventRef, ReviewBlock, AttachHighlight],
    content: "<p></p>",
    immediatelyRender: false,
    onSelectionUpdate: () => setRev((r) => r + 1),
    onUpdate: () => setRev((r) => r + 1),
  });

  if (!editor) return null;

  const addPlace = (p: PlacePayload) => {
    const refId = `place-${counter}`;
    setCounter((c) => c + 1);
    setPlaces((m) => ({ ...m, [refId]: p }));
    editor.chain().focus().setMark("placeRef", { refId, intent: "card" }).run();
    editor.commands.clearAttachHighlight();
    setPopup("none");
  };
  const addEvent = (e: EventPayload) => {
    const refId = `event-${counter}`;
    setCounter((c) => c + 1);
    setEvents((m) => ({ ...m, [refId]: e }));
    editor.chain().focus().setMark("eventRef", { refId, intent: "card" }).run();
    editor.commands.clearAttachHighlight();
    setPopup("none");
  };
  const addReview = (r: ReviewPayload) => {
    const refId = `review-${counter}`;
    setCounter((c) => c + 1);
    setReviews((m) => ({ ...m, [refId]: r }));
    editor.chain().focus().insertContent({
      type: "reviewBlock",
      attrs: { refId, placeName: r.place.name, rating: r.rating },
    }).run();
    setPopup("none");
  };

  const openWithHighlight = (which: "place" | "event") => {
    const { from, to } = editor.state.selection;
    editor.commands.setAttachHighlight({ from, to });
    setPopup(which);
  };
  const closePopup = () => {
    editor.commands.clearAttachHighlight();
    setPopup("none");
  };

  return (
    <div>
      <div className="toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button onClick={() => openWithHighlight("place")} disabled={editor.state.selection.empty}>Add place</button>
        <button onClick={() => openWithHighlight("event")} disabled={editor.state.selection.empty}>Add event</button>
        <button onClick={() => setPopup("review")}>Add review</button>
      </div>
      <EditorContent editor={editor} />
      {popup === "place" && <CreatePlacePopup onSubmit={addPlace} onCancel={closePopup} />}
      {popup === "event" && <CreateEventPopup onSubmit={addEvent} onCancel={closePopup} />}
      {popup === "review" && <CreateReviewPopup onSubmit={addReview} onCancel={() => setPopup("none")} />}
      <button onClick={() => onPublish(editor.getJSON() as PMDoc, places, events, reviews)}>Publish</button>
    </div>
  );
}
