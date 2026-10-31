"use client";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useMemo, useRef } from "react";
import type { SceneElement } from "@/lib/design/scene";

/**
 * The Excalidraw whiteboard. Load it with next/dynamic and ssr: false; it
 * needs the browser. Reports element changes (not pans, zooms or selection).
 */
export default function Whiteboard({
  initialElements,
  onChange,
  readOnly = false,
  dark = false,
}: {
  initialElements: SceneElement[];
  onChange?: (elements: SceneElement[]) => void;
  readOnly?: boolean;
  dark?: boolean;
}) {
  const initialData = useMemo<ExcalidrawInitialDataState>(
    () => ({
      elements: initialElements as unknown as ExcalidrawInitialDataState["elements"],
      appState: { viewBackgroundColor: "transparent" },
      scrollToContent: true,
    }),
    // The board owns its state after mounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const lastVersion = useRef<number | null>(null);
  return (
    <div className="h-full w-full">
      <Excalidraw
        initialData={initialData}
        viewModeEnabled={readOnly}
        theme={dark ? "dark" : "light"}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: true, toggleTheme: false } }}
        onChange={(elements) => {
          if (!onChange) return;
          // The sum of versions changes on any edit, add or delete, but not on a pan or selection.
          const v = elements.reduce((n, e) => n + e.version, elements.length);
          if (lastVersion.current === null) {
            lastVersion.current = v;
            return;
          }
          if (v === lastVersion.current) return;
          lastVersion.current = v;
          onChange(JSON.parse(JSON.stringify(elements)) as SceneElement[]);
        }}
      />
    </div>
  );
}
