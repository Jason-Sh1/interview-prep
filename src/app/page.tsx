import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PATTERNS, PROBLEMS } from "@/lib/problems";

export default async function Home() {
  if (await getCurrentUser()) redirect("/today");
  const features = [
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
      body: "Solved problems come back as short reviews right before you'd forget them. Hints shorten the next interval.",
    },
    {
      title: "Mixed practice and stuck detection",
      body: "Once a pattern is learned, problems arrive unlabeled so you practice spotting it. Two misses in a row drop you to a bridge problem.",
    },
  ];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16">
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
      <p className="mt-10 text-sm text-muted">Coming next: live voice mock interviews and feedback on your code and communication.</p>
    </main>
  );
}
