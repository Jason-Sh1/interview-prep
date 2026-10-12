// Pure helper for the room's paste detection, kept here so it can be tested.
const normLine = (l: string) => l.trim().replace(/\s+/g, " ");

/** Whether most of a paste's lines appear in code from the assistant's answers. */
export function pastedFromAssistant(text: string, answers: string[]): boolean {
  const lines = text.split("\n").map(normLine).filter((l) => l.length >= 4);
  if (!lines.length) return false;
  const known = new Set(
    answers.flatMap((a) => [...a.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split("\n").map(normLine))),
  );
  return lines.filter((l) => known.has(l)).length / lines.length >= 0.6;
}
