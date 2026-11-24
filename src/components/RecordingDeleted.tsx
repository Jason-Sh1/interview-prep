/**
 * Shown instead of a session's room or report once its recording was purged
 * (the retention limit, or "Delete all my recordings" in Settings). Report
 * generation refuses purged sessions, so nothing is rebuilt from an empty row.
 */
export function RecordingDeleted({ title, what, purgedAt, note }: { title: string; what: string; purgedAt: Date; note?: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="card mt-6 p-4 text-sm text-muted">
        This {what} were deleted on {purgedAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}, under the retention
        limit or at your request.{note ? ` ${note}` : ""}
      </div>
    </main>
  );
}
