import type { Metadata } from "next";
import Link from "next/link";
import { retentionDays } from "@/lib/privacy";

export const metadata: Metadata = { title: "Privacy · Interview Prep" };

// Public: readable before signing up. Keep this in step with lib/privacy.ts
// and the consent text in components/RecordingConsent.tsx.
export default function PrivacyPage() {
  const days = retentionDays();
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Privacy</h1>
      <p className="mt-1 text-muted">Plain-language summary of what this app stores, where it goes, and how to delete it.</p>

      <h2 className="mt-8 text-lg font-semibold">What we store</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li><strong>Your account</strong>: name, email and a hashed password (or your GitHub identity if you sign in with GitHub).</li>
        <li><strong>Your goals</strong>: target companies, interview date, level, hours per week, language and time zone.</li>
        <li><strong>Practice history</strong>: each attempt (timings, test results, hints, confidence, your code), your skill ratings and review schedule.</li>
        <li>
          <strong>Mock interview recordings</strong>, only after you agree: a text transcript of what you and the interviewer said, your code as you
          typed it, test runs, and the feedback report built from them.
        </li>
        <li><strong>System design rounds</strong>, only after you agree: the transcript, your whiteboard and the report.</li>
        <li><strong>AI-assisted and debugging rounds</strong>: your chat with the assistant, your files, answers and the report.</li>
        <li><strong>Behavioral prep</strong>, if you add them: your resume text and the stories in your story bank.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">What we don&apos;t store</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li><strong>Audio.</strong> Speech is turned into text as you talk and only the text is kept.</li>
        <li>No advertising, no third-party analytics or tracking scripts, and no cookies except the one that keeps you signed in.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Who else processes it</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          <strong>Speech-to-text</strong>: by default your browser&apos;s built-in speech recognition, which may send audio to your browser&apos;s maker
          (for example Google for Chrome) under their terms. If the site runs the LiveKit voice pipeline, audio goes through LiveKit and its speech
          providers instead. You can always type instead of speaking.
        </li>
        <li>
          <strong>Anthropic (Claude)</strong>, when the site has an API key configured: interview transcripts, code and test results are sent to
          Claude to run the interviewer, the assistants and the feedback report. Anthropic doesn&apos;t train its models on API data by default.
        </li>
        <li><strong>Hosting</strong>: the app and its database run on the site operator&apos;s hosting providers (for example Vercel and Neon).</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">How long we keep it</h2>
      <p className="mt-2">
        Recordings (mock and design-round transcripts, code timelines, whiteboards, feedback reports, and AI round chats and files) are deleted automatically {days} days after the
        session. We keep a content-free note that a session happened (problem, date, length) so your progress and usage counts add up. Your account,
        goals and practice history stay until you delete them.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Usage statistics</h2>
      <p className="mt-2">
        The operator can see totals only: how many people were active each week and how many sessions were completed. They&apos;re counted from the
        app&apos;s own database, with no tracking scripts, and nobody&apos;s individual activity is shown.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Your controls</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>Turn mock recording consent on or off, delete all your recordings now, or delete your account and every row stored with it, in <Link href="/settings" className="text-accent hover:underline">Settings</Link>.</li>
        <li>Deleting is immediate and permanent; nothing is kept in a backup by the app (the hosting provider&apos;s own short-term backups expire on their schedule).</li>
      </ul>

      <p className="mt-10 text-xs text-muted">Questions or requests: contact the person who runs this site and invited you.</p>
    </main>
  );
}
