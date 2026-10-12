import { requireUser } from "@/lib/auth/session";
import { COMPANIES } from "@/lib/engine/companies";
import { getGoals } from "@/lib/track";
import { saveGoalsAction } from "../actions";
import { TimeZoneInput } from "./TimeZoneInput";

export default async function OnboardingPage() {
  const user = await requireUser();
  const goals = await getGoals(user.id);
  const g = goals ?? { targetCompanies: [] as string[], level: "mid", interviewDate: null, hoursPerWeek: 7, language: "python", timeZone: null };
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{goals ? "Your goals" : "Set up your track"}</h1>
      <p className="mt-1 text-muted">
        These shape which patterns come first, how many problems you get each day, and when the plan shifts into its final stretch.
      </p>
      <form action={saveGoalsAction} className="mt-8 space-y-7">
        <TimeZoneInput />
        <fieldset>
          <legend className="label">Target companies</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COMPANIES.map((c) => (
              <label key={c.id} className="card flex cursor-pointer items-center gap-2 px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="checkbox" name="companies" value={c.id} defaultChecked={g.targetCompanies.includes(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="interviewDate">Interview date (optional)</label>
            <input className="input" type="date" id="interviewDate" name="interviewDate" defaultValue={g.interviewDate ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="hoursPerWeek">Hours per week</label>
            <input className="input" type="number" min={1} max={60} id="hoursPerWeek" name="hoursPerWeek" defaultValue={g.hoursPerWeek} />
          </div>
          <div>
            <label className="label" htmlFor="level">Level</label>
            <select className="input" id="level" name="level" defaultValue={g.level}>
              <option value="new-grad">New grad / intern</option>
              <option value="mid">Mid-level</option>
              <option value="senior">Senior</option>
              <option value="staff">Staff+</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="language">Language</label>
            <select className="input" id="language" name="language" defaultValue={g.language}>
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="imported">Already solved some on LeetCode? (optional)</label>
          <textarea
            className="input min-h-24 font-mono text-xs"
            id="imported"
            name="imported"
            placeholder={"https://leetcode.com/problems/two-sum/\nValid Parentheses\n…"}
          />
          <p className="mt-1 text-xs text-muted">
            Paste problem links or titles, one per line. Matching problems count as solved, which raises your starting ratings and schedules them for review.
          </p>
        </div>
        <button className="btn-primary">{goals ? "Save" : "Build my plan"}</button>
      </form>
    </main>
  );
}
