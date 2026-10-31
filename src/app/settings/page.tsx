import Link from "next/link";
import { isSingleUser } from "@/lib/auth/mode";
import { requireUser } from "@/lib/auth/session";
import { getPrivacy, retentionDays } from "@/lib/privacy";
import { deleteAllDataAction, deleteRecordingsAction, setConsentAction } from "./actions";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser();
  const [privacy, params] = await Promise.all([getPrivacy(user.id), searchParams]);
  const days = retentionDays();
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Settings and privacy</h1>
      <p className="mt-1 text-muted">
        What&apos;s stored about you and how to remove it. The <Link href="/privacy" className="text-accent hover:underline">privacy page</Link>{" "}
        has the full details.
      </p>
      {params.deleted === "recordings" && (
        <div className="card mt-6 border-good bg-good-soft p-4 text-sm">Your interview recordings were deleted. Your plan and progress are unchanged.</div>
      )}

      <section className="card mt-8 p-5">
        <h2 className="font-medium">Mock interview recording</h2>
        <p className="mt-1 text-sm text-muted">
          A mock saves a text transcript of both voices, your code as you type, and your test runs, to build the feedback report. Audio is never saved.
        </p>
        <form action={setConsentAction} className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="consent" defaultChecked={privacy.recordingConsent} />
            I agree to my mock interviews being recorded
          </label>
          <button className="btn-secondary">Save</button>
        </form>
        <p className="mt-2 text-xs text-muted">
          {privacy.recordingConsent && privacy.consentAt
            ? `You agreed on ${privacy.consentAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}.`
            : "Off: you'll be asked before your next mock. Practice problems and other rounds still work."}
        </p>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-medium">Retention</h2>
        <p className="mt-1 text-sm text-muted">
          Interview recordings (mock transcripts, code timelines and reports, and the chats and files from AI-assisted and debugging rounds) are deleted
          automatically {days} days after the session. Your plan, ratings and solved problems stay until you delete your account.
        </p>
        <form action={deleteRecordingsAction} className="mt-4">
          <button className="btn-secondary">Delete all my recordings now</button>
        </form>
      </section>

      <section className="card mt-4 border-bad p-5">
        <h2 className="font-medium text-bad">Delete all my data</h2>
        <p className="mt-1 text-sm text-muted">
          {isSingleUser()
            ? "Removes everything stored in this app: goals, progress, attempts, reviews, recordings and reports. You start over from the beginning."
            : "Removes your account and everything stored with it: goals, progress, attempts, reviews, recordings and reports. This can't be undone."}
        </p>
        <form action={deleteAllDataAction} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="confirm">
              Type <strong>delete</strong> to confirm
            </label>
            <input className="input" id="confirm" name="confirm" autoComplete="off" required pattern="[Dd][Ee][Ll][Ee][Tt][Ee]" />
          </div>
          <button className="btn bg-bad text-white hover:opacity-90">Delete everything</button>
        </form>
        {params.confirm && <p className="mt-2 text-sm text-bad">Type the word delete to confirm.</p>}
      </section>
    </main>
  );
}
