import "server-only";
import { timingSafeEqual } from "node:crypto";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";

// The LiveKit voice pipeline (spec 5): turned on when LIVEKIT_URL,
// LIVEKIT_API_KEY, LIVEKIT_API_SECRET and INTERVIEWER_AGENT_SECRET are set
// and the agent worker in ./agent is running. Otherwise the browser's own
// speech recognition and synthesis carry the voice.

export const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || "interviewer";

export function livekitEnabled(): boolean {
  return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.INTERVIEWER_AGENT_SECRET);
}

export const roomName = (sessionId: string) => `mock-${sessionId}`;

/** A token for the candidate that also dispatches the interviewer agent into the room. */
export async function candidateToken(sessionId: string, user: { id: string; name: string }): Promise<{ url: string; token: string }> {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: user.id,
    name: user.name,
    ttl: "2h",
  });
  at.addGrant({ roomJoin: true, room: roomName(sessionId), canPublish: true, canSubscribe: true, canPublishData: true });
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: AGENT_NAME, metadata: JSON.stringify({ sessionId }) })],
  });
  return { url: process.env.LIVEKIT_URL!, token: await at.toJwt() };
}

/** Whether a request comes from the agent worker (it calls back into the app for each turn). */
export function isAgentRequest(req: Request): boolean {
  const secret = process.env.INTERVIEWER_AGENT_SECRET;
  const given = req.headers.get("x-agent-secret");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
