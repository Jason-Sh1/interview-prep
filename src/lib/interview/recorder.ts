// Client-side timeline recorder: batches code edits, snapshots, runs and
// markers and posts them to the session's events route.
import type { Language } from "../runner/drivers";
import type { EditOp, SessionEvent } from "./types";

const FLUSH_MS = 2000;
const SNAPSHOT_MS = 15_000;
const MAX_BATCH = 400;
/** The events route accepts at most this many ops per edit event. */
const MAX_OPS = 500;

export class Recorder {
  private queue: SessionEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSnapshotAt = -Infinity;
  private dirtySinceSnapshot = false;
  private inflight: Promise<void> = Promise.resolve();
  failed = false;

  constructor(
    private sessionId: string,
    readonly now: () => number,
  ) {}

  start() {
    this.timer ??= setInterval(() => void this.flush(), FLUSH_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  push(e: SessionEvent) {
    this.queue.push(e);
  }

  edit(ops: EditOp[], code: string, language: Language) {
    if (!ops.length) return;
    // A replace-all can produce thousands of ops; split so no event is rejected.
    for (let i = 0; i < ops.length; i += MAX_OPS) this.push({ type: "edit", t: this.now(), payload: { ops: ops.slice(i, i + MAX_OPS) } });
    this.dirtySinceSnapshot = true;
    if (this.now() - this.lastSnapshotAt > SNAPSHOT_MS) this.snapshot(code, language);
  }

  /** A full copy of the code; taken periodically, on runs, on language switches and at the end. */
  snapshot(code: string, language: Language) {
    this.push({ type: "snapshot", t: this.now(), payload: { code, language } });
    this.lastSnapshotAt = this.now();
    this.dirtySinceSnapshot = false;
  }

  /** Snapshots only if the code changed since the last one. */
  snapshotIfDirty(code: string, language: Language) {
    if (this.dirtySinceSnapshot) this.snapshot(code, language);
  }

  /** Sends everything queued; calls are serialized so events arrive in order. */
  flush(): Promise<void> {
    this.inflight = this.inflight.then(async () => {
      while (this.queue.length) {
        const batch = this.queue.slice(0, MAX_BATCH);
        try {
          const res = await fetch(`/api/mock/${this.sessionId}/events`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ events: batch }),
            keepalive: true,
          });
          // 409: the session ended. 400: the batch can never be accepted, so
          // drop it rather than block every later event behind it.
          if (!res.ok && res.status !== 409 && res.status !== 400) throw new Error(`HTTP ${res.status}`);
          this.queue.splice(0, batch.length);
          this.failed = false;
        } catch {
          this.failed = true;
          return; // retry on the next tick
        }
      }
    });
    return this.inflight;
  }

  /** Best-effort send when the tab is closing. */
  beacon() {
    if (!this.queue.length || typeof navigator === "undefined" || !navigator.sendBeacon) return;
    const blob = new Blob([JSON.stringify({ events: this.queue.slice(0, MAX_BATCH) })], { type: "application/json" });
    if (navigator.sendBeacon(`/api/mock/${this.sessionId}/events`, blob)) this.queue = [];
  }
}
