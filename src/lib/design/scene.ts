// The system design whiteboard (Excalidraw) as data: validation of what the
// browser saves, and a plain-text reading of the diagram ("boxes and arrows")
// for the interviewer and the grader. Safe to import from the browser.
import { z } from "zod";

/** The fields of an Excalidraw element we read; the rest is kept as-is for redrawing. */
const elementSchema = z
  .object({
    id: z.string().max(100),
    type: z.string().max(40),
    isDeleted: z.boolean().optional(),
    text: z.string().max(5_000).optional(),
    containerId: z.string().max(100).nullable().optional(),
    startBinding: z.object({ elementId: z.string().max(100) }).passthrough().nullable().optional(),
    endBinding: z.object({ elementId: z.string().max(100) }).passthrough().nullable().optional(),
    boundElements: z.array(z.object({ id: z.string().max(100), type: z.string().max(40) }).passthrough()).nullable().optional(),
  })
  .passthrough();

export type SceneElement = z.infer<typeof elementSchema>;

export const designArtifactSchema = z.object({
  elements: z.array(elementSchema).max(3_000),
  /** A scratchpad beside the board for requirements and estimates. */
  notes: z.string().max(20_000),
});
export type DesignArtifact = z.infer<typeof designArtifactSchema>;

export const emptyDesignArtifact = (): DesignArtifact => ({ elements: [], notes: "" });

const SHAPES = new Set(["rectangle", "ellipse", "diamond", "frame", "image", "embeddable"]);
const LINKS = new Set(["arrow", "line"]);

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export interface SceneSummary {
  /** Labelled shapes, in drawing order. */
  components: string[];
  /** Arrows between shapes, by label ("?" for an unlabelled end). */
  connections: { from: string; to: string; label?: string }[];
  /** Text not inside a shape or on an arrow. */
  freeText: string[];
  unlabelledShapes: number;
}

export function summarizeScene(elements: SceneElement[]): SceneSummary {
  const live = elements.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  // A shape's or arrow's label is the text element bound to it.
  const label = new Map<string, string>();
  for (const e of live) if (e.type === "text" && e.containerId && e.text?.trim()) label.set(e.containerId, clean(e.text));
  const name = (id: string | undefined) => (id && label.get(id)) || (id && byId.get(id) && SHAPES.has(byId.get(id)!.type) ? `unlabelled ${byId.get(id)!.type}` : "?");

  const shapes = live.filter((e) => SHAPES.has(e.type));
  const components = shapes.flatMap((s) => (label.has(s.id) ? [label.get(s.id)!] : []));
  const connections = live
    .filter((e) => LINKS.has(e.type) && (e.startBinding || e.endBinding))
    .map((a) => ({ from: name(a.startBinding?.elementId), to: name(a.endBinding?.elementId), ...(label.has(a.id) ? { label: label.get(a.id) } : {}) }));
  const freeText = live.filter((e) => e.type === "text" && !e.containerId && e.text?.trim()).map((e) => clean(e.text!));
  return { components, connections, freeText, unlabelledShapes: shapes.length - components.length };
}

/** The diagram and notes as text the interviewer can read. */
export function describeDesign(a: DesignArtifact): string {
  const s = summarizeScene(a.elements);
  const lines: string[] = [];
  lines.push(s.components.length ? `Components on the whiteboard: ${s.components.map((c) => `[${c}]`).join(", ")}` : "The whiteboard has no labelled components yet.");
  if (s.unlabelledShapes) lines.push(`Unlabelled shapes: ${s.unlabelledShapes}`);
  if (s.connections.length) lines.push(`Arrows: ${s.connections.map((c) => `${c.from} -> ${c.to}${c.label ? ` (${c.label})` : ""}`).join("; ")}`);
  if (s.freeText.length) lines.push(`Other text on the board: ${s.freeText.map((t) => `"${t.slice(0, 300)}"`).join("; ")}`);
  if (a.notes.trim()) lines.push(`Candidate's notes:\n${a.notes.trim().slice(0, 4_000)}`);
  return lines.join("\n");
}

/** Everything written on the board and in the notes, lowercased, for keyword checks. */
export function boardText(a: DesignArtifact): string {
  const s = summarizeScene(a.elements);
  return [...s.components, ...s.freeText, ...s.connections.map((c) => c.label ?? ""), a.notes].join(" \n").toLowerCase();
}
