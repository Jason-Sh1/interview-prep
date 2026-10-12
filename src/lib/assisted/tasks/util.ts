/** A fenced JavaScript code block for assistant answers. */
export const fence = (code: string) => "```js\n" + code.trim() + "\n```";

/** Applies a planted bug's mutation to a set of files. */
export function mutate(files: Record<string, string>, m: { path: string; from: string; to: string }): Record<string, string> {
  const src = files[m.path];
  if (src === undefined || !src.includes(m.from)) throw new Error(`Mutation target not found in ${m.path}: ${m.from}`);
  return { ...files, [m.path]: src.replace(m.from, m.to) };
}
