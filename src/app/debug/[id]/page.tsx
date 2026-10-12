import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { debugClock, getDebugRound } from "@/lib/comprehension";
import { toPublicDebugTask } from "@/lib/comprehension/types";
import { claudeEnabled } from "@/lib/interview/claude";
import { DebugReportView } from "./DebugReport";
import { DebugRoom } from "./DebugRoom";

export default async function DebugRoundPage({ params }: PageProps<"/debug/[id]">) {
  const { id } = await params;
  const { user } = await requireOnboardedUser();
  const round = await getDebugRound(id, user.id);
  if (!round) notFound();
  if (round.endedAt) return <DebugReportView round={round} usesClaude={claudeEnabled()} />;
  return (
    <DebugRoom
      key={id}
      roundId={id}
      task={toPublicDebugTask(round.task)}
      minutes={round.minutes}
      assistant={round.assistant}
      initialFiles={round.files}
      initialChat={round.chat.map(({ role, text }) => ({ role, text }))}
      elapsedAtRender={debugClock(round)}
    />
  );
}
