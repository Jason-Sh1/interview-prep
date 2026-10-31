"use server";
import { setRecordingConsent } from "@/lib/privacy";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { PERSONAS } from "@/lib/interview/types";
import { createRound, finishRound, generateRoundReport, getRound } from "@/lib/rounds";
import { kindDef } from "@/lib/rounds/registry";
import { ROUND_INFO, ROUND_KINDS } from "@/lib/rounds/types";
import { getGoals } from "@/lib/track";

const startSchema = z.object({
  kind: z.enum(ROUND_KINDS),
  topic: z.string().min(1).max(100),
  minutes: z.coerce.number().pipe(z.union([z.literal(20), z.literal(30), z.literal(45), z.literal(60)])),
  persona: z.enum(PERSONAS),
  company: z
    .string()
    .max(40)
    .transform((c) => (c && COMPANY_BY_ID[c] ? c : null)),
});

/** Starts a conversation round from a setup form and opens its room. */
export async function startRoundAction(form: FormData) {
  const user = await requireUser();
  const p = startSchema.parse({
    kind: form.get("kind"),
    topic: form.get("topic"),
    minutes: form.get("minutes"),
    persona: form.get("persona") ?? "neutral",
    company: form.get("company") ?? "",
  });
  if (!kindDef(p.kind)) throw new Error("That round isn't available yet");
  // First round: the consent checkbox comes with the form. createRound refuses without consent.
  if (form.get("consent") === "on") await setRecordingConsent(user.id, true);
  const goals = await getGoals(user.id);
  const id = await createRound(user.id, p.kind, p.topic, { minutes: p.minutes, persona: p.persona, company: p.company, level: goals?.level ?? "mid" });
  redirect(`${ROUND_INFO[p.kind].path}/${id}`);
}

export async function finishRoundAction(id: string, artifact?: unknown): Promise<void> {
  const user = await requireUser();
  const round = await getRound(id, user.id);
  if (!round) throw new Error("Unknown round");
  await finishRound(round, artifact);
}

export async function generateRoundReportAction(id: string): Promise<void> {
  const user = await requireUser();
  const round = await getRound(id, user.id);
  if (!round) throw new Error("Unknown round");
  await generateRoundReport(round);
}
