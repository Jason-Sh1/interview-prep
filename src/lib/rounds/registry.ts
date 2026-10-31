// The conversation round kinds that are built, by kind. A kind missing here
// isn't offered anywhere yet.
import { designKind } from "../design";
import type { RoundKindDef } from "./kind";
import type { RoundKind } from "./types";

const DEFS: Partial<Record<RoundKind, RoundKindDef>> = {
  design: designKind as unknown as RoundKindDef,
};

export function kindDef(kind: string): RoundKindDef | null {
  return DEFS[kind as RoundKind] ?? null;
}

export const builtKinds = (): RoundKind[] => Object.keys(DEFS) as RoundKind[];
