import "server-only";
import { redirect } from "next/navigation";
import { ConsentRequiredError } from "./privacy";

/**
 * Starts a recorded session. Without recording consent (the box wasn't ticked,
 * or consent was withdrawn in another tab), sends the user back to `back` with
 * `?consent=required` so the page can say what's missing, instead of showing
 * the generic error screen.
 */
export async function startOrAskConsent<T>(start: () => Promise<T>, back: string): Promise<T> {
  try {
    return await start();
  } catch (e) {
    if (e instanceof ConsentRequiredError) redirect(`${back}${back.includes("?") ? "&" : "?"}consent=required`);
    throw e;
  }
}
