import Link from "next/link";
import { retentionDays } from "@/lib/privacy";

// The consent checkbox shown inside a form that starts a mock interview, until
// the user has agreed once. The server refuses to create a mock without consent
// (lib/mock.ts), so this is the only way in. Withdraw any time in Settings.
export function RecordingConsent({ claude, livekit }: { claude: boolean; livekit: boolean }) {
  return (
    <div className="card space-y-2 border-accent p-4 text-sm">
      <p className="font-medium">Before your first mock interview</p>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>
          We save a <strong className="text-ink">text transcript</strong> of what you and the interviewer say, your code as you type it, and your test
          runs, to build your feedback report and replay.
        </li>
        <li>
          <strong className="text-ink">Audio is never saved.</strong> Speech is turned into text by{" "}
          {livekit ? "LiveKit's speech service" : "your browser's speech recognition (which may send audio to your browser maker, such as Google)"}. You
          can type instead of speaking.
        </li>
        {claude && <li>The transcript and code are sent to Anthropic&apos;s Claude API to run the interviewer and write your report.</li>}
        <li>
          Recordings are deleted automatically after {retentionDays()} days, and you can delete them, or everything, any time in{" "}
          <Link href="/settings" className="text-accent hover:underline">Settings</Link>. Details on the{" "}
          <Link href="/privacy" className="text-accent hover:underline">privacy page</Link>.
        </li>
      </ul>
      <label className="flex items-start gap-2 pt-1">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>I agree to my mock interviews being recorded as described.</span>
      </label>
    </div>
  );
}
