"use client";
import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { PlaceRef } from "../lib/tiptap/placeRef";
import { EventRef } from "../lib/tiptap/eventRef";
import { CreatePlacePopup } from "./CreatePlacePopup";
import { CreateEventPopup } from "./CreateEventPopup";
import type { PMDoc } from "../lib/doc";
import type { PlacePayload, EventPayload } from "../lib/publish";

type Popup = "none" | "place" | "event";

export function GuideEditor({
  onPublish,
}: {
  onPublish: (doc: PMDoc, places: Record<string, PlacePayload>, events: Record<string, EventPayload>) => void;
}) {
  const [places, setPlaces] = useState<Record<string, PlacePayload>>({});
  const [events, setEvents] = useState<Record<string, EventPayload>>({});
  const [popup, setPopup] = useState<Popup>("none");
  const [counter, setCounter] = useState(1);

  const editor = useEditor({
    extensions: [StarterKit, PlaceRef, EventRef],
    content: "<p></p>",
    immediatelyRender: false,
  });

  if (!editor) return null;

  const addPlace = (p: PlacePayload) => {
    const refId = `place-${counter}`;
    setCounter((c) => c + 1);
    setPlaces((m) => ({ ...m, [refId]: p }));
    editor.chain().focus().setMark("placeRef", { refId, intent: "card" }).run();
    setPopup("none");
  };
  const addEvent = (e: EventPayload) => {
    const refId = `event-${counter}`;
    setCounter((c) => c + 1);
    setEvents((m) => ({ ...m, [refId]: e }));
    editor.chain().focus().setMark("eventRef", { refId, intent: "card" }).run();
    setPopup("none");
  };

  return (
    <div>
      <div className="toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button onClick={() => setPopup("place")} disabled={editor.state.selection.empty}>Add place</button>
        <button onClick={() => setPopup("event")} disabled={editor.state.selection.empty}>Add event</button>
      </div>
      <EditorContent editor={editor} />
      {popup === "place" && <CreatePlacePopup onSubmit={addPlace} onCancel={() => setPopup("none")} />}
      {popup === "event" && <CreateEventPopup onSubmit={addEvent} onCancel={() => setPopup("none")} />}
      <button onClick={() => onPublish(editor.getJSON() as PMDoc, places, events)}>Publish</button>
    </div>
  );
}
