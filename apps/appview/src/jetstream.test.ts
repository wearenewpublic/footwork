import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toCommitEvent, startJetstream, nextBackoff, type JetstreamClient } from "./jetstream";
import { ids } from "@guides/lexicons";

class FakeClient implements JetstreamClient {
  cursor?: number;
  started = 0;
  closed = 0;
  private handlers: Record<string, (...a: unknown[]) => void> = {};
  constructor(public initialCursor?: number) {
    this.cursor = initialCursor;
  }
  on(event: string, listener: (...a: unknown[]) => void): this {
    this.handlers[event] = listener;
    return this;
  }
  start(): void {
    this.started++;
  }
  close(): void {
    this.closed++;
  }
  emit(event: string, ...args: unknown[]): void {
    this.handlers[event]?.(...args);
  }
}

function fakeDb(cursor: string | null = null) {
  let cur = cursor;
  return {
    getCursor: () => cur,
    setCursor: (c: string) => {
      cur = c;
    },
  } as unknown as import("./db").Db;
}

describe("nextBackoff", () => {
  it("doubles up to a 30s cap", () => {
    expect(nextBackoff(1000)).toBe(2000);
    expect(nextBackoff(16000)).toBe(30000);
    expect(nextBackoff(30000)).toBe(30000);
  });
});

describe("startJetstream reconnect", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const harness = (cursor: string | null = null) => {
    const clients: FakeClient[] = [];
    const createClient = (c?: number) => {
      const fc = new FakeClient(c);
      clients.push(fc);
      return fc;
    };
    const ctl = startJetstream(fakeDb(cursor), { createClient });
    return { clients, ctl };
  };

  it("connects once at start, resuming from the persisted cursor", () => {
    const { clients } = harness("12345");
    expect(clients).toHaveLength(1);
    expect(clients[0].initialCursor).toBe(12345);
    expect(clients[0].started).toBe(1);
  });

  it("reconnects after a close (after the backoff delay)", () => {
    const { clients } = harness();
    clients[0].emit("close");
    expect(clients).toHaveLength(1); // scheduled, not immediate
    vi.advanceTimersByTime(1000);
    expect(clients).toHaveLength(2);
    expect(clients[1].started).toBe(1);
    expect(clients[0].closed).toBe(1); // old client closed on reconnect
  });

  it("schedules only ONE reconnect for rapid repeated close/error (no socket pile-up)", () => {
    const { clients } = harness();
    clients[0].emit("close");
    clients[0].emit("close");
    clients[0].emit("error", new Error("TIMEOUT"));
    vi.advanceTimersByTime(1000);
    expect(clients).toHaveLength(2); // exactly one reconnect
  });

  it("uses exponential backoff across consecutive reconnects", () => {
    const { clients } = harness();
    clients[0].emit("close");
    vi.advanceTimersByTime(1000); // 1s -> client 2
    expect(clients).toHaveLength(2);
    clients[1].emit("close");
    vi.advanceTimersByTime(1000); // only 1s of the required 2s
    expect(clients).toHaveLength(2);
    vi.advanceTimersByTime(1000); // 2s total -> client 3
    expect(clients).toHaveLength(3);
  });

  it("resets backoff after a successful open", () => {
    const { clients } = harness();
    clients[0].emit("close");
    vi.advanceTimersByTime(1000); // client 2, backoff now 2s
    clients[1].emit("open"); // reset to 1s
    clients[1].emit("close");
    vi.advanceTimersByTime(1000); // 1s suffices again
    expect(clients).toHaveLength(3);
  });

  it("stops reconnecting after an intentional close()", () => {
    const { clients, ctl } = harness();
    ctl.close();
    expect(clients[0].closed).toBe(1);
    clients[0].emit("close");
    vi.advanceTimersByTime(60000);
    expect(clients).toHaveLength(1);
  });
});

describe("toCommitEvent", () => {
  it("maps a jetstream create commit to a normalized CommitEvent", () => {
    const evt = {
      did: "did:plc:a",
      kind: "commit",
      commit: {
        operation: "create",
        collection: ids.TownRoundaboutGuideDocument,
        rkey: "1",
        cid: "bafy",
        record: { $type: ids.TownRoundaboutGuideDocument, title: "T" },
      },
    };
    expect(toCommitEvent(evt as any)).toEqual({
      did: "did:plc:a",
      collection: ids.TownRoundaboutGuideDocument,
      rkey: "1",
      operation: "create",
      cid: "bafy",
      record: { $type: ids.TownRoundaboutGuideDocument, title: "T" },
    });
  });

  it("maps a delete commit (no record/cid)", () => {
    const evt = {
      did: "did:plc:a",
      kind: "commit",
      commit: { operation: "delete", collection: ids.TownRoundaboutGuideSave, rkey: "9" },
    };
    expect(toCommitEvent(evt as any)).toEqual({
      did: "did:plc:a",
      collection: ids.TownRoundaboutGuideSave,
      rkey: "9",
      operation: "delete",
      cid: undefined,
      record: undefined,
    });
  });

  it("returns null for non-commit events", () => {
    expect(toCommitEvent({ kind: "identity" } as any)).toBeNull();
  });
});
