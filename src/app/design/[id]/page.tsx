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
