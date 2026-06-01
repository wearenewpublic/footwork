import { ids, type StrongRef } from "@guides/lexicons";

export function buildSaveRecord(subject: StrongRef): Record<string, unknown> {
  return {
    $type: ids.TownRoundaboutGuideSave,
    subject: { uri: subject.uri, cid: subject.cid },
    createdAt: new Date().toISOString(),
  };
}
