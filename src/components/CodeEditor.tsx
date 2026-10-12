"use client";
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// Monaco is served from public/vendor (see scripts/copy-vendor.mjs), not a CDN.
export const Editor = dynamic(
  () =>
    import("@monaco-editor/react").then((m) => {
      m.loader.config({ paths: { vs: "/vendor/monaco/vs" } });
      return m.default;
    }),
  {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading editor…</div>,
  },
);

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function useDarkMode() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DARK_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

