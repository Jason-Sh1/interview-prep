// Browser side of the LiveKit voice pipeline: joins the session's room,
// publishes the microphone, plays the interviewer agent's audio, and shows
// both sides' live transcription. The agent worker (./agent) does speech
// recognition and synthesis and asks the app for each interviewer turn.
import type { Room } from "livekit-client";
import type { Speaker, TurnKind } from "./types";

export interface LiveKitCallbacks {
  onLine(line: { id: string; speaker: Speaker; text: string; final: boolean }): void;
  onAgentState(state: "connecting" | "listening" | "thinking" | "speaking" | string): void;
  onError(message: string): void;
}

export class LiveKitVoice {
  private room: Room | null = null;
  private audioEls: HTMLMediaElement[] = [];

  constructor(
    private sessionId: string,
    private cb: LiveKitCallbacks,
  ) {}

  async connect() {
    const res = await fetch(`/api/mock/${this.sessionId}/livekit`, { method: "POST" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not join the voice room");
    const { url, token } = (await res.json()) as { url: string; token: string };
    const { Room, RoomEvent, Track } = await import("livekit-client");
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.style.display = "none";
      document.body.appendChild(el);
      this.audioEls.push(el);
    });
    room.on(RoomEvent.ParticipantAttributesChanged, (changed) => {
      const state = changed["lk.agent.state"];
      if (state) this.cb.onAgentState(state);
    });
    room.on(RoomEvent.Disconnected, () => this.cb.onAgentState("disconnected"));
    room.registerTextStreamHandler("lk.transcription", async (reader) => {
      const attrs = reader.info.attributes ?? {};
      const trackId = attrs["lk.transcribed_track_id"];
      const local = [...room.localParticipant.trackPublications.values()].some((p) => p.trackSid === trackId);
      const speaker: Speaker = local ? "candidate" : "interviewer";
      const id = attrs["lk.segment_id"] ?? reader.info.id;
      const final = attrs["lk.transcription_final"] === "true";
      let text = "";
      for await (const chunk of reader) {
        text += chunk;
        this.cb.onLine({ id, speaker, text, final: false });
      }
      this.cb.onLine({ id, speaker, text, final: final || speaker === "interviewer" });
    });

    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    this.cb.onAgentState("connecting");
  }

  async setMicrophone(on: boolean) {
    await this.room?.localParticipant.setMicrophoneEnabled(on);
  }

  /** Asks the agent to take an event-driven turn (a test run, silence, time running out). */
  async nudge(kind: Exclude<TurnKind, "utterance" | "start">) {
    if (!this.room) return;
    const data = new TextEncoder().encode(JSON.stringify({ type: "turn", kind }));
    await this.room.localParticipant.publishData(data, { reliable: true, topic: "interview" });
  }

  /** Sends a typed message; the agent treats it like speech. */
  async sendText(text: string) {
    if (!this.room) return;
    const data = new TextEncoder().encode(JSON.stringify({ type: "text", text }));
    await this.room.localParticipant.publishData(data, { reliable: true, topic: "interview" });
  }

  async disconnect() {
    for (const el of this.audioEls) el.remove();
    this.audioEls = [];
    await this.room?.disconnect();
    this.room = null;
  }
}
