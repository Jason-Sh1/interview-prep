import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { assistedClock, getAssistedEvents, getAssistedSession, modelChoices, visibleChat } from "@/lib/assisted";
import { toPublicTask } from "@/lib/assisted/tasks";
import { claudeEnabled } from "@/lib/interview/claude";
import { AssistedRoom } from "./AssistedRoom";
import { AssistedReportView } from "./AssistedReport";

export default async function AssistedSessionPage({ params }: PageProps<"/assisted/[id]">) {
  const { id } = await params;
  const { user } = await requireOnboardedUser();
  const session = await getAssistedSession(id, user.id);
  if (!session) notFound();
  const events = await getAssistedEvents(id);

  if (session.endedAt) {
    return <AssistedReportView session={session} events={events} usesClaude={claudeEnabled()} />;
  }

  const lastSnapshot = events.findLast((e) => e.type === "snapshot");
  return (
    <AssistedRoom
      key={id}
      sessionId={id}
      task={toPublicTask(session.task)}
      minutes={session.minutes}
      models={modelChoices(session.assistant)}
      initialFiles={lastSnapshot?.type === "snapshot" ? { ...session.task.files, ...lastSnapshot.payload.files } : session.task.files}
      initialChat={visibleChat(events).map(({ role, text, model }) => ({ role, text, model }))}
      elapsedAtRender={assistedClock(session)}
    />
  );
}
