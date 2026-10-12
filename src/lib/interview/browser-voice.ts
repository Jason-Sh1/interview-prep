// Browser voice for the no-key fallback: the Web Speech API's speech
// recognition for the candidate and speech synthesis for the interviewer.
// Recognition works in Chrome, Edge and Safari; synthesis everywhere.

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenerEvents {
  /** Partial words while the candidate is talking. */
  onInterim(text: string): void;
  /** A finished utterance, with when it started (by `now()`). */
  onFinal(text: string, startedAt: number): void;
  onError(message: string): void;
}

/**
 * Continuous speech recognition that restarts itself (browsers stop it after
 * a pause) and joins a burst of final results into one utterance once the
 * candidate pauses for `pauseMs`.
 */
export class BrowserListener {
  private rec: Recognition | null = null;
  private active = false;
  private buffer = "";
  private startedAt: number | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private events: ListenerEvents,
    private now: () => number,
    private pauseMs = 1200,
  ) {}

  start() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      this.events.onError("Speech recognition isn't available in this browser. Type your answers instead, or use Chrome or Edge.");
      return;
    }
    if (this.active) return;
    this.active = true;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (this.startedAt === null && text.trim()) this.startedAt = this.now();
        if (r.isFinal) this.buffer += (this.buffer ? " " : "") + text.trim();
        else interim += text;
      }
      this.events.onInterim((this.buffer + " " + interim).trim());
      this.scheduleFlush();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.active = false;
        this.events.onError("Microphone access was blocked. Allow it in the address bar, or type your answers.");
      }
    };
    rec.onend = () => {
      // Browsers end recognition after silence; keep listening while active.
      if (this.active) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  stop() {
    this.active = false;
    this.rec?.abort();
    this.rec = null;
    this.flush();
  }

  /** Drops whatever was heard so far (used to ignore the interviewer's own voice). */
  discard() {
    this.buffer = "";
    this.startedAt = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.events.onInterim("");
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), this.pauseMs);
  }

  private flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    const text = this.buffer.trim();
    const startedAt = this.startedAt ?? this.now();
    this.buffer = "";
    this.startedAt = null;
    if (text) this.events.onFinal(text, startedAt);
  }
}

/**
 * Speaks streamed text a sentence at a time, so speech starts before the
 * whole reply has arrived.
 */
export class BrowserSpeaker {
  private pending = "";
  private queued = 0;
  private voice: SpeechSynthesisVoice | null = null;

  constructor(private onSpeakingChange: (speaking: boolean) => void) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
        this.voice = voices.find((v) => /natural|neural|google us/i.test(v.name)) ?? voices[0] ?? null;
      };
      pickVoice();
      speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
    }
  }

  get speaking() {
    return this.queued > 0;
  }

  /** Adds streamed text; speaks every complete sentence. */
  push(chunk: string) {
    this.pending += chunk;
    const re = /[^.!?]*[.!?]+["')\]]*(\s+|$)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.pending)) && m[0].length) {
      if (m.index + m[0].length === this.pending.length && !/\s$/.test(m[0])) break; // may still be growing ("3.5")
      this.say(m[0]);
      last = m.index + m[0].length;
    }
    this.pending = this.pending.slice(last);
  }

  /** Speaks whatever is left once the stream ends. */
  end() {
    if (this.pending.trim()) this.say(this.pending);
    this.pending = "";
  }

  cancel() {
    this.pending = "";
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
    if (this.queued) {
      this.queued = 0;
      this.onSpeakingChange(false);
    }
  }

  private say(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
    const u = new SpeechSynthesisUtterance(text.trim());
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    const done = () => {
      if (this.queued === 0) return;
      this.queued--;
      if (this.queued === 0) this.onSpeakingChange(false);
    };
    u.onend = done;
    u.onerror = done;
    if (this.queued++ === 0) this.onSpeakingChange(true);
    speechSynthesis.speak(u);
  }
}
