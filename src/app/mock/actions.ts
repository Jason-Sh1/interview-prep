"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { createMockSession, endMockSession, getMockSession } from "@/lib/mock";
import { PROBLEM_BY_SLUG } from "@/lib/problems";

const startSchema = z.object({
  slug: z.string().refine((s) => PROBLEM_BY_SLUG.has(s), "Unknown problem"),
  persona: z.enum(["friendly", "neutral", "terse"]),
  minutes: z.coerce.number().pipe(z.union([z.literal(30), z.literal(45), z.literal(60)])),
  hintsAllowed: z.boolean(),
  company: z.string().transform((c) => (COMPANY_BY_ID[c] ? c : null)),
  language: z.enum(["python", "javascript"]),
});

export async function startMockAction(form: FormData) {
  const user = await requireUser();
  const p = startSchema.parse({
    slug: form.get("slug"),
    persona: form.get("persona"),
    minutes: form.get("minutes"),
    hintsAllowed: form.get("hints") === "on",
    company: String(form.get("company") ?? ""),
    language: form.get("language"),
  });
  const id = await createMockSession(user.id, {
    slug: p.slug,
    language: p.language,
    config: { persona: p.persona, minutes: p.minutes, hintsAllowed: p.hintsAllowed, company: p.company },
  });
  redirect(`/mock/${id}`);
}

export async function endMockAction(id: string, finalCode: string | null) {
  const user = await requireUser();
  const session = await getMockSession(id, user.id);
  if (!session) throw new Error("Unknown session");
  await endMockSession(session, finalCode?.slice(0, 100_000) ?? null);
}
