import { notFound } from "next/navigation";
import { generateRoundReportAction } from "@/app/rounds/actions";
import { RoundReportView } from "@/components/rounds/RoundReportView";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { designKind } from "@/lib/design";
import { designArtifactSchema, emptyDesignArtifact } from "@/lib/design/scene";
import { DESIGN_TOPIC_BY_ID } from "@/lib/design/topics";
import { claudeEnabled } from "@/lib/interview/claude";
import { getRound, roundClock } from "@/lib/rounds";
import type { RoundKindDef } from "@/lib/rounds/kind";
import { DesignReportSection } from "./DesignReportSection";
import { DesignRoom } from "./DesignRoom";

export default async function DesignRoundPage({ params }: PageProps<"/design/[id]">) {
  const { id } = await params;
  const { user } = await requireOnboardedUser();
  const round = await getRound(id, user.id);
  if (!round || round.kind !== "design") notFound();
  const topic = DESIGN_TOPIC_BY_ID.get(round.topicId);
  if (!topic) notFound();
  if (round.purgedAt) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">{topic.title}</h1>
        <div className="card mt-6 p-4 text-sm text-muted">
          This round&apos;s transcript, whiteboard and report were deleted on{" "}
          {round.purgedAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}, under the retention limit or at your
          request.
        </div>
      </main>
    );
  }
  const parsed = designArtifactSchema.safeParse(round.artifact);
  const artifact = parsed.success ? parsed.data : emptyDesignArtifact();

  if (round.endedAt) {
    return (
      <RoundReportView
        round={round}
        def={designKind as unknown as RoundKindDef}
        title={topic.title}
        usesClaude={claudeEnabled()}
        generate={generateRoundReportAction}
      >
        <DesignReportSection topicId={topic.id} artifact={artifact} extra={round.report?.extra} />
      </RoundReportView>
    );
  }
  return (
    <DesignRoom
      key={id}
      roundId={id}
      title={topic.title}
      prompt={topic.summary}
      minutes={round.config.minutes}
      // A server component renders once per request, so reading the clock here is safe.
      elapsedAtRender={round.startedAt ? roundClock(round) : null}
      initialTranscript={round.transcript}
      initialArtifact={artifact}
    />
  );
}
