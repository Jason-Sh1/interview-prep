import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PATTERNS, PROBLEMS } from "@/lib/problems";

export default async function Home({ searchParams }: PageProps<"/">) {
  if (await getCurrentUser()) redirect("/today");
  const { deleted } = await searchParams;
  const features = [
    {
      title: "Starts at your level",
      body: "A short diagnostic, three problems and a quick voice mock, sets your starting point per pattern and a baseline for how you communicate.",
    },
    {
      title: "A plan that re-plans after every attempt",
      body: "Each day's queue is scored from your weakest patterns, your target companies, problems at a ~70% solve chance, and reviews that are due.",
    },
    {
      title: "Pattern-first, with mastery gating",
      body: `${PATTERNS.length} patterns in a prerequisite graph. Harder problems open as your rating in a pattern rises.`,
    },
    {
      title: "Spaced repetition with FSRS",
      body: "Solved problems come back as short reviews right before you'd forget them, often as a fresh twist on the original. Hints shorten the next interval.",
    },
    {
      title: "Mixed practice and stuck detection",
      body: "Once a pattern is learned, problems arrive unlabeled so you practice spotting it. Two misses in a row drop you to a bridge problem.",
    },
    {
      title: "Live voice mock interviews",
      body: "Talk through a problem with an AI interviewer that sees your code as you type, then get a report on your code and your communication. Weak spots go straight back into your plan.",
    },
    {
      title: "AI-assisted coding rounds",
      body: "Practice the new rounds where an AI assistant is allowed: a small repo, a chat assistant that sometimes slips in a bug, and grading on how you prompt, review and own the code.",
    },
    {
      title: "Comprehension and debugging rounds",
      body: "Read an unfamiliar repo, explain how it works, and find the bugs seeded in it, graded on what you fixed, how you verified it and how you explain it.",
    },
  ];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16">
      {deleted && (
        <div className="card mb-8 border-good bg-good-soft p-4 text-sm">Your account and all its data were deleted.</div>
      )}
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
        Coding interview prep that adapts to every attempt you make.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Tell it your target companies and interview date. It builds a pattern-by-pattern track from {PROBLEMS.length}{" "}
        problems and adjusts it each time you solve, struggle or review.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/signin?mode=signup" className="btn-primary">Get started</Link>
        <Link href="/signin" className="btn-secondary">Sign in</Link>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="card p-5">
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        Your data stays yours: mock interviews are recorded only with your consent, never as audio, are deleted automatically after a while, and you
        can delete everything any time. <Link href="/privacy" className="text-accent hover:underline">How we handle your data</Link>.
      </p>
      <p className="mt-3 text-sm text-muted">
        Company profiles are checked against recent interview reports every week, so the plan follows how each company interviews now.
      </p>
    </main>
  );
}
