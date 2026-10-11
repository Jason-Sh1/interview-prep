import { redirect } from "next/navigation";
import { githubEnabled } from "@/lib/auth/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { SignInForm } from "./SignInForm";

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  if (await getCurrentUser()) redirect("/today");
  const { mode } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <SignInForm initialMode={mode === "signup" ? "signup" : "signin"} github={githubEnabled} />
    </main>
  );
}
