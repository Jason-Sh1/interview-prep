import type { Source } from "@/lib/research/profiles";

export function SourceList({ sources, compact }: { sources: Source[]; compact?: boolean }) {
  if (compact) {
    return (
      <span>
        {sources.slice(0, 3).map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="mr-2 text-accent hover:underline" title={s.title}>
            [{i + 1}]
          </a>
        ))}
        {sources.length > 3 && <span className="text-muted">+{sources.length - 3}</span>}
      </span>
    );
  }
  return (
    <ol className="mt-0.5 list-decimal space-y-0.5 pl-5">
      {sources.map((s, i) => (
        <li key={i}>
          <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {s.title}
          </a>
          {s.published && <span className="text-muted"> · {s.published}</span>}
        </li>
      ))}
    </ol>
  );
}
