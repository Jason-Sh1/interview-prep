import type { AssistedTask } from "../types";
import { lruTask } from "./lru-cache";
import { paginateTask } from "./paginate";
import { rateLimitTask } from "./rate-limit";

export const TASKS: AssistedTask[] = [rateLimitTask, paginateTask, lruTask];
export const TASK_BY_ID = new Map(TASKS.map((t) => [t.id, t]));

/** What the browser gets: no reference solution and no scripted answers. */
export interface PublicTask {
  id: string;
  title: string;
  summary: string;
  modeledOn: string;
  brief: string;
  files: Record<string, string>;
  entry: string;
  visibleTests: string[];
  hiddenTests: Record<string, string>;
}

export function toPublicTask(t: AssistedTask): PublicTask {
  const { id, title, summary, modeledOn, brief, files, entry, visibleTests, hiddenTests } = t;
  return { id, title, summary, modeledOn, brief, files, entry, visibleTests, hiddenTests };
}
