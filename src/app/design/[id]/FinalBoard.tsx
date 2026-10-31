"use client";
import dynamic from "next/dynamic";
import { useDarkMode } from "@/components/CodeEditor";
import type { SceneElement } from "@/lib/design/scene";

const Whiteboard = dynamic(() => import("@/components/rounds/Whiteboard"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading whiteboard…</div>,
});

/** The final whiteboard, read-only. */
export function FinalBoard({ elements }: { elements: SceneElement[] }) {
  const dark = useDarkMode();
  if (!elements.some((e) => !e.isDeleted)) return <p className="card mt-2 p-4 text-sm text-muted">The whiteboard was empty.</p>;
  return (
    <div className="card mt-2 h-[28rem] overflow-hidden">
      <Whiteboard initialElements={elements} readOnly dark={dark} />
    </div>
  );
}
