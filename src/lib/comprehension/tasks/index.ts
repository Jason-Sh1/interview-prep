import type { DebugTask } from "../types";
import { availabilityTask } from "./availability";
import { checkoutTask } from "./checkout";

export const DEBUG_TASKS: DebugTask[] = [checkoutTask, availabilityTask];
export const DEBUG_TASK_BY_ID = new Map(DEBUG_TASKS.map((t) => [t.id, t]));
