import { notFound } from "next/navigation";
import { generateRoundReportAction } from "@/app/rounds/actions";
import { RoundReportView } from "@/components/rounds/RoundReportView";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { behavioralKind } from "@/lib/behavioral";
import { behavioralArtifactSchema } from "@/lib/behavioral/artifact";
import { BEHAVIORAL_TOPIC_BY_ID } from "@/lib/behavioral/questions";
import { questionsOf } from "@/lib/behavioral/scripted";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { claudeEnabled } from "@/lib/interview/claude";
import { getRound, roundClock } from "@/lib/rounds";
import type { RoundKindDef } from "@/lib/rounds/kind";
import { BehavioralReportSection } from "./BehavioralReportSection";
import { BehavioralRoom } from "./BehavioralRoom";

export default async function BehavioralRoundPage({ params }: PageProps<"/behavioral/[id]">) {
  const { id } = await params;
  const { user } = await requireOnboardedUser();
  const round = await getRound(id, user.id);
  if (!round || round.kind !== "behavioral") notFound();
  const topic = BEHAVIORAL_TOPIC_BY_ID.get(round.topicId);
  if (!topic) notFound();
  const parsed = behavioralArtifactSchema.safeParse(round.artifact);
  const artifact = parsed.success ? parsed.data : behavioralKind.initialArtifact(topic.id);
  const companyName = round.config.company ? (COMPANY_BY_ID[round.config.company]?.name ?? null) : null;

  if (round.endedAt) {
    return (
      <RoundReportView round={round} def={behavioralKind as unknown as RoundKindDef} title={topic.title} usesClaude={claudeEnabled()} generate={generateRoundReportAction}>
        <BehavioralReportSection roundId={round.id} extra={round.report?.extra} companyName={companyName} />
      </RoundReportView>
    );
  }
  return (
    <BehavioralRoom
      key={id}
      roundId={id}
      title={topic.title}
      companyName={companyName}
      minutes={round.config.minutes}
      // A server component renders once per request, so reading the clock here is safe.
      elapsedAtRender={round.startedAt ? roundClock(round) : null}
      initialTranscript={round.transcript}
      initialArtifact={artifact}
      questions={questionsOf(artifact).map((q) => ({ id: q.id, text: q.text, competencies: q.competencies }))}
    />
  );
}
