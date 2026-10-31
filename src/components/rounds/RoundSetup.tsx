import { startRoundAction } from "@/app/rounds/actions";
import { COMPANIES } from "@/lib/engine/companies";
import type { RoundKind } from "@/lib/rounds/types";

/** The Start form for one topic: length, interviewer persona and company style. */
export function RoundSetup({
  kind,
  topic,
  targets,
  minutes = [30, 45, 60],
  defaultMinutes = 45,
  extra,
  label = "Start",
  action = startRoundAction,
}: {
  kind: RoundKind;
  topic: string;
  targets: string[];
  minutes?: number[];
  defaultMinutes?: number;
  extra?: React.ReactNode;
  label?: string;
  /** A kind's own start action, when it prepares the round (for example loading your stories). */
  action?: (form: FormData) => Promise<void>;
}) {
  const companies = [...COMPANIES].sort((a, b) => Number(targets.includes(b.id)) - Number(targets.includes(a.id)));
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="topic" value={topic} />
      {extra}
      <select name="minutes" className="input w-auto" defaultValue={String(defaultMinutes)} aria-label="Length">
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m} minutes
          </option>
        ))}
      </select>
      <select name="persona" className="input w-auto" defaultValue="neutral" aria-label="Interviewer style">
        <option value="friendly">Friendly</option>
        <option value="neutral">Neutral</option>
        <option value="terse">Terse</option>
      </select>
      <select name="company" className="input w-auto" defaultValue={targets[0] ?? ""} aria-label="Company style">
        <option value="">Any company</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button className="btn-primary">{label}</button>
    </form>
  );
}
